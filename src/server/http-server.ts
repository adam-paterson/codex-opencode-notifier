import Fastify from 'fastify';
import { z } from 'zod';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import eventBus from '../services/event-bus.js';
import replyQueue from '../services/reply-queue.js';
import type { BridgeEvent, ToolSource } from '../domain/types.js';
import { authenticate } from './auth.js';

const eventSchema = z.object({
  id: z.string().min(1),
  source: z.enum(['codex', 'opencode']),
  type: z.string().min(1),
  title: z.string().optional(),
  body: z.string().min(1),
  createdAt: z.string().datetime().optional(),
  threadId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const drainSchema = z.object({
  source: z.enum(['codex', 'opencode']),
  threadId: z.string().min(1),
});

export function createServer() {
  const app = Fastify({
    logger: false,
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.post('/events', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;

    const parseResult = eventSchema.safeParse(request.body);
    if (!parseResult.success) {
      void reply.code(400).send({ error: parseResult.error.flatten() });
      return reply;
    }

    const payload = parseResult.data;
    const event: BridgeEvent = {
      ...payload,
      createdAt: payload.createdAt ?? new Date().toISOString(),
    };

    eventBus.emit('event', event);
    logger.debug({ eventId: event.id, source: event.source }, 'event enqueued');
    void reply.code(202).send({ accepted: true });
    return reply;
  });

  app.post('/replies/drain', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;

    const parseResult = drainSchema.safeParse(request.body);
    if (!parseResult.success) {
      void reply.code(400).send({ error: parseResult.error.flatten() });
      return reply;
    }

    const { source, threadId } = parseResult.data;
    const replies = replyQueue.drain(source as ToolSource, threadId);
    logger.debug({ source, threadId, count: replies.length }, 'replies drained');
    void reply.code(200).send({ replies });
    return reply;
  });

  app.get('/queue/snapshot', async (request, reply) => {
    if (!authenticate(request, reply)) return reply;
    const snapshot = replyQueue.snapshot();
    void reply.code(200).send({ snapshot });
    return reply;
  });

  return app;
}

export async function startHttpServer() {
  const server = createServer();
  await server.listen({ host: env.BRIDGE_HOST, port: env.BRIDGE_PORT });
  logger.info({ host: env.BRIDGE_HOST, port: env.BRIDGE_PORT }, 'http server listening');
  return server;
}
