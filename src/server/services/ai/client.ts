import Groq from "groq-sdk";
import { ExternalServiceError } from "@/server/utils/errors";

export const GROQ_EXTRACTION_MODEL =
  process.env.GROQ_EXTRACTION_MODEL?.trim() || "llama-3.1-8b-instant";

let groqClient: Groq | null = null;

export function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new ExternalServiceError(
      "Groq",
      new Error("Missing GROQ_API_KEY environment variable"),
    );
  }

  if (!groqClient) {
    groqClient = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  return groqClient;
}

export async function testGroqConnection(inputMessage: string) {
  try {
    const client = getGroqClient();

    const completion = await client.chat.completions.create({
      model: GROQ_EXTRACTION_MODEL,
      temperature: 0,
      max_completion_tokens: 64,
      messages: [
        {
          role: "system",
          content:
            "You are a connection test assistant. Reply with one short sentence.",
        },
        {
          role: "user",
          content: inputMessage,
        },
      ],
    });

    return {
      model: GROQ_EXTRACTION_MODEL,
      output: completion.choices[0]?.message?.content?.trim() ?? "",
      usage: completion.usage,
    };
  } catch (error) {
    throw new ExternalServiceError(
      "Groq",
      error instanceof Error ? error : undefined,
    );
  }
}
