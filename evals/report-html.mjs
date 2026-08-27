/*
 * evals/report-html.mjs — eval 結果 + 行動ログの HTML レポート生成（LLM 不使用・無料）
 *
 *   evals/results/*.json と行動ログ（outputs/<stamp>/*.transcript.jsonl）から、
 *   人が読める 1 枚の HTML レポートを決定的に生成する。内容:
 *     1. 対象実行の計測サマリー（R/C 別合格率・実行条件）
 *     2. 履歴推移マトリクス（kind = regression / capability を列グループで明示）
 *     3. お題別カード — 判定・fail 理由・計測タイル・タイムライン・
 *        ツール呼び出しシーケンス・「引いた仕様は使われたか」の突合・
 *        自動検出シグナル（空振り / 巨大応答 / 未使用 / 前回からの変化）
 *
 *   シグナルは機械的な「候補の検出」まで。改善と呼ぶかの切り分け（知識/基準/お題）は
 *   人と AI の所見で行う（手順: .claude/skills/eval-report/SKILL.md）。
 *
 *   実行:
 *     npm run eval:report:html                    # 最新実行 → evals/results/report.html
 *     npm run eval:report:html -- --stamp <接頭辞> # 過去の実行を指定（例: 2026-08-25T06-18）
 *     npm run eval:report:html -- --case <id>     # お題で絞り込み
 *     npm run eval:report:html -- --all           # 履歴マトリクスを全件表示（既定 20 件）
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, kindOf } from "./cases.mjs";
import { STATUS_SYMBOL, classifyResult, isError } from "./status.mjs";
import { parseToolSequence } from "./transcript.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "results");

const args = process.argv.slice(2);
const showAll = args.includes("--all");
const stampArg = args.includes("--stamp") ? args[args.indexOf("--stamp") + 1] : null;
const caseArg = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;

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

const target = stampArg ? runs.find((r) => r.stamp.startsWith(stampArg)) : runs.at(-1);
if (!target) {
  console.error(`--stamp "${stampArg}" に一致する実行がありません。候補: ${runs.slice(-5).map((r) => r.stamp).join(", ")}`);
  process.exit(1);
}
const prev = runs.filter((r) => r.stamp < target.stamp).at(-1) ?? null;

const kindById = new Map(CASES.map((c) => [c.id, kindOf(c)]));
const kindOfResult = (r) => r.kind ?? kindById.get(r.id) ?? "regression";
const targetResults = (target.results ?? []).filter((r) => !caseArg || r.id === caseArg);
if (!targetResults.length) {
  console.error(`対象実行に ${caseArg ? `お題 "${caseArg}" の` : ""}結果がありません。`);
  process.exit(1);
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* 生成された画面を iframe 表示するため、対象実行のアーカイブへ relay.css を置く
 *（生成物は <link href="./relay.css"> を参照している。コピーは冪等） */
const builtCss = path.resolve(__dirname, "../dist/relay.css");
const cssReady = fs.existsSync(builtCss);
if (cssReady) {
  const dirs = new Set(targetResults.flatMap((r) => (r.trials ?? [r]).map((t) => t.output && path.dirname(path.join(resultsDir, t.output)))).filter(Boolean));
  for (const d of dirs) if (fs.existsSync(d)) fs.copyFileSync(builtCss, path.join(d, "relay.css"));
} else {
  console.warn("⚠ dist/relay.css がありません（npm run build で生成）。画面プレビューはスタイルなしになります。");
}
const jst = (iso) => (iso ?? "").replace("T", " ").slice(0, 16);

/* ---- ツール分類（アーティファクトの可視化と同じ区分・配色） ---- */
const CAT_OF = (name) => {
  if (name === "get_component") return "comp";
  if (name === "get_accessibility") return "a11y";
  if (name === "list_assets" || name === "search") return "asset";
  if (name === "Write" || name === "Edit") return "write";
  if (/^get_|^list_/.test(name)) return "found";
  return "harness";
};
const CAT_LABEL = { harness: "ハーネス", found: "基盤知識", comp: "コンポーネント仕様", asset: "アセット・検索", a11y: "アクセシビリティ", write: "書き出し" };

/* ---- 集計 ---- */
function tally(run) {
  const part = (kind) => {
    const sub = (run.results ?? []).filter((r) => kindOfResult(r) === kind);
    const st = sub.map(classifyResult);
    return { pass: st.filter((s) => s === "pass").length, total: sub.length - st.filter(isError).length, err: st.filter(isError).length };
  };
  return { R: part("regression"), C: part("capability") };
}

