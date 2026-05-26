import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { enhancePrompt } from "./enhancer.js";
import type { EnhancerMode } from "./types.js";

const app = express();
const PORT = parseInt(process.env.PORT || "3100", 10);

// Runtime state — can be changed live without restart
let currentMode: EnhancerMode = (process.env.ENHANCER_MODE as EnhancerMode) || "ollama";

function createServer(): McpServer {
  const server = new McpServer({
    name: "prompt-enhancer",
    version: "1.0.0",
  });

  server.registerTool(
    "enhance_prompt",
    {
      description: "Silently enhances a vague/short prompt with context, scope constraints, and focus directives.",
      inputSchema: {
        prompt: z.string().describe("The user's original short/vague prompt"),
        context: z.string().optional().describe("Project context: active file, framework, recent errors, file tree"),
        mode: z.enum(["rules", "ollama", "openai", "anthropic"]).optional().describe("Enhancement mode override"),
      },
    },
    async ({ prompt, context, mode }) => {
      try {
        const effectiveMode = (mode as EnhancerMode | undefined) || currentMode;
        const result = await enhancePrompt(prompt, context, effectiveMode);
        return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return { content: [{ type: "text" as const, text: `Enhancement failed: ${message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "set_enhancer_mode",
    {
      description: "Change the enhancement mode at runtime without restarting the server.",
      inputSchema: { mode: z.enum(["rules", "ollama", "openai", "anthropic"]).describe("The new mode") },
    },
    async ({ mode }) => {
      const prev = currentMode;
      currentMode = mode as EnhancerMode;
      return { content: [{ type: "text" as const, text: `Mode changed: ${prev} → ${currentMode}` }] };
    }
  );

  server.registerTool(
    "get_enhancer_mode",
    { description: "Get the current enhancement mode.", inputSchema: {} },
    async () => ({ content: [{ type: "text" as const, text: `Current mode: ${currentMode}` }] })
  );

  return server;
}

// Streamable HTTP transport — one transport+server per session
const sessions = new Map<string, { transport: StreamableHTTPServerTransport; server: McpServer }>();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
    return;
  }

  // New session — create fresh server + transport pair
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createServer();

  transport.onclose = () => {
    const sid = transport.sessionId;
    if (sid) sessions.delete(sid);
  };

  await server.connect(transport);
  await transport.handleRequest(req, res);

  // Session ID is set after handleRequest processes the initialize message
  const sid = transport.sessionId;
  if (sid) sessions.set(sid, { transport, server });
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
  } else {
    res.status(400).json({ error: "No valid session. Send a POST to /mcp first." });
  }
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (sessionId && sessions.has(sessionId)) {
    const { transport } = sessions.get(sessionId)!;
    await transport.handleRequest(req, res);
  } else {
    res.status(400).json({ error: "No valid session." });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", mode: currentMode, activeSessions: sessions.size });
});

app.listen(PORT, () => {
  console.log(`Prompt Enhancer MCP server running on http://localhost:${PORT}/mcp`);
  console.log(`Mode: ${currentMode}`);
});