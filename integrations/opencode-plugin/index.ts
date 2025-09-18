import type { Plugin } from '@opencode-ai/plugin';
import { randomUUID } from 'node:crypto';

const bridgeUrl = process.env.DISCORD_BRIDGE_URL?.replace(/\/$/, '');
const authToken = process.env.DISCORD_BRIDGE_TOKEN;
const pollIntervalMs = Number(process.env.DISCORD_BRIDGE_POLL_INTERVAL ?? '5000');

function ensureConfig(): asserts bridgeUrl is string & { length: number } {
  if (!bridgeUrl || !authToken) {
    throw new Error('Set DISCORD_BRIDGE_URL and DISCORD_BRIDGE_TOKEN to enable the Discord bridge plugin.');
  }
}

const activeThreads = new Set<string>();
let pollTimer: NodeJS.Timeout | undefined;

async function postEvent(body: unknown) {
  ensureConfig();
  await fetch(`${bridgeUrl}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });
}

async function drainReplies(source: string, threadId: string) {
  ensureConfig();
  const response = await fetch(`${bridgeUrl}/replies/drain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ source, threadId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bridge drain error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as { replies: Array<{ threadId: string; body: string }> };
  return data.replies;
}

function guessThreadId(event: any): string | undefined {
  const props = event?.properties ?? {};
  if (typeof props.sessionID === 'string') return props.sessionID;
  if (props.info && typeof props.info === 'object' && typeof props.info.id === 'string') return props.info.id;
  if (props.message && typeof props.message === 'object' && typeof props.message.sessionID === 'string') {
    return props.message.sessionID;
  }
  return undefined;
}

function formatBody(event: any): string {
  switch (event.type) {
    case 'session.idle':
      return `Session ${event.properties?.sessionID ?? 'unknown'} is idle.`;
    case 'session.error':
      return `Session ${event.properties?.sessionID ?? 'unknown'} encountered an error.`;
    case 'message.updated':
      return `Message ${event.properties?.info?.id ?? 'unknown'} updated.`;
    default:
      return `OpenCode event ${event.type}`;
  }
}

export const DiscordBridgePlugin: Plugin = async ({ client }) => {
  if (!bridgeUrl || !authToken) {
    console.warn('[discord-bridge] plugin disabled – missing DISCORD_BRIDGE_URL or DISCORD_BRIDGE_TOKEN');
    return {};
  }

  async function forwardEvent(event: any) {
    const threadId = guessThreadId(event) ?? randomUUID();
    activeThreads.add(threadId);

    const bridgeEvent = {
      id: randomUUID(),
      source: 'opencode' as const,
      type: event.type,
      title: `OpenCode ${event.type}`,
      body: `${formatBody(event)}\n\n\`\`\`json\n${JSON.stringify(event.properties ?? {}, null, 2)}\n\`\`\``,
      createdAt: new Date().toISOString(),
      threadId,
      metadata: event,
    };

    await postEvent(bridgeEvent);
  }

  async function poll() {
    for (const threadId of activeThreads) {
      try {
        const replies = await drainReplies('opencode', threadId);
        for (const reply of replies) {
          await client.session.prompt({
            path: { id: threadId },
            body: {
              parts: [
                {
                  type: 'text',
                  text: reply.body,
                },
              ],
            },
          });
        }
      } catch (error) {
        console.warn('[discord-bridge] failed to poll replies:', error);
      }
    }
  }

  pollTimer = setInterval(poll, pollIntervalMs);
  void poll();

  return {
    event: async ({ event }) => {
      try {
        await forwardEvent(event);
      } catch (error) {
        console.warn('[discord-bridge] failed to forward event:', error);
      }

      if (event.type === 'session.deleted' && event.properties?.info?.id) {
        activeThreads.delete(event.properties.info.id);
      }
    },
  };
};

export default DiscordBridgePlugin;
