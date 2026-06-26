/**
 * relay Design System — MCP server (stdio).
 *
 *   Exposes the design system to AI coding tools (Claude Code / Cursor / Windsurf …)
 *   so generated UI follows relay tokens, component APIs, and the non-negotiable
 *   rules instead of hardcoded values.
 *
 *   Tool/resource logic lives in ./handlers.mjs (shared with the Cloudflare Worker
 *   remote transport, src/mcp/worker.mjs). This file only wires those handlers to
 *   the stdio transport and is bundled to dist/mcp.mjs via esbuild (bin: relay-ds-mcp).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  SERVER_INFO,
  TOKEN_CATEGORIES,
  TOOLS,
  callTool,
  listResources,
  readResource,
} from "./handlers.mjs";

const server = new Server(SERVER_INFO, { capabilities: { tools: {}, resources: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const r = callTool(name, args);
  const content = [{ type: "text", text: r.text }];
  return r.isError ? { content, isError: true } : { content };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: listResources() }));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => ({
  contents: [readResource(req.params.uri)],
}));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for the MCP protocol; log to stderr.
  console.error(
    `[relay-ds-mcp] v${SERVER_INFO.version} ready — ${TOOLS.length} tools, ${TOKEN_CATEGORIES.length} token categories`,
  );
}

main().catch((err) => {
  console.error("[relay-ds-mcp] fatal:", err);
  process.exit(1);
});
