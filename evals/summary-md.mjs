/**
 * evals/summary-md.mjs — 結果 JSON 1 件を PR コメント用の Markdown に要約する（LLM 不使用）。
 *
 *   node evals/summary-md.mjs [evals/results/<stamp>.json]   # 省略時は最新
 *
 * CI ゲート（.github/workflows/eval-gate.yml）が PR にコメントするために使う。
 * 合否の行に加え、落ちたお題は「何が落ちたか」（必須クラス不足 / 禁止パターン / ハードコード /
 * rubric の不合格項目と理由）を並べ、行動ログ指標（ターン / Bash / search / relay.css の grep）も出す。
 * 判定の分類規則は status.mjs が正本。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyResult, STATUS_SYMBOL } from "./status.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "results");

const arg = process.argv[2];
const file = arg
  ? path.resolve(arg)
  : (() => {
      const files = fs.readdirSync(resultsDir).filter((f) => /^\d{4}-.*\.json$/.test(f)).sort();
      if (!files.length) throw new Error("evals/results に結果がありません");
      return path.join(resultsDir, files.at(-1));
    })();
const run = JSON.parse(fs.readFileSync(file, "utf8"));
const stamp = path.basename(file, ".json");

const isRelayCssGrep = (cmd) => /\bgrep\b/.test(cmd ?? "") && /relay\.css/.test(cmd ?? "");
function grepCount(r) {
  if (!r.transcript) return null;
  const p = path.join(resultsDir, r.transcript);
  if (!fs.existsSync(p)) return null;
  let n = 0;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type !== "assistant") continue;
    for (const b of ev.message?.content ?? []) if (b.type === "tool_use" && b.name === "Bash" && isRelayCssGrep(b.input?.command)) n++;
  }
  return n;
}
const primary = (r) => (r.trials ? r.trials[0] : r);
const fmt = (v) => (v == null ? "—" : String(v));

const rows = [];
const failures = [];
for (const r of run.results ?? []) {
  const st = classifyResult(r);
  const p = primary(r);
  const tc = p.agentMetrics?.toolCalls ?? {};
  rows.push(
    `| \`${r.id}\` | ${r.kind ?? "regression"} | ${STATUS_SYMBOL[st] ?? st} ${st} | ${fmt(p.agentMetrics?.numTurns)} | ${fmt(tc.Bash ?? 0)} | ${fmt(tc.search ?? 0)} | ${fmt(grepCount(p))} |`,
  );
  if (st === "pass") continue;
  const why = [];
  const trialsToCheck = r.trials ?? [r];
  for (const [i, t] of trialsToCheck.entries()) {
    const tag = r.trials ? ` (trial ${i + 1})` : "";
    if (t.generated === false) why.push(`生成失敗${tag}: ${t.error ?? "生成物なし（ハーネス起因の可能性）"}`);
    if (t.classes?.pass === false) why.push(`必須クラス不足${tag}: ${t.classes.missing.map((c) => `\`${c}\``).join(", ")}${t.classes.invented?.length ? `／独自クラス: ${t.classes.invented.map((c) => `\`${c}\``).join(", ")}` : ""}`);
    if (t.patterns?.pass === false) why.push(`禁止/必須パターン${tag}: ${t.patterns.failed.join("、")}`);
    if (t.hardcode?.pass === false) why.push(`ハードコード${tag}: ${(t.hardcode.detail ?? []).slice(0, 3).map((d) => (typeof d === "string" ? d : JSON.stringify(d))).join("、")}${(t.hardcode.detail ?? []).length > 3 ? " …" : ""}`);
    for (const it of t.rubric?.items ?? []) if (it.pass === false) why.push(`rubric${tag}: ${it.text}${it.reason ? `（${it.reason}）` : ""}`);
    if (t.rubric?.error) why.push(`審査エラー${tag}: ${t.rubric.error}`);
  }
  failures.push(`- **${r.id}**（${r.kind ?? "regression"}）\n${why.map((w) => `  - ${w}`).join("\n") || "  - 詳細なし"}`);
}

const regr = (run.results ?? []).filter((r) => (r.kind ?? "regression") === "regression");
const cap = (run.results ?? []).filter((r) => r.kind === "capability");
const passN = (xs) => xs.filter((r) => classifyResult(r) === "pass").length;
const errN = (xs) => xs.filter((r) => /^error:/.test(classifyResult(r))).length;
const gate = regr.length && passN(regr) === regr.length && !errN(regr) ? "✅ PASS" : "❌ FAIL";

console.log(
  [
    `## agent eval — ${gate}`,
    "",
    `regression **${passN(regr)}/${regr.length}**${errN(regr) ? `（うち測定エラー ${errN(regr)}）` : ""}` +
      (cap.length ? ` ・ capability ${passN(cap)}/${cap.length}（ゲート対象外）` : "") +
      ` ・ model: ${run.model ?? "?"} ・ judge: ${run.judgeModel ?? "なし"} ・ trials ${run.trials ?? 1} ・ votes ${run.votes ?? 1} ・ DS v${run.dsVersion ?? "?"} ・ ${stamp}`,
    "",
    "| お題 | kind | 判定 | ターン | Bash | search | grep(relay.css) |",
    "|---|---|---|---|---|---|---|",
    ...rows,
    "",
    failures.length ? `### 落ちたお題の内訳\n\n${failures.join("\n")}` : "落ちたお題はありません。",
    "",
    "<sub>ゲートは regression の全 PASS（測定エラー含まず）。Bash / grep(relay.css) は「実 CSS を覗いた回数」で少ないほど MCP の知識で組めている。生成物・行動ログ・HTML レポートはワークフローの Artifact（eval-results）に保存。切り分け（知識 / 採点基準 / お題）は .claude/skills/eval-report を参照。</sub>",
  ].join("\n"),
);
