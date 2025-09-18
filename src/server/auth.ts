import type { FastifyReply, FastifyRequest } from 'fastify';
import env from '../config/env.js';
import logger from '../utils/logger.js';

export function authenticate(request: FastifyRequest, reply: FastifyReply): boolean {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    logger.warn({ path: request.url }, 'missing bearer token');
    void reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }

  const token = header.slice('Bearer '.length).trim();
  if (token !== env.BRIDGE_AUTH_TOKEN) {
    logger.warn({ path: request.url }, 'invalid bearer token');
    void reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }

  return true;
}
