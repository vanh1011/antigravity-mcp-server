import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_NAME, SERVER_VERSION } from './constants.js';
import { registerTools } from './tools/index.js';
import type { ServerConfig } from './types.js';

export function createServer(config: ServerConfig): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerTools(server, config);
  return server;
}
