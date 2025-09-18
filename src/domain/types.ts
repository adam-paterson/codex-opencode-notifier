export type ToolSource = 'codex' | 'opencode';

export interface BridgeEvent {
  id: string;
  source: ToolSource;
  type: string;
  title?: string;
  body: string;
  createdAt: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

export interface EnqueueEventInput {
  event: BridgeEvent;
}

export interface BridgeReply {
  id: string;
  source: ToolSource;
  threadId: string;
  body: string;
  postedAt: string;
  metadata?: Record<string, unknown>;
}

export interface EnqueueReplyInput {
  source: ToolSource;
  threadId: string;
  body: string;
  metadata?: Record<string, unknown>;
}
