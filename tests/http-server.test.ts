import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

process.env.DISCORD_TOKEN = process.env.DISCORD_TOKEN ?? 'test-token';
process.env.DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID ?? '1234567890';
process.env.BRIDGE_AUTH_TOKEN = process.env.BRIDGE_AUTH_TOKEN ?? 'test-secret';

import { createServer } from '../src/server/http-server.js';
import eventBus from '../src/services/event-bus.js';
import replyQueue from '../src/services/reply-queue.js';

const AUTH_HEADER = { Authorization: `Bearer ${process.env.BRIDGE_AUTH_TOKEN}` };

describe('HTTP server', () => {
  const listeners: Array<() => void> = [];

  afterEach(() => {
    for (const off of listeners) off();
    listeners.length = 0;
  });

  const app = createServer();

  afterEach(async () => {
    await app.close();
  });

  beforeEach(async () => {
    if (!app.server.listening) {
      await app.listen({ port: 0 });
    }
  });

  it('rejects unauthorized requests', async () => {
    const response = await request(app.server).post('/events').send({});
    expect(response.status).toBe(401);
  });

  it('accepts a valid event and emits it on the bus', async () => {
    const payload = {
      id: 'evt-1',
      source: 'codex',
      type: 'agent-turn-complete',
      body: 'Codex finished a turn.',
      createdAt: new Date().toISOString(),
    };

    const emitted = new Promise((resolve) => {
      const handler = (event: any) => {
        resolve(event);
        eventBus.off('event', handler);
      };
      eventBus.on('event', handler);
      listeners.push(() => eventBus.off('event', handler));
    });

    const response = await request(app.server)
      .post('/events')
      .set(AUTH_HEADER)
      .send(payload);

    expect(response.status).toBe(202);
    const event = await emitted;
    expect(event).toMatchObject(payload);
  });

  it('drains queued replies', async () => {
    const threadId = 'session-123';
    replyQueue.enqueue({
      source: 'opencode',
      threadId,
      body: 'Acknowledged',
    });

    const response = await request(app.server)
      .post('/replies/drain')
      .set(AUTH_HEADER)
      .send({ source: 'opencode', threadId });

    expect(response.status).toBe(200);
    expect(response.body.replies).toHaveLength(1);
    expect(response.body.replies[0]).toMatchObject({
      source: 'opencode',
      threadId,
      body: 'Acknowledged',
    });

    const secondCall = await request(app.server)
      .post('/replies/drain')
      .set(AUTH_HEADER)
      .send({ source: 'opencode', threadId });

    expect(secondCall.body.replies).toHaveLength(0);
  });
});
