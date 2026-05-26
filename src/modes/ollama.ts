import type { LLMProvider } from "../types.js";

export class OllamaProvider implements LLMProvider {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl || process.env.OLLAMA_BASE_URL || "http://host.docker.internal:11434";
    this.model = model || process.env.OLLAMA_MODEL || "qwen2.5:3b";
  }

  async enhance(prompt: string, context: string, systemPrompt: string): Promise<string> {
    const userMessage = context
      ? `Context:\n${context}\n\nPrompt to enhance:\n${prompt}`
      : `Prompt to enhance:\n${prompt}`;

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() || prompt;
  }
}