import type { LLMProvider } from "../types.js";

export class OpenAIProvider implements LLMProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    this.apiKey = process.env.OPENAI_API_KEY || "";
    this.model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async enhance(prompt: string, context: string, systemPrompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required for openai mode");
    }

    const userMessage = context
      ? `Context:\n${context}\n\nPrompt to enhance:\n${prompt}`
      : `Prompt to enhance:\n${prompt}`;

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content?.trim() || prompt;
  }
}