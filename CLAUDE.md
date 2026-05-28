# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn build          # compile TypeScript → dist/
yarn dev            # run without compiling (tsx watch)
yarn start          # run compiled dist/index.js

docker compose up -d --build   # build image and start container (primary deployment)
```

Health check: `GET http://localhost:3100/health`  
MCP endpoint: `POST http://localhost:3100/mcp`

There are no tests.

## Architecture

This is a **StreamableHTTP MCP server** that intercepts short prompts from AI agents and enriches them before they reach the main model.

### Request flow

1. AI agent POSTs to `/mcp` with an MCP initialize message (no `mcp-session-id` header yet)
2. Server creates a fresh `McpServer` + `StreamableHTTPServerTransport` pair for the session
3. `transport.handleRequest` processes the initialize and assigns a UUID session ID
4. Subsequent requests include `mcp-session-id` → routed to the existing session pair
5. On transport close, the session is removed from the in-memory `Map`

**Critical:** Do NOT add `express.json()` or any body-parsing middleware — the MCP transport reads the raw request body directly. Doing so will break the MCP protocol.

### Provider pattern

`src/enhancer.ts` is the entry point for enhancement logic. It checks word count (≤50 words = enhance, >50 = passthrough) and delegates to one of four providers in `src/modes/`:

| Provider | File | Backend |
|----------|------|---------|
| `RulesProvider` | `modes/rules.ts` | Keyword heuristics, no external calls |
| `OllamaProvider` | `modes/ollama.ts` | Local Ollama REST API |
| `OpenAIProvider` | `modes/openai.ts` | OpenAI chat completions API |
| `AnthropicProvider` | `modes/anthropic.ts` | Anthropic messages API |

All providers implement the `LLMProvider` interface from `src/types.ts`: a single `enhance(prompt, context, systemPrompt)` method that returns a string.

The system prompt and keyword-pattern map live in `src/prompt-template.ts`. Adding new enhancement patterns or tuning the LLM instruction set only requires editing that file.

### Runtime mode switching

`currentMode` in `src/index.ts` is module-level state. `set_enhancer_mode` mutates it in place — no restart needed. Each MCP tool call can also override the mode per-call via the `mode` parameter.

### Adding a new provider

1. Create `src/modes/<name>.ts` implementing `LLMProvider`
2. Add the mode string to `EnhancerMode` in `src/types.ts`
3. Add a `case` in `getProvider()` in `src/enhancer.ts`
4. Add the enum value to the `z.enum([...])` schemas in `src/index.ts`

## Key constraints

- Use `server.registerTool()` — not the deprecated `server.tool()`
- Use `StreamableHTTPServerTransport` — not the deprecated `SSEServerTransport`
- The session ID on `transport.sessionId` is only populated **after** `handleRequest` processes the MCP initialize message — do not read it before that point
- ESM project (`"type": "module"`) — all local imports must use `.js` extensions even for `.ts` source files
- Yarn Berry 4.15.0 with `nodeLinker: node-modules` — use `yarn` not `npm`

## Environment variables

Configured via `.env` (copy from `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `ENHANCER_MODE` | `ollama` | Active provider on startup |
| `OLLAMA_BASE_URL` | `http://host.docker.internal:11434` | Ollama endpoint (Docker default) |
| `OLLAMA_MODEL` | `qwen2.5:3b` | Model pulled in Ollama |
| `OPENAI_API_KEY` | — | Required for `openai` mode |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model |
| `ANTHROPIC_API_KEY` | — | Required for `anthropic` mode |
| `ANTHROPIC_MODEL` | `claude-haiku-4-20250414` | Anthropic model |

## Prompt enhancement behaviour

You MUST call `enhance_prompt` as the first step of any new task that meets ALL of these conditions:

- The prompt is ≤ 50 words, OR is vague/ambiguous (e.g. "fix the bug", "add a test")
- It is the start of a new task — not a follow-up, correction, or clarification mid-task
- The user has not said "do not enhance" or similar

Call with:
```json
{ "prompt": "<exact user message>", "context": "<active file, language, framework, recent errors>" }
```

Use the enhanced result as your actual working directive — do not fall back to the original short prompt.

Skip enhancement if: prompt is already detailed (> 50 words), user is answering a question you asked, or user explicitly opts out.
