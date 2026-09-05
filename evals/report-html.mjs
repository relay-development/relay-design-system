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
import { previousMeasurements } from "./history.mjs";
import { parseToolSequence } from "./transcript.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "results");

const args = process.argv.slice(2);
const showAll = args.includes("--all");
const stampArg = args.includes("--stamp") ? args[args.indexOf("--stamp") + 1] : null;
const caseArg = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;
const compareArg = args.includes("--compare") ? args[args.indexOf("--compare") + 1] : null;
const noScreens = args.includes("--no-screens"); // 生成画面 iframe を省く（Artifact 公開用。相対参照が効かないため）

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
const previous = previousMeasurements(runs.filter((r) => r.stamp < target.stamp));
const baseRun = compareArg ? runs.find((r) => r.stamp.startsWith(compareArg)) : null;
if (compareArg && !baseRun) {
  console.error(`--compare "${compareArg}" に一致する実行がありません。候補: ${runs.slice(-8).map((r) => r.stamp).join(", ")}`);
  process.exit(1);
}

const kindById = new Map(CASES.map((c) => [c.id, kindOf(c)]));
const caseById = new Map(CASES.map((c) => [c.id, c]));
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
    // 空振り = 「ヒットなし」を返したとき。#271 以降、クラス存在の肯定/否定や一括 ○× 表は設計上短い応答
    // （150〜250 字）なので、サイズだけで判定すると正常応答が全部「空振り候補」に見える（誤検知の実例:
    // faq-accordion 2026-09-04「border-t は存在します」152 字）。サイズ条件は存在チェック系を除いたときだけ使う。
    const head = c.head ?? "";
    const isClassAnswer = /存在します|存在しません|クラス存在チェック/.test(head);
    if (c.name === "search" && (/ヒットなし/.test(head) || ((c.size ?? 0) < 300 && !isClassAnswer))) {
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

/**
 * Bash コマンドが relay.css を grep したか。
 * grep と relay.css が同一コマンド内にあれば拾う（クォートで囲ったパス
 * `grep ... "…/relay.css"` や `for c in …; do grep … relay.css` も対象）。
 * 旧実装 /grep[^"]*relay\.css/ はダブルクォートで途切れて過小カウントしていた。
 */
const isRelayCssGrep = (cmd) => /\bgrep\b/.test(cmd ?? "") && /relay\.css/.test(cmd ?? "");

/* ---- お題1件の計測指標（前回比較用。行動ログから grep/search も数える） ---- */
/** --trials 形式（result.trials[]）は trial 1 を代表値にする（カードの前回比も i===0 のみ比較するのと揃える） */
const primaryTrial = (r) => (r?.trials ? r.trials[0] : r);
function caseMetrics(result) {
  if (!result) return null;
  result = primaryTrial(result);
  const m = result.agentMetrics ?? {};
  const seqPath = result.transcript ? path.join(resultsDir, result.transcript) : null;
  const seq = seqPath && fs.existsSync(seqPath) ? parseToolSequence(fs.readFileSync(seqPath, "utf8")) : [];
  return {
    dur: m.durationMs ? Math.round(m.durationMs / 1000) : null,
    turns: m.numTurns ?? null,
    tools: seq.length || null,
    out: m.usage?.output_tokens ?? null,
    think: m.usage?.output_tokens_details?.thinking_tokens ?? null,
    grep: seq.filter((c) => c.name === "Bash" && isRelayCssGrep(c.input?.command)).length,
    search: seq.filter((c) => c.name === "search").length,
  };
}
const fmtDur = (s) => (s == null ? "?" : `${Math.floor(s / 60)}分${String(s % 60).padStart(2, "0")}秒`);
/** 前→後のセル。lowerBetter=true は減少が改善（緑）、false は増加が改善 */
function cmpCell(a, b, lowerBetter, fmt = (x) => (x == null ? "?" : x.toLocaleString())) {
  if (a == null && b == null) return "—";
  const cls = a === b || a == null || b == null ? "" : (lowerBetter ? b < a : b > a) ? "d-good" : "d-bad";
  return `<span class="${cls}">${fmt(a)} → ${fmt(b)}</span>`;
}
function cmpBlock(cur, base, baseLabel) {
  if (!base) return "";
  const rows = [
    ["所要", cmpCell(base.dur, cur.dur, true, fmtDur)],
    ["ターン", cmpCell(base.turns, cur.turns, true)],
    ["ツール呼び出し", cmpCell(base.tools, cur.tools, true)],
    ["出力トークン", cmpCell(base.out, cur.out, true)],
    ["うち思考", cmpCell(base.think, cur.think, true)],
    ["grep(relay.css)", cmpCell(base.grep, cur.grep, true)],
    ["search", cmpCell(base.search, cur.search, false)],
  ];
  return `<h4>前回比（${esc(baseLabel)} → 今回）</h4>
    <div class="log"><table class="cmp"><tbody>${rows.map(([k, v]) => `<tr><td class="ck">${k}</td><td>${v}</td></tr>`).join("")}</tbody></table></div>
    <p class="muted">grep(relay.css) 減・search 増・所要/ターン減が改善方向（緑）。実 CSS を覗かず MCP で組めているほど良い。</p>`;
}

/* ---- トライアル 1 件の詳細 ---- */
function trialHtml(r, label, prevResult, cmpResult, cmpLabel) {
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
    timeline = `<div class="strip-box"><div class="strip">${tail}<span class="track"></span>${dots}${ticks}</div>
      <div class="legend">${Object.entries(CAT_LABEL).map(([k, l]) => `<span><i class="dot c-${k}"></i>${l}</span>`).join("")}</div></div>`;
  }

  const maxSize = Math.max(1, ...seq.map((c) => c.size ?? 0));
  const gapMin = total ? Math.max(12, total * 0.12) : Infinity; // 呼び出し間の無言をギャップ行で示す
  let prevAt = null;
  const seqRows = seq.map((c) => {
    const input = c.name === "get_component" ? c.input?.name
      : c.input?.topic ? `topic: ${c.input.topic}`
      : c.input?.query ? `「${c.input.query}」`
      : c.input?.category ?? (Object.keys(c.input ?? {}).length ? JSON.stringify(c.input).slice(0, 48) : "—");
    let gapRow = "";
    if (prevAt != null && c.at != null && c.at - prevAt >= gapMin) {
      gapRow = `<tr class="gap"><td class="t mono">+${Math.round(c.at - prevAt)}s</td><td colspan="3"><span class="lead">⋯⋯</span>　思考・組み立て（呼び出しなし）</td></tr>`;
    }
    if (c.at != null) prevAt = c.at;
    const size = c.size ?? 0;
    const cat = CAT_OF(c.name);
    const isLocalFs = ["Bash", "Read", "Grep", "Glob"].includes(c.name); // MCP 外でローカルファイルを覗いた手つき
    return `${gapRow}<tr${isLocalFs ? ' class="fs"' : ""}>
      <td class="t mono">${c.at != null ? `${c.at}s` : "?"}</td>
      <td class="tool mono"><i class="dot c-${cat}"></i>${esc(c.name)}</td>
      <td class="in">${esc(input)}</td>
      <td><div class="bar-row"><div class="bar" style="width:${Math.max(2, (size / maxSize) * 130)}px;background:var(--c-${cat})"></div><span class="bar-num mono">${size ? size.toLocaleString() : "?"} 字</span></div></td></tr>`;
  }).join("");

  const matchCards = match
    ? `<div class="match">${match.map((x) => `<div class="mcard ${x.used ? "ok" : "ng"}"><span class="name mono">${esc(x.name)}</span><span class="used">${x.used ? `✓ ${esc(x.sample)}` : "✗ 未使用"}</span></div>`).join("")}</div>` : "";

  return `
  <details class="trial" ${status !== "pass" || signals.length ? "open" : ""}>
    <summary><span class="sym s-${status.replace(":", "-")}">${STATUS_SYMBOL[status]}</span> ${esc(label)}
      <span class="meta">${m.numTurns ?? "?"} turns / ${dur != null ? dur + "s" : "?"}</span></summary>
    ${failParts.length ? `<h4>不合格の内訳</h4><ul class="fails">${failParts.map((f) => `<li>${f}</li>`).join("")}</ul>` : ""}
    <h4>計測サマリー</h4>${tiles}
    ${cmpResult ? cmpBlock(caseMetrics(r), caseMetrics(cmpResult), cmpLabel) : ""}
    ${timeline ? `<h4>タイムライン</h4>${timeline}` : ""}
    ${seqRows ? `<h4>呼び出しシーケンス</h4><p class="muted">薄く敷いた行はローカルファイル参照（Bash / Read / Grep / Glob）＝ MCP の知識でなく実物を覗きにいった手つき。試験環境の実ファイルに依存している疑いのシグナル。</p><div class="log"><table><thead><tr><th class="t">経過</th><th>ツール</th><th>入力</th><th>応答サイズ</th></tr></thead><tbody>${seqRows}</tbody></table></div>` : "<p class='muted'>行動ログなし（--skip-generate の再採点、または導入前の実行）</p>"}
    ${matchCards ? `<h4>引いた仕様は使われたか</h4>${matchCards}` : ""}
    ${htmlPath && fs.existsSync(htmlPath) && !noScreens ? `<h4>生成された画面</h4>
    <div class="frame-box"><iframe src="${esc(r.output)}" loading="lazy" title="${esc(label)} の生成物"></iframe></div>
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
const cards = targetResults.map((r, idx) => {
  const kind = kindOfResult(r);
  const trials = r.trials ?? [r];
  const prior = previous.get(r.id);
  const prevResult = prior?.result ?? null;
  // 明示的な --compare は維持し、既定ではお題ごとの前回計測を使う。
  const cmpResult = baseRun ? baseRun.results?.find((p) => p.id === r.id) : prevResult;
  const cmpRun = baseRun ?? prior?.run;
  const cmpLabel = cmpRun ? jst(cmpRun.ranAt ?? cmpRun.stamp) : "";
  const def = caseById.get(r.id);
  const specBox = def ? `
    <h4>お題（意図レベルの日本語指示。コンポーネント名は与えない）</h4>
    <div class="case-box">
      <blockquote>${esc(def.prompt)}</blockquote>
      <div class="criteria">
        ${def.mustClasses?.length ? `<div class="row"><span class="k">必須クラス</span><span>${def.mustClasses.map((c) => `<code>${esc(c)}</code>`).join("")}<span class="muted">機械チェック</span></span></div>` : ""}
        ${def.mustPatterns?.length ? `<div class="row"><span class="k">必須パターン</span><span>${def.mustPatterns.map((p) => `<code>${esc(p.pattern)}</code> ${esc(p.label)}`).join("<br>")}<span class="muted"> — 機械チェック</span></span></div>` : ""}
        ${def.rubric?.length ? `<div class="row"><span class="k">審査観点</span><span><ul>${def.rubric.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><span class="muted">LLM 審査員の採点項目（rubric）。加えて全お題共通の a11y チェック（lang / img alt / svg 属性）が走る</span></span></div>` : ""}
      </div>
    </div>` : "";
  return `
  <section class="case" id="panel-${esc(r.id)}" role="tabpanel" aria-labelledby="tab-${esc(r.id)}"${idx ? " hidden" : ""}>
    <h3><span class="chip k-${kind}">${kind}</span> <span class="mono">${esc(r.id)}</span>
      <span class="sym s-${classifyResult(r).replace(":", "-")}">${STATUS_SYMBOL[classifyResult(r)]}</span>
      ${r.trials ? `<span class="meta">pass^${trials.length}（全勝のみ PASS）</span>` : ""}</h3>
    ${specBox}
    ${trials.map((tr, i) => trialHtml(tr, r.trials ? `trial ${i + 1}/${trials.length}` : "実行", i === 0 ? prevResult : null, i === 0 ? cmpResult : null, cmpLabel)).join("")}
  </section>`;
}).join("");

/* お題タブ（tablist）— 詳細を1件ずつ切り替えて縦スクロールを抑える */
const tabbar = `<div class="tabs" role="tablist" aria-label="お題別の詳細">${targetResults.map((r, idx) => {
  const st = classifyResult(r);
  return `<button type="button" role="tab" id="tab-${esc(r.id)}" class="tab k-${kindOfResult(r)}${idx ? "" : " active"}" aria-selected="${idx ? "false" : "true"}" aria-controls="panel-${esc(r.id)}" tabindex="${idx ? "-1" : "0"}"><span class="sym s-${st.replace(":", "-")}">${STATUS_SYMBOL[st]}</span> <span class="mono">${esc(r.id)}</span></button>`;
}).join("")}</div>`;

/* ---- 実行間の比較（--compare）: 各お題の行動ログ指標が前後でどう変わったか ---- */
function grepRelayCssCount(run, id) {
  const r = primaryTrial((run.results ?? []).find((x) => x.id === id));
  if (!r?.transcript) return null;
  const p = path.join(resultsDir, r.transcript);
  if (!fs.existsSync(p)) return null;
  let n = 0;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    if (!line.trim()) continue;
    let ev; try { ev = JSON.parse(line); } catch { continue; }
    if (ev.type !== "assistant") continue;
    for (const b of ev.message?.content ?? []) {
      if (b.type === "tool_use" && b.name === "Bash" && isRelayCssGrep(b.input?.command)) n++;
    }
  }
  return n;
}
function metricsOf(run, id) {
  const r = (run.results ?? []).find((x) => x.id === id);
  if (!r) return null;
  const m = primaryTrial(r).agentMetrics ?? {};
  const tc = m.toolCalls ?? {};
  return {
    status: classifyResult(r),
    turns: m.numTurns ?? null,
    tools: Object.values(tc).reduce((a, b) => a + b, 0) || null,
    bash: tc.Bash ?? 0,
    search: tc.search ?? 0,
    grep: grepRelayCssCount(run, id),
  };
}
function compareSection(base, tgt) {
  const ids = colIds.filter((id) => (base.results ?? []).some((r) => r.id === id) || (tgt.results ?? []).some((r) => r.id === id));
  const cell = (a, b, lowerBetter = false) => {
    if (a == null && b == null) return "—";
    const same = a === b;
    const better = lowerBetter ? b < a : b > a;
    const cls = same ? "" : better ? "d-good" : "d-bad";
    return `<span class="${cls}">${a ?? "?"} → ${b ?? "?"}</span>`;
  };
  const rows = ids.map((id) => {
    const A = metricsOf(base, id), B = metricsOf(tgt, id);
    const sa = A?.status ?? "—", sb = B?.status ?? "—";
    const stChip = `<span class="sym s-${String(sa).replace(":", "-")}">${STATUS_SYMBOL[sa] ?? "—"}</span>→<span class="sym s-${String(sb).replace(":", "-")}">${STATUS_SYMBOL[sb] ?? "—"}</span>`;
    return `<tr><td class="mono">${esc(id)}</td><td>${stChip}</td>
      <td>${cell(A?.grep, B?.grep, true)}</td>
      <td>${cell(A?.search, B?.search)}</td>
      <td>${cell(A?.bash, B?.bash, true)}</td>
      <td>${cell(A?.turns, B?.turns, true)}</td>
      <td>${cell(A?.tools, B?.tools, true)}</td></tr>`;
  }).join("");
  return `<h2>実行間の比較（行動ログ指標）</h2>
  <p class="h2-note">${esc(jst(base.ranAt ?? base.stamp))} → ${esc(jst(tgt.ranAt ?? tgt.stamp))}。各お題が前後でどう変わったか。<b>grep(relay.css)</b> が実 CSS を覗いた回数（少ないほど良い＝MCP知識で組めている）、<b>search</b> は MCP でクラス等を確認した回数。緑=改善方向 / 赤=悪化方向。</p>
  <div class="matrix-wrap"><table class="matrix cmp">
    <thead><tr><th class="sticky">お題</th><th>判定</th><th>grep(relay.css)</th><th>search</th><th>Bash</th><th>ターン</th><th>ツール計</th></tr></thead>
    <tbody>${rows}</tbody></table></div>
  <p class="muted">grep(relay.css) が減り search が増えていれば、実ファイル依存から MCP での確認へ移行した証拠（A: safelist + B: クラス一覧公開の効果）。</p>`;
}

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>relay evals レポート ${esc(jst(target.ranAt ?? target.stamp))}</title>
<style>
:root{color-scheme:light;
--paper:#fafcfb;--panel:#fff;--ink:#1d2723;--mid:#3c4a44;--muted:#5f6b65;--hair:#e3eae6;--hair-strong:#cbd6d0;
--ok:#1b805e;--ok-bg:#eef9f4;--fail:#b91c1c;--fail-bg:#fef2f2;--err:#64748b;--warn:#b45309;--warn-bg:#fffbeb;
--c-found:#2563eb;--c-comp:#1b805e;--c-asset:#b45309;--c-a11y:#7c3aed;--c-harness:#6b7280;--c-write:#1d2723}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--mid);font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif;font-size:14px;line-height:1.75;font-feature-settings:"palt"}
.mono{font-family:"SF Mono",ui-monospace,Menlo,monospace;font-variant-numeric:tabular-nums}
.wrap{max-width:980px;margin:0 auto;padding:48px 24px 72px}
.eyebrow{font-size:11px;letter-spacing:.14em;color:var(--muted);text-transform:uppercase}
h1{font-size:26px;font-weight:600;letter-spacing:.01em;color:var(--ink);margin:6px 0 4px;text-wrap:balance}
.sub{color:var(--muted);margin:0 0 20px}
h2{font-size:15px;font-weight:600;color:var(--ink);margin:44px 0 4px}
.h2-note{font-size:12.5px;color:var(--muted);margin:0 0 16px}
h4{font-size:11px;letter-spacing:.08em;color:var(--muted);font-weight:600;margin:20px 0 6px;text-transform:uppercase}
.muted{color:var(--muted);font-size:12px}.meta{color:var(--muted);font-size:11.5px;font-weight:400;margin-left:8px}
.sym{font-weight:700}.s-pass{color:var(--ok)}.s-fail{color:var(--fail)}.s-error-generation,.s-error-judge{color:var(--err)}
.headline{font-size:15px;padding:14px 18px;border:1px solid var(--hair);border-radius:10px;background:var(--panel);color:var(--ink)}
.cond{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.7}
/* chips */
.chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 0}
.chip{font-size:12px;padding:3px 10px;border:1px solid var(--hair-strong);border-radius:999px;color:var(--muted);background:var(--panel)}
.chip.pass{color:var(--ok);border-color:var(--ok);font-weight:600}
.k-regression{color:var(--ok);border-color:var(--ok);font-weight:600}.k-capability{color:var(--warn);border-color:var(--warn);font-weight:600}
/* 履歴マトリクス */
.matrix-wrap{overflow-x:auto;border:1px solid var(--hair);border-radius:10px;background:var(--panel)}
table{border-collapse:collapse;font-size:12.5px}
.matrix td,.matrix th{border-bottom:1px solid var(--hair);padding:5px 9px;text-align:center}
.matrix .band th{font-size:10.5px;font-weight:700;padding:7px 8px;border-bottom:2px solid var(--hair-strong)}
.matrix .b-reg{color:var(--ok);background:var(--ok-bg)}.matrix .b-cap{color:var(--warn);background:var(--warn-bg)}
.matrix .b-cap-l{border-left:2px solid var(--hair-strong)}
.matrix td.sticky,.matrix th.sticky{position:sticky;left:0;background:var(--panel);text-align:left;white-space:nowrap;z-index:1}
.matrix td.t{color:var(--muted);font-size:11.5px}
.rot span{writing-mode:vertical-rl;font-size:11px;color:var(--muted);font-weight:400}
.matrix tr.target td{background:var(--ok-bg)}
.none{color:var(--hair-strong)}
/* 比較テーブル */
.cmp td{text-align:left;padding:7px 12px;font-size:12.5px}
.cmp th{padding:8px 12px}
.cmp .d-good{color:var(--ok);font-weight:600}
.cmp .d-bad{color:var(--fail);font-weight:600}
.cmp .sym{margin:0 1px}
.cmp .ck{color:var(--muted);width:140px;font-size:12px}
/* お題タブ */
.tabs{display:flex;flex-wrap:wrap;gap:2px;margin:4px 0 16px;border-bottom:1px solid var(--hair)}
.tab{font-family:inherit;font-size:12.5px;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;padding:8px 12px;margin-bottom:-1px;color:var(--muted);display:inline-flex;align-items:center;gap:6px}
.tab .mono{font-size:12px}
.tab .sym{font-weight:700}
.tab:hover{color:var(--ink)}
.tab.active{color:var(--ink);border-bottom-color:var(--c-comp);font-weight:600}
.tab.k-capability.active{border-bottom-color:var(--warn)}
.tab:focus-visible{outline:2px solid var(--c-found);outline-offset:2px;border-radius:4px}
/* お題カード */
.case{border:1px solid var(--hair);border-radius:10px;padding:16px 18px;margin:14px 0;background:var(--panel)}
.case[hidden]{display:none}
.case h3{font-size:14px;color:var(--ink);margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-weight:600}
.trial{margin:12px 0 2px;border-top:1px solid var(--hair);padding-top:10px}
.trial summary{cursor:pointer;font-size:13px;color:var(--ink)}
.fails{margin:6px 0;padding-left:20px;color:var(--fail);font-size:12.5px;line-height:1.7}
.signals{margin:6px 0;padding-left:20px;font-size:12.5px;color:var(--ink);line-height:1.7}
.signals li{margin:3px 0}
/* 計測タイル */
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.tile{background:var(--panel);border:1px solid var(--hair);border-radius:8px;padding:14px 16px 12px}
.tile .k{font-size:11.5px;color:var(--muted)}
.tile .v{font-size:24px;font-weight:600;line-height:1.3;color:var(--ink)}
.tile .v small{font-size:12px;font-weight:400;color:var(--muted);margin-left:2px}
.tile .v.sym{font-size:15px}
/* タイムライン */
.strip-box{background:var(--panel);border:1px solid var(--hair);border-radius:8px;padding:18px 20px 10px}
.strip{position:relative;height:52px}
.strip .track{position:absolute;left:0;right:0;top:22px;height:2px;background:var(--hair-strong)}
.strip .tail{position:absolute;top:16px;height:14px;border:1px dashed var(--hair-strong);border-radius:4px;background:color-mix(in srgb,var(--c-write) 8%,transparent)}
.strip .dot,.legend .dot{display:inline-block;width:9px;height:9px;border-radius:50%}
.strip .dot{position:absolute;top:18px;transform:translateX(-50%);border:2px solid var(--panel)}
.strip b{position:absolute;top:36px;transform:translateX(-50%);font-size:10.5px;color:var(--muted);font-weight:400}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;font-size:12px;color:var(--muted)}
.legend span{display:inline-flex;align-items:center;gap:6px}
.c-found{background:var(--c-found)}.c-comp{background:var(--c-comp)}.c-asset{background:var(--c-asset)}.c-a11y{background:var(--c-a11y)}.c-harness{background:var(--c-harness)}.c-write{background:var(--c-write)}
/* シーケンス（応答サイズをバー表示） */
.log{border:1px solid var(--hair);border-radius:8px;background:var(--panel);overflow-x:auto}
.log table{width:100%;min-width:560px}
.log th{text-align:left;font-size:11px;letter-spacing:.08em;color:var(--muted);font-weight:600;padding:10px 12px 8px;border-bottom:1px solid var(--hair)}
.log td{padding:7px 12px;border-bottom:1px solid var(--hair);font-size:13px;vertical-align:middle}
.log tr:last-child td{border-bottom:none}
.log .t{text-align:right;color:var(--muted);font-size:12px;white-space:nowrap;width:64px}
.log .tool{white-space:nowrap;font-size:12.5px}.log .tool .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px}
.log .in{color:var(--muted);font-size:12px;max-width:230px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-row{display:flex;align-items:center;gap:8px}
.bar{height:8px;border-radius:0 4px 4px 0;min-width:2px}
.bar-num{font-size:11px;color:var(--muted);white-space:nowrap}
.gap td{padding:4px 12px;font-size:11.5px;color:var(--muted);background:color-mix(in srgb,var(--hair) 35%,transparent);border-top:1px dashed var(--hair-strong);border-bottom:1px dashed var(--hair-strong)}
.gap .lead{letter-spacing:.2em}
/* ローカルファイル参照（Bash/Read/Grep/Glob）= MCP 外で実物を覗いた行を薄く敷く */
.log tr.fs td{background:color-mix(in srgb,var(--c-asset) 9%,transparent)}
/* 突合 */
.match{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px}
.mcard{border:1px solid var(--hair);border-radius:8px;background:var(--panel);padding:9px 12px 8px;min-width:0}
.mcard .name{font-size:12.5px;display:block}
.mcard .used{font-size:11px;font-weight:600;display:block;line-height:1.5}
.mcard.ok .used{color:var(--ok)}.mcard.ng{border-color:var(--fail)}.mcard.ng .used{color:var(--fail)}
/* お題・達成基準 */
.case-box{background:color-mix(in srgb,var(--hair) 30%,var(--panel));border:1px solid var(--hair);border-radius:8px;padding:16px 18px}
.case-box blockquote{margin:0 0 14px;padding:2px 0 2px 14px;border-left:3px solid var(--c-comp);font-size:14px;line-height:1.85;color:var(--ink);max-width:44em}
.criteria{display:grid;gap:6px;font-size:12.5px;color:var(--muted)}
.criteria .row{display:flex;gap:10px}
.criteria .k{flex:none;width:88px;font-size:11px;letter-spacing:.06em;padding-top:2px}
.criteria code{font-family:"SF Mono",ui-monospace,monospace;font-size:11.5px;background:var(--panel);border:1px solid var(--hair-strong);border-radius:4px;padding:0 5px;margin-right:4px}
.criteria ul{margin:0;padding-left:18px}.criteria li{margin:2px 0}
/* 生成画面 */
.frame-box{border:1px solid var(--hair-strong);border-radius:8px;overflow:hidden;background:#fff}
.frame-box iframe{display:block;width:100%;height:560px;border:none;background:#fff}
footer{margin-top:48px;border-top:1px solid var(--hair);padding-top:14px;font-size:11.5px;color:var(--muted);line-height:1.7}
footer code,.cond code{font-family:"SF Mono",ui-monospace,monospace;font-size:11px}
</style></head><body><div class="wrap">
<div class="eyebrow">relay Design System · agent eval レポート</div>
<h1>evals レポート</h1>
<p class="sub">自動生成（LLM 不使用）: <span class="mono">npm run eval:report:html${stampArg ? ` -- --stamp ${esc(stampArg)}` : ""}${caseArg ? ` --case ${esc(caseArg)}` : ""}</span>　正本: evals/results/</p>
<div class="headline"><b>${headline}</b>
<div class="cond">${esc(jst(target.ranAt ?? target.stamp))} 実行${target.stamp === runs.at(-1).stamp ? "（最新）" : "（過去の実行を表示中）"} ・ model: ${esc(target.model ?? "?")} ・ judge: ${esc(target.judgeModel ?? "なし(--skip-judge)")} ・ votes ${target.votes ?? 1} ・ trials ${target.trials ?? 1} ・ v${esc(target.dsVersion ?? "?")}</div></div>

${baseRun ? compareSection(baseRun, target) : ""}

<h2>履歴推移</h2>
<p class="h2-note">新しい順・${shownRuns.length}/${runs.length} 件${showAll ? "" : "（全件は --all）"}。列は kind でグループ化 — 緑帯 regression は 100% 維持が前提、琥珀帯 capability は改善メーター。</p>
<div class="matrix-wrap"><table class="matrix"><thead>${hasCapability ? bandRow : ""}${headRow}</thead><tbody>${matrixRows}</tbody></table></div>
<p class="muted">✓ PASS / ✗ FAIL（品質） / G 生成失敗 / J 審査不能（G/J は品質シグナルでない） / · その実行の対象外 / * 機械チェックのみ / ◀ このレポートの対象実行。
regression の ✗ は即対応、capability の ✗ は改善余地の測定値（exit code にも影響しない）。</p>

<h2>対象実行の詳細</h2>
<p class="h2-note">お題別${caseArg ? ` — ${esc(caseArg)} で絞り込み` : ""}。タブで1件ずつ表示（← → で移動）。FAIL・シグナル検出のトライアルは自動で展開。全 PASS でも行動ログにシグナルは出るので読み飛ばさない。</p>
${tabbar}
${cards}

<footer>relay Design System evals ・ 読み方と所見の書き方: .claude/skills/eval-report/SKILL.md ・
切り分けは「知識 / 基準 / お題」の 3 方向（分水嶺: 正しい知識を持つ理想のエージェントなら安定して合格できるか）</footer>
</div>
<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.tabs [role=tab]'));
  if(!tabs.length)return;
  function select(tab,focus){
    tabs.forEach(function(t){
      var on=t===tab;
      t.setAttribute('aria-selected',on?'true':'false');
      t.tabIndex=on?0:-1;
      t.classList.toggle('active',on);
      var p=document.getElementById(t.getAttribute('aria-controls'));
      if(p)p.hidden=!on;
    });
    if(focus)tab.focus();
    try{history.replaceState(null,'','#case-'+tab.id.slice(4));}catch(e){}
  }
  tabs.forEach(function(t,i){
    t.addEventListener('click',function(){select(t,false);});
    t.addEventListener('keydown',function(e){
      var j=null,k=e.key;
      if(k==='ArrowRight'||k==='ArrowDown')j=(i+1)%tabs.length;
      else if(k==='ArrowLeft'||k==='ArrowUp')j=(i-1+tabs.length)%tabs.length;
      else if(k==='Home')j=0;else if(k==='End')j=tabs.length-1;
      if(j!==null){e.preventDefault();select(tabs[j],true);}
    });
  });
  var m=(location.hash||'').match(/^#case-(.+)$/);
  if(m){var t=document.getElementById('tab-'+m[1]);if(t)select(t,false);}
})();
</script>
</body></html>`;

const outPath = path.join(resultsDir, "report.html");
fs.writeFileSync(outPath, html);
console.log(`evals/results/report.html を生成しました（${(html.length / 1024).toFixed(0)}KB・対象 ${targetResults.length} お題・${jst(target.ranAt ?? target.stamp)} 実行）`);