/* ---- 突合 ---- */
function matchFetchedToUsed(seq, htmlPath) {
  const fetched = [...new Set(seq.filter((c) => c.name === "get_component" && c.input?.name).map((c) => String(c.input.name)))];
  if (!fetched.length || !htmlPath || !fs.existsSync(htmlPath)) return null;
  const html = fs.readFileSync(htmlPath, "utf8");
  const used = new Set();
  for (const m of html.matchAll(/class\s*=\s*["']([^"']*)["']/g)) for (const t of m[1].split(/\s+/)) if (t) used.add(t);
  const prefixesFor = (name) =>
    name === "typography" ? ["typo-"] : [name, name.replace("-button", "-btn"), name.replace(/^button$/, "btn")];
  return fetched.map((name) => {
    const hit = [...used].find((cls) => prefixesFor(name).some((p) => cls === p || cls.startsWith(`${p}-`) || (p.endsWith("-") && cls.startsWith(p))));
    return { name, used: !!hit, sample: hit ?? null };
  });
}

/* ---- シグナル自動検出（候補の検出まで。切り分けは所見で） ---- */
function detectSignals(seq, match, r, prevResult) {
  const signals = [];
  const totalSize = seq.reduce((n, c) => n + (c.size ?? 0), 0);
  for (const c of seq) {
    if (c.name === "search" && ((c.size ?? 0) < 300 || /ヒットなし/.test(c.head ?? ""))) {
      signals.push(`search の空振り候補（${c.input?.query ? `「${esc(String(c.input.query))}」` : ""}応答 ${c.size ?? "?"} 字）— 語彙・誘導の穴の可能性`);
    }
    if ((c.size ?? 0) > 8000 && totalSize && c.size / totalSize > 0.35) {
      signals.push(`巨大応答（${esc(c.name)} が ${c.size.toLocaleString()} 字 = 全応答の ${Math.round((c.size / totalSize) * 100)}%）— 一括返しすぎ。分割の余地`);
    }
  }
  for (const m of match ?? []) {
    if (!m.used) signals.push(`引いたのに未使用（${esc(m.name)}）— 知識と期待の衝突の可能性（過去実例: CTA の btn/link 境界）`);
  }
  if (prevResult) {
    const [ps, cs] = [classifyResult(prevResult), classifyResult(r)];
    if (ps !== cs) {
      signals.push(`前回から変化（${STATUS_SYMBOL[ps]}→${STATUS_SYMBOL[cs]}）— ${cs === "pass" ? "改善に見えても行動ログでメカニズムを確認する（見かけの改善の除外）" : "劣化と断定する前に --trials 2 で再確認（生成ブレの可能性）"}`);
    }
  }
  return signals;
}

