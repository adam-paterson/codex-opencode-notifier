import { randomUUID } from 'node:crypto';
import eventBus from './event-bus.js';
import type { BridgeReply, EnqueueReplyInput, ToolSource } from '../domain/types.js';

class ReplyQueue {
  #store: Map<ToolSource, Map<string, BridgeReply[]>> = new Map();

  enqueue(input: EnqueueReplyInput): BridgeReply {
    const reply: BridgeReply = {
      id: randomUUID(),
      source: input.source,
      threadId: input.threadId,
      body: input.body,
      postedAt: new Date().toISOString(),
      metadata: input.metadata,
    };

    const sourceBucket = this.#store.get(input.source) ?? new Map<string, BridgeReply[]>();
    const threadBucket = sourceBucket.get(input.threadId) ?? [];
    threadBucket.push(reply);
    sourceBucket.set(input.threadId, threadBucket);
    this.#store.set(input.source, sourceBucket);

    eventBus.emit('replyQueued', reply);
    return reply;
  }

  drain(source: ToolSource, threadId: string): BridgeReply[] {
    const sourceBucket = this.#store.get(source);
    if (!sourceBucket) return [];
    const replies = sourceBucket.get(threadId) ?? [];
    sourceBucket.delete(threadId);
    if (sourceBucket.size === 0) {
      this.#store.delete(source);
    }
    return replies;
  }

  snapshot(): Record<string, Record<string, number>> {
    const snapshot: Record<string, Record<string, number>> = {};
    for (const [source, threads] of this.#store.entries()) {
      snapshot[source] = {};
      for (const [threadId, replies] of threads.entries()) {
        snapshot[source][threadId] = replies.length;
      }
    }
    return snapshot;
  }
}

const replyQueue = new ReplyQueue();

export default replyQueue;
