export type EnhancerMode = "rules" | "ollama" | "openai" | "anthropic";

export interface EnhanceRequest {
  prompt: string;
  context?: string;
  mode?: EnhancerMode;
}

export interface EnhanceResponse {
  type: "enhanced" | "passthrough";
  result: string;
}

export interface LLMProvider {
  enhance(prompt: string, context: string, systemPrompt: string): Promise<string>;
}