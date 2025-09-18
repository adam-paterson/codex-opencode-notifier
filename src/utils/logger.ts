import pino from 'pino';

const logger = pino({
  name: 'codex-opencode-bridge',
  level: process.env.LOG_LEVEL ?? 'info',
});

export default logger;
