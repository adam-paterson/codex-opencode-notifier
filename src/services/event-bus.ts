import { EventEmitter } from 'node:events';
import type { BridgeEvent, BridgeReply } from '../domain/types.js';

type BridgeEventMap = {
  event: (payload: BridgeEvent) => void;
  replyQueued: (payload: BridgeReply) => void;
};

export class EventBus extends EventEmitter {
  emit<K extends keyof BridgeEventMap>(event: K, ...args: Parameters<BridgeEventMap[K]>): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof BridgeEventMap>(event: K, listener: BridgeEventMap[K]): this {
    return super.on(event, listener);
  }

  once<K extends keyof BridgeEventMap>(event: K, listener: BridgeEventMap[K]): this {
    return super.once(event, listener);
  }
}

const eventBus = new EventBus();

export default eventBus;
