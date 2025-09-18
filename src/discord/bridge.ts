import {
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  GuildTextThreadChannel,
  TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import { createHash } from 'node:crypto';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import eventBus from '../services/event-bus.js';
import replyQueue from '../services/reply-queue.js';
import type { BridgeEvent, ToolSource } from '../domain/types.js';

interface ThreadBinding {
  source: ToolSource;
  threadId: string;
}

const THREAD_NAME_PREFIX = 'tool';
const HASH_MARKER = 'hash';

export class DiscordBridge {
  #client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
    ],
  });

  #channel?: TextChannel;
  #bindings = new Map<string, ThreadBinding>();

  async start(): Promise<void> {
    this.#registerListeners();
    await this.#client.login(env.DISCORD_TOKEN);
  }

  async stop(): Promise<void> {
    await this.#client.destroy();
  }

  #registerListeners(): void {
    this.#client.once(Events.ClientReady, async () => {
      logger.info('discord client ready');
      await this.#resolveChannel();
      eventBus.on('event', (event) => void this.#handleEvent(event));
    });

    this.#client.on(Events.MessageCreate, async (message) => {
      if (message.author.bot) return;
      if (!message.channel.isThread()) return;
      const binding = this.#lookupBinding(message.channel);
      if (!binding) return;
      const content = message.content.trim();
      if (!content) return;

      try {
        replyQueue.enqueue({
          source: binding.source,
          threadId: binding.threadId,
          body: content,
          metadata: { discordMessageId: message.id },
        });
        await message.react('✅');
      } catch (error) {
        logger.error({ err: error }, 'failed to enqueue reply');
        await message.react('⚠️');
      }
    });
  }

  async #resolveChannel(): Promise<void> {
    const channel = await this.#client.channels.fetch(env.DISCORD_CHANNEL_ID);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error('DISCORD_CHANNEL_ID must reference a guild text channel');
    }
    this.#channel = channel as TextChannel;
  }

  async #handleEvent(event: BridgeEvent): Promise<void> {
    if (!this.#channel) {
      logger.warn({ eventId: event.id }, 'channel not ready for event');
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle(event.title ?? `${event.source.toUpperCase()} ${event.type}`)
      .setDescription(event.body)
      .addFields(
        { name: 'Source', value: event.source, inline: true },
        { name: 'Type', value: event.type, inline: true },
      )
      .setTimestamp(new Date(event.createdAt));

    if (event.metadata && Object.keys(event.metadata).length > 0) {
      embed.addFields({ name: 'Metadata', value: formatMetadata(event.metadata) });
    }

    const message = await this.#channel.send({ embeds: [embed] });
    const thread = await this.#ensureThread(message, event);
    if (thread) {
      this.#bindings.set(thread.id, {
        source: event.source,
        threadId: deriveThreadId(event),
      });
    }
  }

  async #ensureThread(message: Awaited<ReturnType<TextChannel['send']>>, event: BridgeEvent) {
    const existing = message.hasThread ? message.thread : null;
    if (existing) return existing;

    const toolThreadId = deriveThreadId(event);
    const name = buildThreadName(event.source, toolThreadId);
    const thread = await message.startThread({
      name,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
    });

    if (name.includes(HASH_MARKER)) {
      await thread.send(`Linked tool thread: ${toolThreadId}. Replies here will sync back to ${event.source}.`);
    }

    return thread;
  }

  #lookupBinding(thread: GuildTextThreadChannel): ThreadBinding | undefined {
    const cached = this.#bindings.get(thread.id);
    if (cached) return cached;
    const parsed = parseThreadName(thread.name);
    if (parsed) {
      this.#bindings.set(thread.id, parsed);
      return parsed;
    }
    return undefined;
  }
}

function deriveThreadId(event: BridgeEvent): string {
  return (event.threadId ?? event.id).trim();
}

function buildThreadName(source: ToolSource, toolThreadId: string): string {
  const encoded = encodeURIComponent(toolThreadId);
  const candidate = `${THREAD_NAME_PREFIX}|${source}|${encoded}`;
  if (candidate.length <= 95) return candidate;
  const hash = createHash('sha256').update(toolThreadId).digest('hex').slice(0, 12);
  return `${THREAD_NAME_PREFIX}|${source}|${HASH_MARKER}|${hash}`;
}

function parseThreadName(name: string): ThreadBinding | undefined {
  if (!name.startsWith(`${THREAD_NAME_PREFIX}|`)) return undefined;
  const parts = name.split('|');
  if (parts.length < 3) return undefined;
  const [, source, ...rest] = parts;
  if (rest[0] === HASH_MARKER) {
    logger.warn({ threadName: name }, 'thread name hashed; unable to recover tool thread id');
    return undefined;
  }
  try {
    const decoded = decodeURIComponent(rest.join('|'));
    return { source: source as ToolSource, threadId: decoded };
  } catch (error) {
    logger.warn({ err: error, threadName: name }, 'failed to decode thread id');
    return undefined;
  }
}

function formatMetadata(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata)
    .slice(0, 5)
    .map(([key, value]) => `• ${key}: ${stringifyValue(value)}`);
  return entries.length > 0 ? entries.join('\n') : 'n/a';
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return `\`${JSON.stringify(value)}\``;
}
