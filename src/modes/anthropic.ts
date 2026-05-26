import type { LLMProvider } from "../types.js";

export class AnthropicProvider implements LLMProvider {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || "";
    this.model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-20250414";
  }

  async enhance(prompt: string, context: string, systemPrompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required for anthropic mode");
    }

    const userMessage = context
      ? `Context:\n${context}\n\nPrompt to enhance:\n${prompt}`
      : `Prompt to enhance:\n${prompt}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text?.trim() || prompt;
  }
}