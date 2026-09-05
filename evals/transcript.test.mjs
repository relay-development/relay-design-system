import test from "node:test";
import assert from "node:assert/strict";
import { summarizeTranscript, parseToolSequence } from "./transcript.mjs";

test("Codex completed items are counted once and unavailable metrics remain unknown", () => {
  const item = { id: "a", type: "mcp_tool_call", server: "relay-ds", tool: "get_component",
    arguments: { name: "button" }, result: { content: [{ type: "text", text: "button spec" }] } };
  const jsonl = [
    { type: "item.started", item }, { type: "item.completed", item },
    { type: "item.completed", item: { id: "b", type: "file_change", changes: [{ path: "a.html", kind: "add" }], status: "completed" } },
    { type: "turn.completed", usage: { input_tokens: 100, cached_input_tokens: 50, output_tokens: 20 } },
    { type: "eval.metadata", provider: "codex", duration_ms: 1234 },
  ].map(JSON.stringify).join("\n");
  const metrics = summarizeTranscript(jsonl);
  assert.deepEqual(metrics.toolCalls, { get_component: 1, apply_patch: 1 });
  assert.equal(metrics.usage.output_tokens, 20);
  assert.equal(metrics.numTurns, null);
  assert.equal(metrics.usage.output_tokens_details, undefined);
  const calls = parseToolSequence(jsonl);
  assert.equal(calls[0].input.name, "button");
  assert.match(calls[0].head, /button spec/);
  assert.equal(calls[0].at, null);
});

test("Claude metrics and timed tool sequence remain compatible", () => {
  const jsonl = [
    { type: "assistant", timestamp: "2026-09-05T00:00:00Z", message: { content: [{ type: "tool_use", id: "a", name: "mcp__relay-ds__search", input: { query: "button" } }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "a", content: "found" }] } },
    { type: "result", num_turns: 3, duration_ms: 1000, usage: { output_tokens: 42 } },
  ].map(JSON.stringify).join("\n");
  assert.equal(summarizeTranscript(jsonl).numTurns, 3);
  assert.equal(parseToolSequence(jsonl)[0].size, 5);
  assert.equal(parseToolSequence(jsonl)[0].at, 0);
});
