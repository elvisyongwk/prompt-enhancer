import type { LLMProvider } from "../types.js";
import { RULES_ENHANCEMENT_PATTERNS } from "../prompt-template.js";

export class RulesProvider implements LLMProvider {
  async enhance(prompt: string, context: string): Promise<string> {
    const lowerPrompt = prompt.toLowerCase().trim();

    // Find matching pattern
    let suffix = "";
    for (const [keyword, enhancement] of Object.entries(RULES_ENHANCEMENT_PATTERNS)) {
      if (lowerPrompt.includes(keyword)) {
        suffix = ` ${enhancement}`;
        break;
      }
    }

    // Add context constraints if available
    let contextHint = "";
    if (context) {
      contextHint = `\n\nProject context:\n${context}`;
    }

    return `${prompt}${suffix}${contextHint}`.trim();
  }
}