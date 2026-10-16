import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../types.js';
import { registerAnalyzeMediaTool } from './analyzeMedia.tool.js';
import { registerAskTool } from './ask.tool.js';
import { registerBrainstormTool } from './brainstorm.tool.js';
import { registerModelsTool } from './models.tool.js';
import { registerPingTool } from './ping.tool.js';
import { registerShellTool } from './shell.tool.js';
import { registerWebSearchTool } from './webSearch.tool.js';

export function registerTools(server: McpServer, config: ServerConfig): void {
  registerAskTool(server, config);
  registerWebSearchTool(server, config);
  registerAnalyzeMediaTool(server, config);
  registerShellTool(server, config);
  registerBrainstormTool(server, config);
  registerModelsTool(server, config);
  registerPingTool(server, config);
}
