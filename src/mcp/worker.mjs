/**
 * relay Design System — remote MCP server (Cloudflare Workers).
 *
 *   Exposes the SAME tools/resources as the stdio server (src/mcp/server.mjs) over
 *   MCP Streamable HTTP at a single `/mcp` endpoint, so it can be added as a
 *   remote/custom connector by URL — no npm / Node needed on the client side.
 *
 *   Authless: the design system is public (MIT / public repo / public npm), so the
 *   data is not secret. claude.ai supports authless remote connectors.
 *
 *   Transport notes (Streamable HTTP):
 *     - POST /mcp with a JSON-RPC request. If the client's Accept header includes
 *       text/event-stream (claude.ai does), the response is sent as a single SSE
 *       `event: message` frame; otherwise as application/json. Some clients only
 *       invoke tools when the response arrives over SSE, so we honor Accept.
 *     - A Mcp-Session-Id is returned on initialize (clients echo it back; we are
 *       stateless so we accept any/none).
 *     - initialize echoes the client's requested protocolVersion (our basic
 *       methods are version-agnostic), maximizing client compatibility.
 *
 *   Deploy:  npm run deploy:mcp   ·   Local: npm run dev:mcp-remote
 *   Add to claude.ai: Settings → Connectors → Add custom connector → <url>/mcp
 */

import { SERVER_INFO, INSTRUCTIONS, TOOLS, callTool, listResources, readResource } from "./handlers.mjs";

const DEFAULT_PROTOCOL = "2025-06-18";
const SESSION_ID = "relay-ds"; // stateless — a stable id is enough for clients that require one

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...headers },
  });
}

/** Send one or more JSON-RPC responses as Server-Sent Events (single, then close). */
function sseResponse(responses, { headers = {} } = {}) {
  const body = responses.map((r) => `event: message\ndata: ${JSON.stringify(r)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      ...CORS,
      ...headers,
    },
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
        // Echo the client's requested version (our methods are version-agnostic).
        protocolVersion:
          typeof params.protocolVersion === "string" ? params.protocolVersion : DEFAULT_PROTOCOL,
        capabilities: { tools: {}, resources: {} },
        serverInfo: SERVER_INFO,
        // Standing system context loaded by clients at connect time (keeps the
        // "use relay components / no hardcoding" rules in effect mid-build).
        instructions: INSTRUCTIONS,
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

    // Lightweight diagnostics (visible via `wrangler tail`).
    console.log(
      `[req] ${request.method} ${url.pathname} accept=${request.headers.get("accept") || "-"} proto=${request.headers.get("mcp-protocol-version") || "-"} session=${request.headers.get("mcp-session-id") || "-"}`,
    );

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Friendly root for humans hitting the URL in a browser.
    if (url.pathname === "/" || url.pathname === "") {
      return new Response(
        `relay Design System — remote MCP server (v${SERVER_INFO.version}).\n` +
          `MCP endpoint: ${url.origin}/mcp\n` +
          `Add to claude.ai: Settings → Connectors → Add custom connector → ${url.origin}/mcp\n`,
        { headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS } },
      );
    }

    if (url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404, headers: CORS });
    }

    // GET /mcp opens the optional server→client SSE stream. We have no
    // server-initiated messages, so return an open-then-idle empty stream
    // (200) rather than 405, which stricter clients treat as a failure.
    if (request.method === "GET") {
      if ((request.headers.get("Accept") || "").includes("text/event-stream")) {
        return new Response(":ok\n\n", {
          status: 200,
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...CORS },
        });
      }
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

    console.log(
      `[rpc] ${(Array.isArray(body) ? body : [body])
        .map((m) => (m && m.method === "tools/call" ? `tools/call:${m.params?.name}` : m && m.method))
        .join(",")}`,
    );

    const wantsSse = (request.headers.get("Accept") || "").includes("text/event-stream");
    const messages = Array.isArray(body) ? body : [body];
    const responses = messages.map(handleRpc).filter((r) => r !== null);

    // Attach a session id so clients that require one for Streamable HTTP proceed.
    const headers = { "Mcp-Session-Id": SESSION_ID };

    // All notifications → just acknowledge.
    if (responses.length === 0) return new Response(null, { status: 202, headers: { ...CORS, ...headers } });

    if (wantsSse) return sseResponse(responses, { headers });
    // Non-SSE clients: single object for a single request, array for a batch.
    return jsonResponse(Array.isArray(body) ? responses : responses[0], { headers });
  },
};
