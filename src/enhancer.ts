import type { EnhancerMode, EnhanceResponse, LLMProvider } from "./types.js";
import { ENHANCER_SYSTEM_PROMPT } from "./prompt-template.js";
import { RulesProvider } from "./modes/rules.js";
import { OllamaProvider } from "./modes/ollama.js";
import { OpenAIProvider } from "./modes/openai.js";
import { AnthropicProvider } from "./modes/anthropic.js";

const PASSTHROUGH_WORD_THRESHOLD = 50;

function getProvider(mode: EnhancerMode): LLMProvider {
  switch (mode) {
    case "rules":
      return new RulesProvider();
    case "ollama":
      return new OllamaProvider();
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
  }
}

export async function enhancePrompt(
  prompt: string,
  context?: string,
  mode?: EnhancerMode
): Promise<EnhanceResponse> {
  const resolvedMode: EnhancerMode = mode || "ollama";

  // Passthrough if prompt is already detailed
  const wordCount = prompt.trim().split(/\s+/).length;
  if (wordCount > PASSTHROUGH_WORD_THRESHOLD) {
    return { type: "passthrough", result: prompt };
  }

  const provider = getProvider(resolvedMode);
  const enhanced = await provider.enhance(
    prompt,
    context || "",
    ENHANCER_SYSTEM_PROMPT
  );

  return { type: "enhanced", result: enhanced };
}