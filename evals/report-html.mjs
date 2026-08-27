/*
 * evals/report-html.mjs — eval 結果 + 行動ログの HTML レポート生成（LLM 不使用・無料）
 *
 *   evals/results/*.json と行動ログ（outputs/<stamp>/*.transcript.jsonl）から、
 *   人が読める 1 枚の HTML レポートを決定的に生成する。内容:
 *     1. 最新実行のサマリー（R/C 別合格率・実行条件）
 *     2. 履歴推移マトリクス（eval:report の HTML 版）
 *     3. 最新実行のお題別カード — 判定・rubric fail 理由・agentMetrics・
 *        ツール呼び出しシーケンス・「引いた仕様は使われたか」の突合
 *
 *   実行:
 *     npm run eval:report:html            # 最新実行のレポート → evals/results/report.html
 *     npm run eval:report:html -- --all   # 履歴を全件表示（既定は直近 20 件）
 *
 *   出力先は evals/results/（gitignored）。所見の書き方・アーティファクト公開の
 *   手順は .claude/skills/eval-report/SKILL.md を参照。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, kindOf } from "./cases.mjs";
import { STATUS_SYMBOL, classifyResult, isError } from "./status.mjs";
import { parseToolSequence } from "./transcript.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "results");
const showAll = process.argv.includes("--all");

/* ------------------------------------------------------------- data */

const runs = fs.existsSync(resultsDir)
  ? fs.readdirSync(resultsDir).filter((f) => f.endsWith(".json")).sort().map((f) => {
      try {
        return { file: f, stamp: f.replace(/\.json$/, ""), ...JSON.parse(fs.readFileSync(path.join(resultsDir, f), "utf8")) };
      } catch {
        return null;
      }
    }).filter(Boolean)
  : [];

if (!runs.length) {
  console.error("履歴がありません。まず npm run eval を実行してください。");
  process.exit(1);
}

const latest = runs.at(-1);
const shown = showAll ? runs : runs.slice(-20);
const kindById = new Map(CASES.map((c) => [c.id, kindOf(c)]));
const kindOfResult = (r) => r.kind ?? kindById.get(r.id) ?? "regression";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const jst = (iso) => (iso ?? "").replace("T", " ").slice(0, 16);

/** 実行 1 件の R/C 別集計 */
function tally(run) {
  const rs = run.results ?? [];
  const part = (kind) => {
    const sub = rs.filter((r) => kindOfResult(r) === kind);
    const st = sub.map(classifyResult);
    return { pass: st.filter((s) => s === "pass").length, total: sub.length - st.filter(isError).length, err: st.filter(isError).length };
  };
  return { R: part("regression"), C: part("capability") };
}

/** 突合: transcript で get_component したコンポーネント名 × 生成 HTML で使われたクラス */
function matchFetchedToUsed(seq, htmlPath) {
  const fetched = seq.filter((c) => c.name === "get_component" && c.input?.name).map((c) => String(c.input.name));
  if (!fetched.length || !fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, "utf8");
  const used = new Set();
  for (const m of html.matchAll(/class\s*=\s*["']([^"']*)["']/g)) for (const t of m[1].split(/\s+/)) if (t) used.add(t);
  // コンポーネント名 → クラス接頭辞のゆるい対応（icon-button → icon-btn 等の別名も見る）
  const prefixesFor = (name) => [name, name.replace("-button", "-btn"), name.replace("button", "btn"), `typo-`].slice(0, name === "typography" ? 4 : 3);
  return [...new Set(fetched)].map((name) => {
    const hits = [...used].filter((cls) => prefixesFor(name).some((p) => cls === p || cls.startsWith(`${p}-`) || (name === "typography" && cls.startsWith("typo-"))));
    return { name, used: hits.slice(0, 3) };
  });
}

