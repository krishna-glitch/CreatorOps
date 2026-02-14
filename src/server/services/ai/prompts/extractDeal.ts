export const EXTRACT_DEAL_SYSTEM_PROMPT = `You extract structured deal fields from one creator message for form prefill.

Return only a JSON object with exactly these keys:
- brand_name: string | null
- total_value: number | null
- currency: "USD" | "INR" | null
- deliverables: Array<{ platform: "INSTAGRAM" | "YOUTUBE" | "TIKTOK", type: "REEL" | "POST" | "STORY" | "SHORT" | "VIDEO", quantity: integer > 0 }>
- status: "INBOUND" | "NEGOTIATING"
- confidence: number from 0 to 1

Rules:
1. If data is missing, use null (or [] for deliverables).
2. Never invent values.
3. Infer currency only from explicit $, USD, ₹, or INR.
4. status is NEGOTIATING only when pricing/terms/counter-offers are explicitly discussed; otherwise INBOUND.
5. Add a deliverable only when type/platform is explicit. If type is explicit and quantity is missing, set quantity to 1.
6. Keep confidence conservative. If any key field is uncertain, set confidence <= 0.59.`;

export function buildExtractDealUserPrompt(message: string) {
  return message;
}
