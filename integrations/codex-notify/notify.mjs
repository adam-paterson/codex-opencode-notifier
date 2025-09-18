#!/usr/bin/env node
import { randomUUID } from 'node:crypto';

const [, , bridgeUrl, authToken, payloadRaw] = process.argv;

if (!bridgeUrl || !authToken || !payloadRaw) {
  console.error('Usage: node notify.mjs <bridgeUrl> <authToken> <NOTIFICATION_JSON>');
  process.exit(1);
}

async function main() {
  let payload;
  try {
    payload = JSON.parse(payloadRaw);
  } catch (error) {
    console.error('Failed to parse notification JSON:', error);
    process.exit(1);
  }

  const baseUrl = bridgeUrl.replace(/\/$/, '');
  const turnId = payload['turn-id'] ?? randomUUID();
  const lastAssistant = payload['last-assistant-message'] ?? '';
  const inputMessages = Array.isArray(payload['input-messages'])
    ? payload['input-messages'].join('\n')
    : '';

  const bodyParts = [];
  if (lastAssistant) bodyParts.push(lastAssistant);
  if (inputMessages) bodyParts.push(`Prompt: ${inputMessages}`);
  const body = bodyParts.join('\n\n') || 'Codex turn completed.';

  const event = {
    id: turnId,
    source: 'codex',
    type: payload.type ?? 'agent-turn-complete',
    title: payload.type ? `Codex ${payload.type}` : undefined,
    body,
    threadId: turnId,
    createdAt: new Date().toISOString(),
    metadata: payload,
  };

  const response = await fetch(`${baseUrl}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('Bridge returned error:', response.status, text);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Failed to forward Codex notification:', error);
  process.exit(1);
});
