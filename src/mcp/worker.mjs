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
 *   Dual-era server (spec 2026-07-28 "Versioning and Compatibility"):
 *     - Modern era (2026-07-28+): the request carries its protocol version in
 *       params._meta["io.modelcontextprotocol/protocolVersion"]. Served fully
 *       statelessly — server/discover, resultType on every result, ttlMs/cacheScope
 *       cache hints, header↔body validation (Mcp-Method / Mcp-Name /
 *       MCP-Protocol-Version), no session ids. INSTRUCTIONS are delivered via
 *       server/discover (the modern replacement for the initialize handshake).
 *     - Legacy era (≤2025-11-25): the client opens with `initialize`. Served with
 *       the previous handshake semantics — instructions in the initialize result,
 *       Mcp-Session-Id echo, idle GET SSE stream.
 *     Era is detected per request from the presence of the modern _meta key, as the
 *     spec prescribes for dual-era servers.
 *
 *   Transport notes (Streamable HTTP):
 *     - POST /mcp with a JSON-RPC request. If the client's Accept header includes
 *       text/event-stream (claude.ai does), the response is sent as a single SSE
 *       `event: message` frame; otherwise as application/json. Some clients only
 *       invoke tools when the response arrives over SSE, so we honor Accept.
 *     - subscriptions/listen is acknowledged with an empty honored filter and
 *       gracefully closed: the catalog is baked into the bundle at build time, so
 *       nothing ever changes within a deploy and there is nothing to notify about.
 *
 *   Deploy:  npm run deploy:mcp   ·   Local: npm run dev:mcp-remote
 *   Add to claude.ai: Settings → Connectors → Add custom connector → <url>/mcp
 */

import {
  SERVER_INFO,
  INSTRUCTIONS,
  TOOLS,
  PROMPTS,
  callTool,
  listResources,
  readResource,
  getPrompt,
} from "./handlers.mjs";

/** Protocol versions accepted as per-request _meta (modern era). */
const MODERN_VERSIONS = ["2026-07-28"];
/** Fallback echoed to legacy clients that omit protocolVersion in initialize. */
const LEGACY_DEFAULT_PROTOCOL = "2025-06-18";
/** Legacy era only — stateless, but a stable id satisfies clients that require one. */
const SESSION_ID = "relay-ds";

const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";
const META_SUBSCRIPTION_ID = "io.modelcontextprotocol/subscriptionId";

const CAPABILITIES = { tools: {}, resources: {}, prompts: {} };

// CacheableResult hints (required on list/read results since 2026-07-28). The
// catalog is generated at build time and immutable per deploy, so a long public
// TTL is safe and lets clients skip re-polling.
const CACHE_HINTS = { ttlMs: 3_600_000, cacheScope: "public" };

// JSON-RPC error codes (2026-07-28 error code allocation).
const E_METHOD_NOT_FOUND = -32601;
const E_INVALID_PARAMS = -32602;
const E_HEADER_MISMATCH = -32020;
const E_UNSUPPORTED_VERSION = -32022;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Authorization",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

const ok = (id, result) => ({ jsonrpc: "2.0", id, result });
const err = (id, code, message, data) => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS, ...headers },
  });
}

