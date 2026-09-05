/*
 * evals/transcript.mjs — 行動ログ（stream-json トランスクリプト）の解析（run.mjs / report-html.mjs 共用）
 *
 *   生成エージェントの行動ログから、ツール呼び出しの集計（agentMetrics）と
 *   時系列のシーケンス（レポート表示用）を取り出す。解析できない行は読み飛ばし、
 *   集計不能でも呼び出し側の処理は続行できる（診断用の付加情報という位置づけ）。
 */

/** ツール呼び出し内訳・ターン数等を集計する（結果 JSON の agentMetrics になる） */
export function summarizeTranscript(jsonl) {
  jsonl = normalizeCodex(jsonl);
  const toolCalls = {};
  let numTurns = null;
  let durationMs = null;
  let usage = null;
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    if (ev.type === "assistant") {
      for (const block of ev.message?.content ?? []) {
        if (block.type !== "tool_use") continue;
        const name = String(block.name).replace(/^mcp__relay-ds__/, "");
        toolCalls[name] = (toolCalls[name] ?? 0) + 1;
      }
    } else if (ev.type === "result") {
      numTurns = ev.num_turns ?? null;
      durationMs = ev.duration_ms ?? null;
      usage = ev.usage ?? null;
    }
  }
  return { toolCalls, numTurns, durationMs, usage };
}

/**
 * 時系列のツール呼び出しシーケンスを取り出す（レポートの表用）。
 * 各要素: { at: 開始からの秒, name, input, size: tool_result の文字数, head: 応答冒頭 160 字 }
 */
export function parseToolSequence(jsonl) {
  jsonl = normalizeCodex(jsonl);
  const calls = [];
  const pending = new Map();
  let t0 = null;
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    let ev;
    try {
      ev = JSON.parse(line);
    } catch {
      continue;
    }
    const ts = ev.timestamp ? Date.parse(ev.timestamp) : null;
    if (ts && t0 === null) t0 = ts;
    if (ev.type === "assistant") {
      for (const block of ev.message?.content ?? []) {
        if (block.type !== "tool_use") continue;
        const call = {
          at: ts && t0 !== null ? +((ts - t0) / 1000).toFixed(1) : null,
          name: String(block.name).replace(/^mcp__relay-ds__/, ""),
          input: block.input ?? {},
          size: null,
        };
        calls.push(call);
        pending.set(block.id, call);
      }
    } else if (ev.type === "user" && Array.isArray(ev.message?.content)) {
      for (const block of ev.message.content) {
        if (block.type !== "tool_result" || !pending.has(block.tool_use_id)) continue;
        const text = typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "");
        const call = pending.get(block.tool_use_id);
        call.size = text.length;
        call.head = text.slice(0, 160); // シグナル自動検出用（「ヒットなし」等の検知）
      }
    }
  }
  return calls;
}

/** 生の Codex JSONL は保存したまま、共通ビュー用のイベントへ変換する。 */
function normalizeCodex(jsonl) {
  const events = jsonl.split("\n").flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  if (!events.some((e) => e.type === "eval.metadata" && e.provider === "codex")) return jsonl;
  const normalized = [];
  let usage = null;
  for (const e of events) {
    if (e.type === "turn.completed" && e.usage) {
      usage = e.usage;
    }
    if (e.type !== "item.completed") continue;
    const item = e.item ?? {};
    let name, input, content;
    if (item.type === "mcp_tool_call") {
      name = item.server === "relay-ds" ? item.tool : `${item.server}.${item.tool}`;
      input = item.arguments;
      content = item.result ?? item.error;
    } else if (item.type === "command_execution") {
      name = "Bash";
      input = { command: item.command };
      content = item.aggregated_output;
    } else if (item.type === "file_change") {
      name = "apply_patch";
      input = { changes: item.changes };
      content = item.status;
    } else continue;
    normalized.push({ type: "assistant", message: { content: [{ type: "tool_use", id: item.id, name, input }] } });
    normalized.push({ type: "user", message: { content: [{ type: "tool_result", tool_use_id: item.id, content }] } });
  }
  const meta = events.find((e) => e.type === "eval.metadata");
  normalized.push({ type: "result", duration_ms: meta.duration_ms,
    // Codex の turn はユーザーターン。Claude の num_turns と互換でないので不明扱い。
    num_turns: null, usage: usage ? { ...usage,
      cache_read_input_tokens: usage.cached_input_tokens ?? null,
      output_tokens_details: usage.reasoning_output_tokens == null ? undefined : { thinking_tokens: usage.reasoning_output_tokens },
    } : null });
  return normalized.map((e) => JSON.stringify(e)).join("\n");
}
