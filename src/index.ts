import env from './config/env.js';
import logger from './utils/logger.js';
import { DiscordBridge } from './discord/bridge.js';
import { startHttpServer } from './server/http-server.js';

async function main(): Promise<void> {
  logger.info('starting codex/opencode discord bridge');
  const server = await startHttpServer();
  const discord = new DiscordBridge();
  await discord.start();

  const shutdown = async (signal: NodeJS.Signals) => {
    logger.info({ signal }, 'shutting down');
    await discord.stop();
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  logger.error({ err: error }, 'fatal error');
  process.exit(1);
});
