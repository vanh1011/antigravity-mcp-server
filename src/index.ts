#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig } from './config.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import { createServer } from './server.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  await server.connect(new StdioServerTransport());
  logger.debug(`${SERVER_NAME} ${SERVER_VERSION} ready`, config);

  const shutdown = () => {
    void server.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
