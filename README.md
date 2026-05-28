# Prompt Enhancer MCP Server

A local MCP server that silently enhances vague/short prompts into precise, actionable directives — reducing wasted tokens on the main AI agent.

## How It Works

You type a short prompt like "fix login bug" → the enhancer enriches it with scope constraints, relevant context, and focus directives → the main AI executes efficiently without over-exploring.

**No questions asked.** It infers intent and adds guardrails silently.

## Quick Start

### Prerequisites

- Docker (for containerized deployment)
- Optionally [Ollama](https://ollama.ai) running locally (for `ollama` mode)

```bash
# (Optional) Install and start Ollama with a small model
brew install ollama
ollama pull qwen2.5:3b
```

### Run with Docker

```bash
cp .env.example .env
docker compose up -d --build
```

The server runs at `http://localhost:3100/mcp`

Health check: `GET http://localhost:3100/health`

> **Note:** If using `ollama` mode, ensure Ollama is running on the host (`ollama serve`) before starting the container. The container reaches Ollama via `host.docker.internal:11434`.

### Run Locally (development)

```bash
cp .env.example .env   # configure your preferred mode
yarn install
yarn dev               # tsx watch — no compile step, auto-reloads on change
```

Or run the compiled output:

```bash
yarn build
yarn start
```

> **Note:** `claude-code` mode requires the `claude` CLI to be installed and authenticated on your machine. It does not work inside Docker without extra setup.

## Connect to Your AI Agent

### Cline

Add to your Cline MCP settings (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "prompt-enhancer": {
      "url": "http://localhost:3100/mcp",
      "type": "streamableHttp",
      "disabled": false,
      // autoApprove is optional
      "autoApprove": ["enhance_prompt", "get_enhancer_mode", "set_enhancer_mode"]
    }
  }
}
```

### Claude Code

Add the MCP server using the CLI:

```bash
claude mcp add prompt-enhancer --transport http http://localhost:3100/mcp
```

Or add manually to your Claude Code MCP config (`~/.claude/mcp.json`):

```json
{
  "mcpServers": {
    "prompt-enhancer": {
      "type": "http",
      "url": "http://localhost:3100/mcp"
    }
  }
}
```

### Enabling Auto-Enhancement

Both Cline and Claude Code need instructions telling the agent *when* to call the tool. Add the appropriate file to your project root:

- **For Cline** — `.clinerules` (or global `~/Documents/Cline/Rules/`)
- **For Claude Code** — `CLAUDE.md`

Use this content:

```markdown
## Prompt Enhancement

When you receive a user prompt that is short or vague (≤50 words), BEFORE starting work on it,
call the `enhance_prompt` MCP tool to get an enhanced version. Use the enhanced prompt as your
actual task directive.

Call with: { "prompt": "<user's message>", "context": "<active file, framework, recent errors>" }

Do NOT enhance if the prompt is >50 words, is a follow-up, or the user says "do not enhance".
```

## Modes

| Mode | Backend | Cost | Setup |
|------|---------|------|-------|
| `rules` | Template heuristics | Free | None |
| `ollama` (default) | Local Ollama | Free | `ollama pull qwen2.5:3b` |
| `openai` | OpenAI API | ~$0.001/prompt | Set `OPENAI_API_KEY` |
| `anthropic` | Anthropic API | ~$0.001/prompt | Set `ANTHROPIC_API_KEY` |
| `claude-code` | Local `claude` CLI | Free (uses Claude Code auth) | Claude Code installed + authenticated; **local only, not Docker** |

Set mode via `ENHANCER_MODE` env var, or change at runtime with the `set_enhancer_mode` tool, or override per-call via the `mode` parameter.

## Configuration

See `.env.example` for all available options.

## Tool API

### `enhance_prompt`

Enhances a short/vague prompt with context, scope constraints, and focus directives.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | yes | The user's short/vague prompt |
| `context` | string | no | Project context (active file, framework, errors, file tree) |
| `mode` | enum | no | Override: `rules`, `ollama`, `openai`, `anthropic`, `claude-code` |

**Returns:**
```json
{
  "type": "enhanced",
  "result": "The enriched, actionable prompt..."
}
```

If the prompt is already >50 words, returns `"type": "passthrough"` unchanged.

### `set_enhancer_mode`

Change the active enhancement mode at runtime.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `mode` | enum | yes | `rules`, `ollama`, `openai`, `anthropic`, `claude-code` |

### `get_enhancer_mode`

Returns the current active mode. No parameters.

## Architecture

- **Transport**: StreamableHTTP (`@modelcontextprotocol/sdk` ^1.29.0)
- **Server**: Express 5, per-session `McpServer` + `StreamableHTTPServerTransport` instances
- **Session management**: Session ID is generated during the MCP initialize handshake; each session gets its own isolated server instance
- **No body-parsing middleware** — the transport reads raw request bodies directly

## Security

- Default mode (`rules`) requires no external calls — everything stays local
- `ollama` mode keeps all data local — nothing leaves your machine
- Cloud modes (`openai`, `anthropic`) are opt-in only
- No telemetry, no data storage

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and ensure `yarn build` passes
4. Commit with conventional commits: `feat:`, `fix:`, `docs:`, etc.
5. Open a Pull Request

## Recommended Ollama Models

| Model | Size | Notes |
|-------|------|-------|
| `qwen2.5:3b` | 2GB | Fast, good at instruction following |
| `qwen2.5:7b` | 4.7GB | Better quality |
| `llama3.2:3b` | 2GB | Alternative small model |
| `phi4-mini` | 2.5GB | Strong reasoning |
| `gemma3:4b` | 3GB | Good instruction following |