/** Send one or more JSON-RPC messages as Server-Sent Events (single response, then close). */
function sseResponse(messages, { headers = {} } = {}) {
  const body = messages.map((m) => `event: message\ndata: ${JSON.stringify(m)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
      ...CORS,
      ...headers,
    },
  });
}

/* ------------------------------------------------------------------------- *
 *  Legacy era (initialize handshake, ≤2025-11-25)
 * ------------------------------------------------------------------------- */

/** Handle a single legacy JSON-RPC request object. Returns a response object, or null for notifications. */
function handleLegacyRpc(msg) {
  const { id, method, params = {} } = msg;

  // Notifications (no response expected) — e.g. notifications/initialized.
  if (id === undefined || id === null) return null;

  switch (method) {
    case "initialize":
      return ok(id, {
        // Echo the client's requested version (our methods are version-agnostic).
        protocolVersion:
          typeof params.protocolVersion === "string"
            ? params.protocolVersion
            : LEGACY_DEFAULT_PROTOCOL,
        capabilities: CAPABILITIES,
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
        return err(id, E_INVALID_PARAMS, e.message);
      }
    case "prompts/list":
      return ok(id, { prompts: PROMPTS });
    case "prompts/get":
      try {
        return ok(id, getPrompt(params.name, params.arguments || {}));
      } catch (e) {
        return err(id, E_INVALID_PARAMS, e.message);
      }
    default:
      return err(id, E_METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

/* ------------------------------------------------------------------------- *
 *  Modern era (per-request _meta, 2026-07-28)
 * ------------------------------------------------------------------------- */

/** Decode the `=?base64?...?=` sentinel format used for non-ASCII header values. */
function decodeSentinel(value) {
  const m = /^=\?base64\?(.*)\?=$/.exec(value);
  if (!m) return value;
  try {
    const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return value;
  }
}

/**
 * Header↔body validation required by the Streamable HTTP transport ("Server
 * Validation"). Returns a human-readable mismatch description, or null if valid.
 */
function validateModernHeaders(headers, method, params) {
  const versionHeader = headers.get("mcp-protocol-version");
  if (!versionHeader) return "Missing required header: MCP-Protocol-Version";
  const bodyVersion = params._meta[META_VERSION];
  if (versionHeader !== bodyVersion)
    return `Header mismatch: MCP-Protocol-Version header value '${versionHeader}' does not match body value '${bodyVersion}'`;

  const methodHeader = headers.get("mcp-method");
  if (!methodHeader) return "Missing required header: Mcp-Method";
  if (methodHeader !== method)
    return `Header mismatch: Mcp-Method header value '${methodHeader}' does not match body value '${method}'`;

  if (method === "tools/call" || method === "resources/read" || method === "prompts/get") {
    const bodyName = method === "resources/read" ? params.uri : params.name;
    const nameHeader = headers.get("mcp-name");
    if (nameHeader === null) return "Missing required header: Mcp-Name";
    if (decodeSentinel(nameHeader) !== bodyName)
      return `Header mismatch: Mcp-Name header value '${nameHeader}' does not match body value '${bodyName}'`;
  }

  return null;
}

/** Wrap a method result into a modern-era result: resultType + serverInfo in _meta. */
const modernResult = (result) => ({
  resultType: "complete",
  ...result,
  _meta: { [META_SERVER_INFO]: SERVER_INFO, ...(result._meta || {}) },
});

const MODERN_METHODS = {
  "server/discover": () => ({
    supportedVersions: MODERN_VERSIONS,
    capabilities: CAPABILITIES,
    // Standing guidance for LLMs — the modern-era home of what legacy clients
    // received in the initialize result.
    instructions: INSTRUCTIONS,
    ...CACHE_HINTS,
  }),
  "tools/list": () => ({ tools: TOOLS, ...CACHE_HINTS }),
  "tools/call": (params) => {
    const r = callTool(params.name, params.arguments || {});
    const content = [{ type: "text", text: r.text }];
    return r.isError ? { content, isError: true } : { content };
  },
  "resources/list": () => ({ resources: listResources(), ...CACHE_HINTS }),
  "resources/read": (params) => ({ contents: [readResource(params.uri)], ...CACHE_HINTS }),
  "prompts/list": () => ({ prompts: PROMPTS, ...CACHE_HINTS }),
  "prompts/get": (params) => getPrompt(params.name, params.arguments || {}),
};

/**
 * subscriptions/listen — acknowledge with an empty honored filter (we support no
 * notification types: the catalog is immutable per deploy), then close the
 * subscription gracefully with the empty response the spec defines for
 * server-initiated closure.
 */
function subscriptionsListen(id) {
  const subMeta = { [META_SUBSCRIPTION_ID]: id };
  const ack = {
    jsonrpc: "2.0",
    method: "notifications/subscriptions/acknowledged",
    params: { _meta: subMeta, notifications: {} },
  };
  const close = ok(id, modernResult({ _meta: subMeta }));
  return sseResponse([ack, close]);
}

/** Handle a single modern JSON-RPC message. Returns the full HTTP Response. */
function handleModernPost(msg, request, wantsSse) {
  const { id, method, params = {} } = msg;

  // The modern core defines no client-to-server notifications over Streamable
  // HTTP, but the transport rule for any accepted notification is 202.
  if (id === undefined || id === null) return new Response(null, { status: 202, headers: CORS });

  const mismatch = validateModernHeaders(request.headers, method, params);
  if (mismatch) return jsonResponse(err(id, E_HEADER_MISMATCH, mismatch), { status: 400 });

  const requested = params._meta[META_VERSION];
  if (!MODERN_VERSIONS.includes(requested)) {
    return jsonResponse(
      err(id, E_UNSUPPORTED_VERSION, "Unsupported protocol version", {
        supported: MODERN_VERSIONS,
        requested,
      }),
      { status: 400 },
    );
  }

  if (method === "subscriptions/listen") return subscriptionsListen(id);

  const handler = MODERN_METHODS[method];
  if (!handler) {
    return jsonResponse(err(id, E_METHOD_NOT_FOUND, `Method not found: ${method}`), {
      status: 404,
    });
  }

  let response;
  try {
    response = ok(id, modernResult(handler(params)));
  } catch (e) {
    response = err(id, E_INVALID_PARAMS, e.message);
  }
  return wantsSse ? sseResponse([response]) : jsonResponse(response);
}

/* ------------------------------------------------------------------------- */

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

    // GET /mcp opens the legacy server→client SSE stream (removed in 2026-07-28,
    // kept for legacy clients). We have no server-initiated messages, so return
    // an open-then-idle empty stream (200) rather than 405, which stricter
    // legacy clients treat as a failure.
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

    // Era detection (per request, as the spec prescribes for dual-era servers):
    // a modern request is a single message carrying the protocol version in _meta.
    // Batches only existed in legacy revisions, so arrays always take the legacy path.
    if (!Array.isArray(body) && typeof body?.params?._meta?.[META_VERSION] === "string") {
      return handleModernPost(body, request, wantsSse);
    }

    const messages = Array.isArray(body) ? body : [body];
    const responses = messages.map(handleLegacyRpc).filter((r) => r !== null);

    // Attach a session id so legacy clients that require one for Streamable HTTP proceed.
    const headers = { "Mcp-Session-Id": SESSION_ID };

    // All notifications → just acknowledge.
    if (responses.length === 0)
      return new Response(null, { status: 202, headers: { ...CORS, ...headers } });

    if (wantsSse) return sseResponse(responses, { headers });
    // Non-SSE clients: single object for a single request, array for a batch.
    return jsonResponse(Array.isArray(body) ? responses : responses[0], { headers });
  },
};
