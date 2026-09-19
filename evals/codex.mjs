import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

/** Codex は過去の答案やリポジトリ運用指示を持たない専用作業領域で実行する。 */
export function generateCodex({ projectRoot, outputDir, id, prompt }) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "relay-eval-codex-"));
  const localOutput = path.join(cwd, "evals/output");
  fs.mkdirSync(localOutput, { recursive: true });
  const css = path.join(outputDir, "relay.css");
  if (fs.existsSync(css)) fs.copyFileSync(css, path.join(localOutput, "relay.css"));
  const model = process.env.EVAL_MODEL ?? "gpt-6-astra";
  const effort = process.env.EVAL_REASONING_EFFORT ?? "medium";
  const args = ["exec", "--json", "--ephemeral", "--ignore-user-config", "--skip-git-repo-check",
    "--sandbox", "workspace-write", "--model", model,
    "-c", `model_reasoning_effort=${JSON.stringify(effort)}`,
    "-c", `mcp_servers.relay-ds.command=${JSON.stringify(process.execPath)}`,
    "-c", `mcp_servers.relay-ds.args=${JSON.stringify([path.join(projectRoot, "src/mcp/server.mjs")])}`,
    "-c", "mcp_servers.relay-ds.required=true",
    // このサーバーは DS 仕様の読み取り専用。非対話実行でも取得を許可する。
    "-c", 'mcp_servers.relay-ds.default_tools_approval_mode="approve"',
    prompt];
  const started = Date.now();
  const res = spawnSync(process.env.CODEX_BIN ?? "codex", args, {
    cwd, encoding: "utf8", timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const transcript = `${res.stdout ?? ""}\n${JSON.stringify({ type: "eval.metadata", provider: "codex", model, reasoningEffort: effort, duration_ms: Date.now() - started })}\n`;
  const events = (res.stdout ?? "").split("\n").flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const completed = events.some((e) => e.type === "turn.completed");
  const failed = events.some((e) => e.type === "turn.failed");
  const approvalError = events.find((e) => e.item?.type === "mcp_tool_call" &&
    /requires approval/.test(e.item.error?.message ?? ""));
  const file = path.join(localOutput, `${id}.html`);
  const ok = !res.error && res.status === 0 && completed && !failed && !approvalError && fs.existsSync(file);
  if (ok) fs.copyFileSync(file, path.join(outputDir, `${id}.html`));
  // 一時ディレクトリはこの関数が作成したものだけを片付ける。
  fs.rmSync(cwd, { recursive: true, force: true });
  return { ok, transcript, detail: String(res.error ?? approvalError?.item.error?.message ?? (res.stdout || res.stderr || "生成物または完了イベントがありません")).slice(-1000) };
}
