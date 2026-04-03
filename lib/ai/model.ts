import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GOOGLE_MODEL = "gemini-2.0-flash";

/**
 * Returns the AI model from env: AI_PROVIDER (openai | google) and AI_MODEL.
 * Low-cost default: OpenAI gpt-4o-mini.
 * Throws if OpenAI is selected but OPENAI_API_KEY is missing.
 */
export function getModel(): LanguageModel {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  const modelId =
    process.env.AI_MODEL ||
    (provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_GOOGLE_MODEL);

  if (provider === "google") {
    return google(modelId);
  }
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "OPENAI_API_KEY is not set. Add it to .env or set AI_PROVIDER=google to use Google.",
    );
  }
  return openai(modelId);
}
