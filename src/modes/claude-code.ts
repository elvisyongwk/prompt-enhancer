import { spawn } from "node:child_process";
import type { LLMProvider } from "../types.js";

const TIMEOUT_MS = 30_000;

export class ClaudeCodeProvider implements LLMProvider {
  private model: string;

  constructor() {
    this.model = process.env.CLAUDE_CODE_MODEL || "claude-haiku-4-5-20251001";
  }

  async enhance(prompt: string, context: string, systemPrompt: string): Promise<string> {
    const message = [
      systemPrompt,
      "",
      context ? `Context:\n${context}\n` : "",
      `Prompt to enhance:\n${prompt}`,
      "",
      "Return ONLY the enhanced prompt, no preamble or explanation.",
    ]
      .filter(Boolean)
      .join("\n");

    console.log(`[claude-code] spawning claude CLI (model: ${this.model}) prompt: "${prompt}"`);

    return new Promise((resolve, reject) => {
      const child = spawn("claude", ["--print", "--model", this.model], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;

      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        fn();
      };

      const timer = setTimeout(() => {
        child.kill();
        done(() => reject(new Error(`claude CLI timed out after ${TIMEOUT_MS}ms`)));
      }, TIMEOUT_MS);

      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      child.stdin.on("error", () => {}); // suppress EPIPE if child exits before consuming stdin

      child.on("close", (code) => {
        if (code !== 0) {
          console.error(`[claude-code] CLI exited with code ${code}: ${stderr.trim()}`);
          done(() => reject(new Error(`claude CLI exited with code ${code}: ${stderr.trim()}`)));
        } else {
          const result = stdout.trim() || prompt;
          console.log(`[claude-code] CLI completed (${result.length} chars): "${result}"`);
          done(() => resolve(result));
        }
      });

      child.on("error", (err) => {
        console.error(`[claude-code] failed to spawn claude CLI: ${err.message}`);
        done(() => reject(new Error(`Failed to spawn claude CLI — is Claude Code installed and on PATH? ${err.message}`)));
      });

      child.stdin.write(message);
      child.stdin.end();
    });
  }
}
