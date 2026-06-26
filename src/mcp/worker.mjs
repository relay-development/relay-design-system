/**
 * relay Design System — remote MCP server (Cloudflare Workers).
 *
 *   Exposes the SAME tools/resources as the stdio server (src/mcp/server.mjs) over
 *   MCP Streamable HTTP at a single `POST /mcp` endpoint, so it can be added as a
 *   remote/custom connector by URL — no npm / Node needed on the client side.
 *
 *   Authless: the design system is public (MIT / public repo / public npm), so the
 *   data is not secret. claude.ai supports authless remote connectors.
 *
 *   Stateless: every request is a self-contained JSON-RPC call. No sessions, no
 *   Durable Objects, no KV — data is inlined at build time via ./handlers.mjs.
 *
 *   Deploy:  npm run deploy:mcp   (runs scripts/build-mcp.mjs then `wrangler deploy`)
 *   Local:   npm run dev:mcp-remote   (wrangler dev → http://localhost:8787/mcp)
 *   Add to claude.ai: Settings → Connectors → Add custom connector → <url>/mcp
 */

import { SERVER_INFO, TOOLS, callTool, listResources, readResource } from "./handlers.mjs";

const PROTOCOL_VERSION = "2024-11-05";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Mcp-Session-Id, Authorization",
  "Access-Control-Max-Age": "86400",
};

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

function jsonResponse(body, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

/** Handle a single JSON-RPC request object. Returns a response object, or null for notifications. */
function handleRpc(msg) {
  const { id, method, params = {} } = msg;

  // Notifications (no response expected) — e.g. notifications/initialized.
  if (id === undefined || id === null) return null;

  switch (method) {
    case "initialize":
      return ok(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {}, resources: {} },
        serverInfo: SERVER_INFO,
      });
    case "ping":
      return ok(id, {});
    case "tools/list":
      return ok(id, { tools: TOOLS });
    case "tools/call": {
      const r = callTool(params.name, params.arguments || {});
      const content = [{ type: "text", text: r.text }];
      return ok(id, r.isError ? { content, isError: true } : { content });
    }
    case "resources/list":
      return ok(id, { resources: listResources() });
    case "resources/read":
      try {
        return ok(id, { contents: [readResource(params.uri)] });
      } catch (e) {
        return err(id, -32602, e.message);
      }
    default:
      return err(id, -32601, `Method not found: ${method}`);
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Friendly root for humans hitting the URL in a browser.
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(
        `relay Design System — remote MCP server (v${SERVER_INFO.version}).\n` +
          `MCP endpoint: POST ${url.origin}/mcp\n` +
          `Add to claude.ai: Settings → Connectors → Add custom connector → ${url.origin}/mcp\n`,
        { headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS } },
      );
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404, headers: CORS });
    }

    // GET /mcp is for server→client streaming; this stateless server has none.
    if (request.method === "GET") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse(err(null, -32700, "Parse error"));
    }

    // Batch or single request.
    if (Array.isArray(body)) {
      const responses = body.map(handleRpc).filter((r) => r !== null);
      // If the batch was all notifications, ack with 202 and no body.
      return responses.length ? jsonResponse(responses) : new Response(null, { status: 202, headers: CORS });
    }

    const res = handleRpc(body);
    if (res === null) return new Response(null, { status: 202, headers: CORS });
    return jsonResponse(res);
  },
};