/* ---- トライアル 1 件の詳細 ---- */
function trialHtml(r, label, prevResult) {
  const status = classifyResult(r);
  const seqPath = r.transcript ? path.join(resultsDir, r.transcript) : null;
  const seq = seqPath && fs.existsSync(seqPath) ? parseToolSequence(fs.readFileSync(seqPath, "utf8")) : [];
  const m = r.agentMetrics ?? {};
  const htmlPath = r.output ? path.join(resultsDir, r.output) : null;
  const match = seq.length ? matchFetchedToUsed(seq, htmlPath) : null;
  const signals = detectSignals(seq, match, r, prevResult);

  const failParts = [];
  if (r.hardcode && !r.hardcode.pass) failParts.push(`hardcode: ${esc((r.hardcode.detail ?? []).slice(0, 3).join(" / "))}`);
  if (r.classes && !r.classes.pass) failParts.push(`classes: ${esc([...(r.classes.missing ?? []).map((x) => `必須不足 ${x}`), ...(r.classes.invented ?? []).map((x) => `捏造 ${x}`)].join(", "))}`);
  if (r.patterns && !r.patterns.pass) failParts.push(`patterns: ${esc((r.patterns.failed ?? []).join(" / "))}`);
  for (const it of r.rubric?.items ?? []) if (!it.pass) failParts.push(`rubric: ${esc(it.text)}${it.reason ? ` — ${esc(it.reason)}` : ""}`);

  /* 計測タイル */
  const dur = m.durationMs ? Math.round(m.durationMs / 1000) : null;
  const tiles = `
    <div class="tiles">
      <div class="tile"><div class="k">判定</div><div class="v sym s-${status.replace(":", "-")}">${STATUS_SYMBOL[status]} ${status}</div></div>
      <div class="tile"><div class="k">所要</div><div class="v">${dur != null ? `${Math.floor(dur / 60)}分${String(dur % 60).padStart(2, "0")}秒` : "?"}</div></div>
      <div class="tile"><div class="k">ターン</div><div class="v">${m.numTurns ?? "?"}</div></div>
      <div class="tile"><div class="k">ツール呼び出し</div><div class="v">${seq.length || "?"}<small>回</small></div></div>
      <div class="tile"><div class="k">出力トークン</div><div class="v">${m.usage?.output_tokens?.toLocaleString() ?? "?"}</div><div class="k">うち思考 ${m.usage?.output_tokens_details?.thinking_tokens?.toLocaleString() ?? "?"}</div></div>
    </div>`;

  /* タイムライン（横ストリップに区分色の点を打つ） */
  const total = Math.max(dur ?? 0, seq.at(-1)?.at ?? 0) || null;
  let timeline = "";
  if (total && seq.length) {
    const pct = (s) => ((s / total) * 100).toFixed(2);
    const dots = seq.filter((c) => c.at != null).map((c) =>
      `<i class="dot c-${CAT_OF(c.name)}" style="left:${pct(c.at)}%" title="${esc(c.name)}${c.input?.name ? ` ${esc(c.input.name)}` : ""} — ${c.at}s / ${c.size?.toLocaleString() ?? "?"}字"></i>`).join("");
    const lastCall = seq.filter((c) => c.at != null && CAT_OF(c.name) !== "write").at(-1);
    const write = seq.find((c) => CAT_OF(c.name) === "write" && c.at != null);
    const tail = lastCall && write && write.at - lastCall.at > total * 0.25
      ? `<span class="tail" style="left:${pct(lastCall.at)}%;width:${pct(write.at - lastCall.at)}%" title="組み立て（呼び出しなし）${Math.round(write.at - lastCall.at)}s"></span>` : "";
    const ticks = [0, 30, 60, 120, 180, 240].filter((s) => s < total).map((s) => `<b style="left:${pct(s)}%">${s}s</b>`).join("");
    timeline = `<div class="strip">${tail}<span class="track"></span>${dots}${ticks}</div>
      <div class="legend">${Object.entries(CAT_LABEL).map(([k, l]) => `<span><i class="dot c-${k}"></i>${l}</span>`).join("")}</div>`;
  }

  const seqRows = seq.map((c) => {
    const input = c.name === "get_component" ? c.input?.name
      : c.input?.topic ? `topic: ${c.input.topic}`
      : c.input?.query ? `「${c.input.query}」`
      : c.input?.category ?? (Object.keys(c.input ?? {}).length ? JSON.stringify(c.input).slice(0, 48) : "—");
    return `<tr><td class="t">${c.at ?? "?"}s</td><td class="mono"><i class="dot c-${CAT_OF(c.name)}"></i>${esc(c.name)}</td><td class="in">${esc(input)}</td><td class="t">${c.size?.toLocaleString() ?? "?"} 字</td></tr>`;
  }).join("");

  const matchCards = match
    ? `<div class="match">${match.map((x) => `<span class="mcard ${x.used ? "ok" : "ng"}"><b class="mono">${esc(x.name)}</b> ${x.used ? `✓ ${esc(x.sample)}` : "✗ 未使用"}</span>`).join("")}</div>` : "";

  return `
  <details class="trial" ${status !== "pass" || signals.length ? "open" : ""}>
    <summary><span class="sym s-${status.replace(":", "-")}">${STATUS_SYMBOL[status]}</span> ${esc(label)}
      <span class="meta">${m.numTurns ?? "?"} turns / ${dur != null ? dur + "s" : "?"}</span></summary>
    ${failParts.length ? `<h4>不合格の内訳</h4><ul class="fails">${failParts.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
    <h4>計測サマリー</h4>${tiles}
    ${timeline ? `<h4>タイムライン</h4>${timeline}` : ""}
    ${seqRows ? `<h4>呼び出しシーケンス</h4><div class="seq-wrap"><table class="seq"><thead><tr><th>経過</th><th>ツール</th><th>入力</th><th>応答</th></tr></thead><tbody>${seqRows}</tbody></table></div>` : "<p class='muted'>行動ログなし（--skip-generate の再採点、または導入前の実行）</p>"}
    ${matchCards ? `<h4>引いた仕様は使われたか</h4>${matchCards}` : ""}
    ${htmlPath && fs.existsSync(htmlPath) ? `<h4>生成された画面</h4>
    <iframe class="screen" src="${esc(r.output)}" loading="lazy" title="${esc(label)} の生成物"></iframe>
    <p class="muted"><a href="${esc(r.output)}" target="_blank">別タブで開く</a> — 採点対象そのもの（アーカイブ）。スタイルはレポート生成時にコピーした relay.css</p>` : ""}
    ${signals.length ? `<h4>この記録から見えたシグナル（自動検出）</h4><ul class="signals">${signals.map((s) => `<li>${s}</li>`).join("")}</ul><p class="muted">※ 機械的な候補の検出まで。改善と呼ぶかは 3 方向（知識 / 基準 / お題）の切り分けで判断する</p>` : ""}
  </details>`;
}

/* ------------------------------------------------------------- html 組み立て */

const t = tally({ results: targetResults });
const hasCapability = targetResults.some((r) => kindOfResult(r) === "capability") || CASES.some((c) => kindOf(c) === "capability");
const headline = `regression ${t.R.pass}/${t.R.total}${t.R.err ? `（!${t.R.err}）` : ""} ・ capability ${t.C.pass}/${t.C.total}${t.C.err ? `（!${t.C.err}）` : ""}`;

/* 履歴マトリクス — kind で列をグループ化し、R/C 帯を付ける */
const shownRuns = showAll ? runs : runs.slice(-20);
const regIds = CASES.filter((c) => kindOf(c) === "regression").map((c) => c.id);
const capIds = CASES.filter((c) => kindOf(c) === "capability").map((c) => c.id);
const extraIds = [];
for (const run of shownRuns) for (const r of run.results ?? []) {
  if (![...regIds, ...capIds, ...extraIds].includes(r.id)) extraIds.push(r.id);
}
const colIds = [...regIds, ...extraIds, ...capIds]; // 退役お題は regression 側に寄せる

const bandRow = `<tr class="band"><th></th>
  <th colspan="${regIds.length + extraIds.length}" class="b-reg">regression（守り — 100% 維持が前提）</th>
  ${capIds.length ? `<th colspan="${capIds.length}" class="b-cap">capability（改善メーター）</th>` : ""}
  <th></th></tr>`;
const headRow = `<tr><th class="sticky">実行</th>${colIds.map((i) => `<th class="rot ${capIds.includes(i) ? "b-cap-l" : ""}"><span>${esc(i)}</span></th>`).join("")}<th>計</th></tr>`;
const matrixRows = shownRuns.slice().reverse().map((run) => {
  const byId = new Map((run.results ?? []).map((r) => [r.id, r]));
  const cells = colIds.map((i) => {
    const r = byId.get(i);
    if (!r) return `<td class="none ${capIds.includes(i) ? "b-cap-l" : ""}">·</td>`;
    const s = classifyResult(r);
    return `<td class="s-${s.replace(":", "-")} ${capIds.includes(i) ? "b-cap-l" : ""}">${STATUS_SYMBOL[s]}</td>`;
  }).join("");
  const rt = tally(run);
  const tallyText = `${rt.R.total ? `R ${rt.R.pass}/${rt.R.total}` : ""} ${rt.C.total ? `C ${rt.C.pass}/${rt.C.total}` : ""}`.trim() || "—";
  const isTarget = run.stamp === target.stamp;
  return `<tr class="${isTarget ? "target" : ""}"><td class="sticky t">${jst(run.ranAt ?? run.stamp)}${run.skipJudge ? " *" : ""}${isTarget ? " ◀" : ""}</td>${cells}<td class="t">${tallyText}</td></tr>`;
}).join("");

/* お題別カード */
const prevById = new Map((prev?.results ?? []).map((r) => [r.id, r]));
const cards = targetResults.map((r) => {
  const kind = kindOfResult(r);
  const trials = r.trials ?? [r];
  const prevResult = prevById.get(r.id) ?? null;
  return `
  <section class="case">
    <h3><span class="chip k-${kind}">${kind}</span> <span class="mono">${esc(r.id)}</span>
      <span class="sym s-${classifyResult(r).replace(":", "-")}">${STATUS_SYMBOL[classifyResult(r)]}</span>
      ${r.trials ? `<span class="meta">pass^${trials.length}（全勝のみ PASS）</span>` : ""}</h3>
    ${trials.map((tr, i) => trialHtml(tr, r.trials ? `trial ${i + 1}/${trials.length}` : "実行", i === 0 ? prevResult : null)).join("")}
  </section>`;
}).join("");

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>relay evals レポート ${esc(jst(target.ranAt ?? target.stamp))}</title>
<style>
:root{--bg:#fafcfb;--panel:#fff;--ink:#1d2723;--mid:#3c4a44;--low:#5f6b65;--line:#e3eae6;--line2:#cbd6d0;
--pass:#1b805e;--pass-bg:#eef9f4;--fail:#b91c1c;--fail-bg:#fef2f2;--err:#64748b;
--found:#2563eb;--comp:#1b805e;--asset:#b45309;--a11y:#7c3aed;--harness:#6b7280;--write:#1d2723;
--warn:#b45309;--warn-bg:#fffbeb}
@media(prefers-color-scheme:dark){:root{--bg:#141816;--panel:#1a201d;--ink:#e4ebe7;--mid:#c3cdc7;--low:#94a09a;--line:#2a332e;--line2:#3c4741;
--pass:#3ecb98;--pass-bg:rgba(48,182,134,.1);--fail:#fca5a5;--fail-bg:rgba(239,68,68,.12);--err:#94a3b8;
--found:#3b82f6;--comp:#1f9d6e;--asset:#c2700a;--a11y:#8b5cf6;--harness:#7b8680;--write:#e4ebe7;
--warn:#fcd34d;--warn-bg:rgba(245,158,11,.1)}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--mid);font:14px/1.7 "Hiragino Sans",sans-serif}
.wrap{max-width:980px;margin:0 auto;padding:32px 20px 64px}
h1{font-size:20px;color:var(--ink)}h2{font-size:15px;color:var(--ink);margin:36px 0 8px}
h4{font-size:11.5px;letter-spacing:.06em;color:var(--low);margin:14px 0 6px;font-weight:600}
.mono{font-family:ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.muted{color:var(--low);font-size:12px}.meta{color:var(--low);font-size:11.5px;font-weight:400;margin-left:8px}
.headline{font-size:15px;padding:12px 16px;border:1px solid var(--line);border-radius:8px;background:var(--panel);color:var(--ink)}
.cond{font-size:12px;color:var(--low);margin-top:4px}
.sym{font-weight:700}.s-pass{color:var(--pass)}.s-fail{color:var(--fail)}.s-error-generation,.s-error-judge{color:var(--err)}
/* 履歴マトリクス */
.matrix-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:8px;background:var(--panel)}
table{border-collapse:collapse;font-size:12.5px}
.matrix td,.matrix th{border-bottom:1px solid var(--line);padding:4px 9px;text-align:center}
.matrix .band th{font-size:10.5px;font-weight:700;padding:6px 8px;border-bottom:2px solid var(--line2)}
.matrix .b-reg{color:var(--pass);background:var(--pass-bg)}.matrix .b-cap{color:var(--warn);background:var(--warn-bg)}
.matrix .b-cap-l{border-left:2px solid var(--line2)}
.matrix td.sticky,.matrix th.sticky{position:sticky;left:0;background:var(--panel);text-align:left;white-space:nowrap;z-index:1}
.matrix td.t{color:var(--low);font-size:11.5px}
.rot span{writing-mode:vertical-rl;font-size:11px;color:var(--low);font-weight:400}
.matrix tr.target td{background:var(--pass-bg)}
.none{color:var(--line2)}
/* お題カード */
.case{border:1px solid var(--line);border-radius:8px;padding:12px 16px;margin:12px 0;background:var(--panel)}
.case h3{font-size:13.5px;color:var(--ink);margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.chip{font-size:10.5px;font-weight:700;border-radius:999px;padding:0 8px}
.k-regression{color:var(--pass);background:var(--pass-bg)}.k-capability{color:var(--warn);background:var(--warn-bg)}
.trial{margin:8px 0 2px;border-top:1px dashed var(--line2);padding-top:6px}
.trial summary{cursor:pointer;font-size:12.5px}
.fails{margin:4px 0;padding-left:20px;color:var(--fail);font-size:12.5px}
.signals{margin:4px 0;padding-left:20px;font-size:12.5px;color:var(--ink)}
.signals li{margin:2px 0}
/* 計測タイル */
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
.tile{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:var(--bg)}
.tile .k{font-size:10.5px;color:var(--low)}.tile .v{font-size:16px;font-weight:700;color:var(--ink)}.tile .v small{font-size:11px;font-weight:400;color:var(--low)}
/* タイムライン */
.strip{position:relative;height:44px;margin:2px 0}
.strip .track{position:absolute;left:0;right:0;top:18px;height:2px;background:var(--line2)}
.strip .tail{position:absolute;top:13px;height:12px;border:1px dashed var(--line2);border-radius:4px;background:transparent}
.strip .dot,.legend .dot,.seq .dot{display:inline-block;width:9px;height:9px;border-radius:50%}
.strip .dot{position:absolute;top:14.5px;transform:translateX(-50%);border:2px solid var(--panel)}
.strip b{position:absolute;top:30px;transform:translateX(-50%);font-size:10px;color:var(--low);font-weight:400}
.legend{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:var(--low)}
.legend span{display:inline-flex;align-items:center;gap:5px}
.c-found{background:var(--found)}.c-comp{background:var(--comp)}.c-asset{background:var(--asset)}.c-a11y{background:var(--a11y)}.c-harness{background:var(--harness)}.c-write{background:var(--write)}
/* シーケンス */
.seq-wrap{overflow-x:auto}.seq{width:100%}
.seq th{font-size:10.5px;color:var(--low);text-align:left;padding:2px 8px;border-bottom:1px solid var(--line)}
.seq td{padding:2px 8px;border-bottom:1px solid var(--line);font-size:12px}
.seq td.t{text-align:right;white-space:nowrap;color:var(--low)}
.seq .dot{width:7px;height:7px;margin-right:6px}
.seq .in{color:var(--low);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* 突合 */
.match{display:flex;flex-wrap:wrap;gap:6px}
.mcard{border:1px solid var(--line);border-radius:6px;padding:2px 10px;font-size:11.5px;background:var(--bg)}
.mcard.ok{color:var(--pass)}.mcard.ng{color:var(--fail);border-color:var(--fail);font-weight:700}
.screen{width:100%;height:460px;border:1px solid var(--line2);border-radius:8px;background:#fff}
footer{margin-top:40px;border-top:1px solid var(--line);padding-top:10px;font-size:11.5px;color:var(--low)}
</style></head><body><div class="wrap">
<h1>relay evals レポート</h1>
<p class="muted">自動生成: <span class="mono">npm run eval:report:html${stampArg ? ` -- --stamp ${esc(stampArg)}` : ""}${caseArg ? ` --case ${esc(caseArg)}` : ""}</span>（正本: evals/results/）</p>
<div class="headline"><b>${headline}</b>
<div class="cond">${esc(jst(target.ranAt ?? target.stamp))} 実行${target.stamp === runs.at(-1).stamp ? "（最新）" : "（過去の実行を表示中）"} ・ model: ${esc(target.model ?? "?")} ・ judge: ${esc(target.judgeModel ?? "なし(--skip-judge)")} ・ votes ${target.votes ?? 1} ・ trials ${target.trials ?? 1} ・ v${esc(target.dsVersion ?? "?")}</div></div>

<h2>履歴推移（新しい順・${shownRuns.length}/${runs.length} 件${showAll ? "" : "。全件は --all"}）</h2>
<div class="matrix-wrap"><table class="matrix"><thead>${hasCapability ? bandRow : ""}${headRow}</thead><tbody>${matrixRows}</tbody></table></div>
<p class="muted">✓ PASS / ✗ FAIL（品質） / G 生成失敗 / J 審査不能（G/J は品質シグナルでない） / · その実行の対象外 / * 機械チェックのみ / ◀ このレポートの対象実行。
regression の ✗ は即対応、capability の ✗ は改善余地の測定値（exit code にも影響しない）。</p>

<h2>対象実行の詳細（お題別${caseArg ? ` — ${esc(caseArg)} で絞り込み` : ""}）</h2>
${cards}

<footer>relay Design System evals ・ 読み方と所見の書き方: .claude/skills/eval-report/SKILL.md ・
切り分けは「知識 / 基準 / お題」の 3 方向（分水嶺: 正しい知識を持つ理想のエージェントなら安定して合格できるか）</footer>
</div></body></html>`;

const outPath = path.join(resultsDir, "report.html");
fs.writeFileSync(outPath, html);
console.log(`evals/results/report.html を生成しました（${(html.length / 1024).toFixed(0)}KB・対象 ${targetResults.length} お題・${jst(target.ranAt ?? target.stamp)} 実行）`);
