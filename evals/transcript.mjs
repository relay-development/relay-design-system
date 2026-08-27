/*
 * evals/transcript.mjs — 行動ログ（stream-json トランスクリプト）の解析（run.mjs / report-html.mjs 共用）
 *
 *   生成エージェントの行動ログから、ツール呼び出しの集計（agentMetrics）と
 *   時系列のシーケンス（レポート表示用）を取り出す。解析できない行は読み飛ばし、
 *   集計不能でも呼び出し側の処理は続行できる（診断用の付加情報という位置づけ）。
 */

/** ツール呼び出し内訳・ターン数等を集計する（結果 JSON の agentMetrics になる） */
export function summarizeTranscript(jsonl) {
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
 * 各要素: { at: 開始からの秒, name, input, size: tool_result の文字数 }
 */
export function parseToolSequence(jsonl) {
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
        pending.get(block.tool_use_id).size = text.length;
      }
    }
  }
  return calls;
}
