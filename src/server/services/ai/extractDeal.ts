import { z } from "zod";
import { getGroqClient, GROQ_EXTRACTION_MODEL } from "./client";
import {
  buildExtractDealUserPrompt,
  EXTRACT_DEAL_SYSTEM_PROMPT,
} from "./prompts/extractDeal";
import { disableAIExtractionDueToQuota } from "./quotaFlag";
import { ExternalServiceError, ValidationError } from "@/server/utils/errors";
import logger from "@/server/utils/logger";

const deliverableSchema = z.object({
  platform: z.enum(["INSTAGRAM", "YOUTUBE", "TIKTOK"]),
  type: z.enum(["REEL", "POST", "STORY", "SHORT", "VIDEO"]),
  quantity: z.number().int().positive(),
});

const extractedDealSchema = z.object({
  brand_name: z.string().trim().min(1).nullable(),
  total_value: z.number().positive().finite().nullable(),
  currency: z.enum(["USD", "INR"]).nullable(),
  deliverables: z.array(deliverableSchema),
  status: z.enum(["INBOUND", "NEGOTIATING"]),
  confidence: z.number().min(0).max(1),
});

export type ExtractedDeal = z.infer<typeof extractedDealSchema>;

interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
}

const RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 2,
  initialDelay: 600,
  maxDelay: 2500,
  factor: 2,
};

const MAX_EXTRACTION_MESSAGE_CHARS = 1800;
const MAX_COMPLETION_TOKENS = 220;

function delayMs(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGroqError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("network") ||
    message.includes("socket") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("500")
  );
}

function isQuotaGroqError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("quota") ||
    message.includes("insufficient_quota") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("429")
  );
}

async function callGroqWithRetry(message: string): Promise<string> {
  const client = getGroqClient();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_OPTIONS.maxAttempts; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: GROQ_EXTRACTION_MODEL,
        temperature: 0,
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: EXTRACT_DEAL_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: buildExtractDealUserPrompt(message),
          },
        ],
      });

      const content = response.choices[0]?.message?.content;

      if (!content || typeof content !== "string") {
        throw new ValidationError("Groq returned empty JSON response", {
          operation: "extractDealFromMessage",
        });
      }

      logger.info("Groq extraction request succeeded", {
        attempt,
        model: GROQ_EXTRACTION_MODEL,
      });

      return content;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }

      const normalizedError =
        error instanceof Error ? error : new Error("Unknown Groq API error");
      lastError = normalizedError;

      if (isQuotaGroqError(normalizedError)) {
        disableAIExtractionDueToQuota(normalizedError.message);
        logger.warn("AI extraction disabled due to quota", {
          operation: "extractDealFromMessage",
          model: GROQ_EXTRACTION_MODEL,
          error: normalizedError.message,
        });
        break;
      }

      if (!isRetryableGroqError(normalizedError) || attempt === RETRY_OPTIONS.maxAttempts) {
        break;
      }

      const delay = Math.min(
        RETRY_OPTIONS.initialDelay * RETRY_OPTIONS.factor ** (attempt - 1),
        RETRY_OPTIONS.maxDelay,
      );

      logger.warn("Retrying Groq extraction request", {
        attempt,
        maxAttempts: RETRY_OPTIONS.maxAttempts,
        delay,
        error: normalizedError.message,
      });

      await delayMs(delay);
    }
  }

  throw new ExternalServiceError("Groq", lastError ?? undefined);
}

export async function extractDealFromMessage(message: string): Promise<ExtractedDeal> {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new ValidationError("Message is required for deal extraction", {
      operation: "extractDealFromMessage",
    });
  }

  const modelMessage = normalizedMessage.slice(0, MAX_EXTRACTION_MESSAGE_CHARS);

  if (normalizedMessage.length > MAX_EXTRACTION_MESSAGE_CHARS) {
    logger.warn("Deal extraction message truncated", {
      operation: "extractDealFromMessage",
      originalLength: normalizedMessage.length,
      truncatedLength: modelMessage.length,
    });
  }

  logger.info("Starting deal extraction", {
    operation: "extractDealFromMessage",
    messageLength: modelMessage.length,
    model: GROQ_EXTRACTION_MODEL,
  });

  const content = await callGroqWithRetry(modelMessage);

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    logger.warn("Failed to parse Groq JSON response", {
      operation: "extractDealFromMessage",
      error: error instanceof Error ? error.message : "Unknown parse error",
    });

    throw new ValidationError("Invalid JSON returned by Groq extraction", {
      operation: "extractDealFromMessage",
    });
  }

  const validated = extractedDealSchema.safeParse(parsed);
  if (!validated.success) {
    logger.warn("Groq extraction response failed schema validation", {
      operation: "extractDealFromMessage",
      issues: validated.error.flatten(),
    });

    throw new ValidationError("Extracted deal response failed validation", {
      operation: "extractDealFromMessage",
      issues: validated.error.flatten(),
    });
  }

  logger.info("Deal extraction completed", {
    operation: "extractDealFromMessage",
    status: validated.data.status,
    confidence: validated.data.confidence,
  });

  return validated.data;
}