/** トライアル 1 件（= 採点 1 回分）の詳細 HTML */
function trialHtml(r, label) {
  const status = classifyResult(r);
  const seqPath = r.transcript ? path.join(resultsDir, r.transcript) : null;
  const seq = seqPath && fs.existsSync(seqPath) ? parseToolSequence(fs.readFileSync(seqPath, "utf8")) : [];
  const m = r.agentMetrics ?? {};
  const htmlPath = r.output ? path.join(resultsDir, r.output) : null;
  const match = seq.length && htmlPath ? matchFetchedToUsed(seq, htmlPath) : null;

  const failParts = [];
  if (r.hardcode && !r.hardcode.pass) failParts.push(`hardcode: ${esc((r.hardcode.detail ?? []).slice(0, 3).join(" / "))}`);
  if (r.classes && !r.classes.pass) failParts.push(`classes: ${esc([...(r.classes.missing ?? []).map((x) => `必須不足 ${x}`), ...(r.classes.invented ?? []).map((x) => `捏造 ${x}`)].join(", "))}`);
  if (r.patterns && !r.patterns.pass) failParts.push(`patterns: ${esc((r.patterns.failed ?? []).join(" / "))}`);
  for (const it of r.rubric?.items ?? []) if (!it.pass) failParts.push(`rubric: ${esc(it.text)}${it.reason ? ` — ${esc(it.reason)}` : ""}`);

  const seqRows = seq.map((c) => {
    const input = c.name === "get_component" ? c.input?.name
      : c.input?.topic ? `topic: ${c.input.topic}`
      : c.input?.query ? `「${c.input.query}」`
      : c.input?.category ?? (Object.keys(c.input ?? {}).length ? JSON.stringify(c.input).slice(0, 40) : "—");
    return `<tr><td class="t">${c.at ?? "?"}s</td><td class="mono">${esc(c.name)}</td><td class="in">${esc(input)}</td><td class="t">${c.size?.toLocaleString() ?? "?"} 字</td></tr>`;
  }).join("");

  return `
  <details class="trial" ${status !== "pass" ? "open" : ""}>
    <summary><span class="sym s-${status.replace(":", "-")}">${STATUS_SYMBOL[status]}</span> ${esc(label)}
      <span class="meta">${m.numTurns ?? "?"} turns / ${m.durationMs ? Math.round(m.durationMs / 1000) + "s" : "?"} / 出力 ${m.usage?.output_tokens?.toLocaleString() ?? "?"} tok</span>
    </summary>
    ${failParts.length ? `<ul class="fails">${failParts.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
    ${seqRows ? `<table class="seq"><thead><tr><th>経過</th><th>ツール</th><th>入力</th><th>応答</th></tr></thead><tbody>${seqRows}</tbody></table>` : "<p class='muted'>行動ログなし（--skip-generate の再採点、または導入前の実行）</p>"}
    ${match ? `<p class="match">突合: ${match.map((x) => x.used.length ? `<span class="ok">✓ ${esc(x.name)}</span>` : `<span class="ng">✗ ${esc(x.name)}（未使用）</span>`).join(" ")}</p>` : ""}
  </details>`;
}

/* ------------------------------------------------------------- html */

const t = tally(latest);
const hasCapability = (latest.results ?? []).some((r) => kindOfResult(r) === "capability");
const headline = hasCapability
  ? `regression ${t.R.pass}/${t.R.total} ・ capability ${t.C.pass}/${t.C.total}${t.R.err + t.C.err ? `（測定不能 ${t.R.err + t.C.err}）` : ""}`
  : `${t.R.pass + t.C.pass}/${t.R.total + t.C.total} PASS`;

const ids = CASES.map((c) => c.id);
for (const run of shown) for (const r of run.results ?? []) if (!ids.includes(r.id)) ids.push(r.id);

const matrixHead = ids.map((i) => `<th class="rot"><span>${esc(i)}</span></th>`).join("");
const matrixRows = shown.slice().reverse().map((run) => {
  const byId = new Map((run.results ?? []).map((r) => [r.id, r]));
  const cells = ids.map((i) => {
    const r = byId.get(i);
    if (!r) return `<td class="none">－</td>`;
    const s = classifyResult(r);
    return `<td class="s-${s.replace(":", "-")}">${STATUS_SYMBOL[s]}</td>`;
  }).join("");
  return `<tr><td class="t">${jst(run.ranAt ?? run.stamp)}${run.skipJudge ? " *" : ""}</td>${cells}</tr>`;
}).join("");

const cards = (latest.results ?? []).map((r) => {
  const kind = kindOfResult(r);
  const trials = r.trials ?? [r];
  return `
  <section class="case">
    <h3><span class="chip k-${kind}">${kind}</span> <span class="mono">${esc(r.id)}</span>
      <span class="sym s-${classifyResult(r).replace(":", "-")}">${STATUS_SYMBOL[classifyResult(r)]}</span>
      ${r.trials ? `<span class="meta">pass^${trials.length}</span>` : ""}</h3>
    ${trials.map((tr, i) => trialHtml(tr, r.trials ? `trial ${i + 1}` : "実行")).join("")}
  </section>`;
}).join("");

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>relay evals レポート ${esc(jst(latest.ranAt ?? latest.stamp))}</title>
<style>
:root{--bg:#fff;--panel:#f8fafc;--ink:#0f172a;--mid:#334155;--low:#64748b;--line:#e2e8f0;
--pass:#15803d;--pass-bg:#f0fdf4;--fail:#b91c1c;--fail-bg:#fef2f2;--err:#64748b;--err-bg:#f8fafc;
--accent:#1b805e;--accent-bg:#eef9f4;--warn:#b45309;--warn-bg:#fffbeb}
@media(prefers-color-scheme:dark){:root{--bg:#0f172a;--panel:#1e293b;--ink:#f1f5f9;--mid:#cbd5e1;--low:#94a3b8;--line:#2c3a52;
--pass:#86efac;--pass-bg:rgba(34,197,94,.12);--fail:#fca5a5;--fail-bg:rgba(239,68,68,.12);--err:#94a3b8;--err-bg:rgba(148,163,184,.08);
--accent:#4cbb90;--accent-bg:rgba(48,182,134,.1);--warn:#fcd34d;--warn-bg:rgba(245,158,11,.1)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--mid);font:14px/1.7 "Hiragino Sans",sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:20px;color:var(--ink)}h2{font-size:15px;color:var(--ink);margin:36px 0 8px}
.mono{font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.muted{color:var(--low);font-size:12px}.meta{color:var(--low);font-size:11.5px;font-weight:400;margin-left:8px}
.headline{font-size:16px;padding:12px 16px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink)}
.cond{font-size:12px;color:var(--low);margin-top:6px}
table{border-collapse:collapse;font-size:12.5px}.matrix-wrap,.seq{overflow-x:auto}
.matrix td,.matrix th{border-bottom:1px solid var(--line);padding:4px 8px;text-align:center}
.matrix td.t{text-align:left;white-space:nowrap;color:var(--low);font-size:11.5px}
.rot span{writing-mode:vertical-rl;font-size:11px;color:var(--low);font-weight:400}
.s-pass{color:var(--pass)}.s-fail{color:var(--fail);font-weight:700}.s-error-generation,.s-error-judge{color:var(--err)}.none{color:var(--line)}
.case{border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:10px 0;background:var(--bg)}
.case h3{font-size:13.5px;color:var(--ink);margin:0 0 4px;display:flex;align-items:center;gap:8px}
.chip{font-size:10.5px;font-weight:700;border-radius:999px;padding:0 8px}
.k-regression{color:var(--accent);background:var(--accent-bg)}.k-capability{color:var(--warn);background:var(--warn-bg)}
.sym{font-weight:700}
.trial{margin:6px 0;border-top:1px dashed var(--line);padding-top:6px}
.trial summary{cursor:pointer;font-size:12.5px}
.fails{margin:6px 0;padding-left:20px;color:var(--fail);font-size:12.5px}
.seq{width:100%;margin-top:6px}.seq th{font-size:10.5px;color:var(--low);text-align:left;padding:2px 8px;border-bottom:1px solid var(--line)}
.seq td{padding:2px 8px;border-bottom:1px solid var(--line);font-size:12px}.seq .t{text-align:right;white-space:nowrap;color:var(--low)}
.seq .in{color:var(--low);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.match{font-size:12px;margin:8px 0 2px}.match .ok{color:var(--pass);margin-right:8px}.match .ng{color:var(--fail);font-weight:700;margin-right:8px}
footer{margin-top:40px;border-top:1px solid var(--line);padding-top:10px;font-size:11.5px;color:var(--low)}
</style></head><body><div class="wrap">
<h1>relay evals レポート</h1>
<p class="muted">生成: このファイルは <span class="mono">npm run eval:report:html</span> による自動生成（正本: evals/results/）</p>
<div class="headline"><b>${headline}</b>
<div class="cond">${esc(jst(latest.ranAt ?? latest.stamp))} 実行 ・ model: ${esc(latest.model ?? "?")} ・ judge: ${esc(latest.judgeModel ?? "なし(--skip-judge)")} ・ votes ${latest.votes ?? 1} ・ trials ${latest.trials ?? 1} ・ v${esc(latest.dsVersion ?? "?")}</div></div>

<h2>履歴推移（新しい順・${shown.length}/${runs.length} 件${showAll ? "" : "。全件は --all"}）</h2>
<div class="matrix-wrap"><table class="matrix"><thead><tr><th></th>${matrixHead}</tr></thead><tbody>${matrixRows}</tbody></table></div>
<p class="muted">✓ PASS / ✗ FAIL（品質） / G 生成失敗 / J 審査不能（G/J は品質シグナルでない） / － 対象外 / * は機械チェックのみ</p>

<h2>最新実行の詳細（お題別）</h2>
${cards}

<footer>relay Design System evals ・ 読み方は evals/README.md、切り分けは「知識 / 基準 / お題」の 3 方向（分水嶺: 正しい知識を持つ理想のエージェントなら安定して合格できるか）</footer>
</div></body></html>`;

const outPath = path.join(resultsDir, "report.html");
fs.writeFileSync(outPath, html);
console.log(`evals/results/report.html を生成しました（${(html.length / 1024).toFixed(0)}KB・対象 ${latest.results?.length ?? 0} お題）`);
