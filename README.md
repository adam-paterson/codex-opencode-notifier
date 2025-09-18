# Codex ↔︎ OpenCode Discord Bridge

A TypeScript service that forwards tool notifications from [OpenAI Codex](https://github.com/openai/codex) and [OpenCode](https://github.com/sst/opencode) into a Discord channel and lets you reply from Discord threads back to each tool.

The project is designed for distribution: it includes a reusable HTTP bridge, Discord integration, accompanying integration artifacts (Codex `notify` script and OpenCode plugin), automated tests, and setup documentation.

## Features

- Minimal Fastify HTTP API secured with a shared bearer token.
- Discord bot that posts rich embeds per tool update and spins up a thread per conversation.
- Reply queue so Codex/OpenCode can poll for Discord responses.
- Ready-to-use integration artifacts:
  - `integrations/codex-notify/notify.mjs` for Codex `notify` hook.
  - `integrations/opencode-plugin/index.ts` OpenCode plugin.
- Vitest coverage for the HTTP API.

## Prerequisites

- Node.js 18.18 or newer (uses built-in `fetch`, ESM, and Discord.js v14).
- A Discord bot with `MESSAGE CONTENT INTENT` and permission to manage threads in the destination guild.
- Hosted Codex CLI with `notify` configured.
- OpenCode CLI (>= 0.3) with plugin support.

## Installation

```bash
npm install
cp .env.example .env
# Fill in your Discord token, channel ID, and bridge token
npm run build
```

To run in development:

```bash
npm run dev
```

To start the compiled service:

```bash
npm start
```

## Environment Variables

| Name | Description |
| --- | --- |
| `DISCORD_TOKEN` | Discord bot token |
| `DISCORD_CHANNEL_ID` | Guild text channel to receive updates |
| `BRIDGE_AUTH_TOKEN` | Shared secret for HTTP integrations |
| `BRIDGE_HOST` | Optional host binding (default `0.0.0.0`) |
| `BRIDGE_PORT` | Optional port (default `8787`) |
| `LOG_LEVEL` | Pino log level (default `info`) |

## Running the Tests

```bash
npm test
```

The suite (`tests/http-server.test.ts`) exercises the HTTP API (authorization, validation, draining replies).

## Integrating with Codex (`notify`)

Codex can invoke an external script for every agent turn. Use the provided script:

1. Copy `integrations/codex-notify/notify.mjs` somewhere accessible (e.g., `~/.codex/notify.mjs`).
2. In `~/.codex/config.toml`, configure the `notify` setting:

   ```toml
   notify = ["node", "/Users/you/.codex/notify.mjs", "https://your-bridge.example.com", "your-shared-token"]
   ```

3. The script accepts `(bridgeUrl, authToken)` and posts the event payload to `POST /events`.

If you run Codex on multiple machines, distribute the same script and token.

### Script Arguments

`notify.mjs` expects the notification JSON on `argv[2]`. Command signature:

```bash
node notify.mjs <bridgeUrl> <authToken> '<JSON_PAYLOAD>'
```

## Integrating with OpenCode (Plugin)

1. Copy `integrations/opencode-plugin/index.ts` into `.opencode/plugin/discord-bridge.ts` (or place it in `~/.config/opencode/plugin`).
2. Install dependencies for the plugin package (see inline README snippet).
3. Configure environment variables for the plugin (either via `.env` or OS env):

   ```bash
   export DISCORD_BRIDGE_URL="https://your-bridge.example.com"
   export DISCORD_BRIDGE_TOKEN="your-shared-token"
   ```

4. Restart OpenCode. The plugin listens for session events and posts them to `/events` while polling `/replies/drain` to forward Discord replies back into the session.

## HTTP API Reference

All routes (except `/health`) require the `Authorization: Bearer <BRIDGE_AUTH_TOKEN>` header.

| Method & Path | Description |
| --- | --- |
| `GET /health` | Liveness probe |
| `POST /events` | Accepts a tool event (Codex/OpenCode) |
| `POST /replies/drain` | Drains queued Discord replies for a thread |
| `GET /queue/snapshot` | Debug view of outstanding replies |

### Example `POST /events`

```json
{
  "id": "evt_123",
  "source": "codex",
  "type": "agent-turn-complete",
  "title": "Turn complete",
  "body": "Codex finished processing the task.",
  "createdAt": "2025-09-18T10:02:22.123Z",
  "threadId": "thread_abc",
  "metadata": {
    "sessionId": "abc",
    "user": "alice"
  }
}
```

### Example `POST /replies/drain`

```json
{
  "source": "opencode",
  "threadId": "session-123"
}
```

Response:

```json
{
  "replies": [
    {
      "id": "reply_456",
      "source": "opencode",
      "threadId": "session-123",
      "body": "Acknowledged, running tests now.",
      "postedAt": "2025-09-18T10:05:00.000Z",
      "metadata": {
        "discordMessageId": "129991234567890"
      }
    }
  ]
}
```

## Deployment Notes

- Host behind HTTPS (e.g., via reverse proxy, Fly.io, Render, etc.).
- Store `BRIDGE_AUTH_TOKEN` as a secret. Rotate periodically.
- Discord threads auto-archive after 24h (configurable in `ThreadAutoArchiveDuration`). Adjust if you expect long-running conversations.

## Roadmap Ideas

- Persist reply queue in Redis/Postgres for multi-instance deployments.
- Add signature verification to incoming Codex/OpenCode payloads.
- Add metrics and structured audit logs.
- Support slash-commands (e.g., `/bridge status`).

## License

MIT
