/*
 * evals/run.mjs — relay Design System の agent eval ランナー（Phase 1〜3）
 *
 *   固定のお題（cases.mjs）を relay MCP 接続のエージェントに解かせ、
 *   生成物を機械チェック + LLM 審査員で採点する。「DS を変えたら
 *   エージェントの挙動が壊れていないか」を測る回帰スイート。
 *
 * 仕組み:
 *   1. build:mcp-index で作業ツリーの最新知識から MCP インデックスを生成
 *   2. お題ごとに claude CLI をヘッドレス起動（stdio MCP = src/mcp/server.mjs を接続）
 *      → evals/output/<id>.html に単一 HTML を生成させる
 *   3. 機械チェックで採点（Phase 1）:
 *      - hardcode  — .claude/hooks/relay-hardcode-gate.mjs をサブプロセス実行
 *                    （利用者に配布しているゲートと同一判定）
 *      - classes   — mustClasses が使われているか / relay クラスの捏造
 *                    variant（例: btn-outline）がないか（dist/mcp-index.json と照合）
 *      - patterns  — mustPatterns（aria-current 等）+ 全お題共通の COMMON_PATTERNS
 *                    （lang / img alt / svg の a11y 属性。a11y 責任境界の ⚠️/🔧 由来）
 *   4. LLM 審査員で採点（Phase 2）:
 *      - rubric    — cases.mjs の審査項目を claude CLI（ツールなし・単発）に
 *                    JSON で判定させる。全項目 must 扱いで 1 つでも NO なら不合格。
 *                    判定に迷う場合は不合格に倒す指示（審査の甘化防止）
 *   5. 結果を console と evals/results/<timestamp>.json に出力し、
 *      直前の実行結果と比較して変化を表示する（Phase 3: 定点観測）
 *      結果は pass / fail / error:generation / error:judge の 4 区分で記録し、
 *      品質の失敗と測定側の故障を混同しない（分類規則は status.mjs が正本）
 *
 * 実行（サブスク枠で LLM が走る。1 回 = 生成 お題数 + 審査 お題数×votes）:
 *   npm run eval                     # 全お題（生成 + 機械チェック + LLM 審査）
 *   npm run eval -- --case <id>      # 1 お題のみ
 *   npm run eval -- --skip-generate  # 生成を飛ばし既存 output を再採点（審査のみ消費）
 *   npm run eval -- --skip-judge     # LLM 審査を飛ばし機械チェックのみ（無料）
 *   npm run eval -- --votes 3        # 審査を 3 回実行し多数決（判定のブレ対策。既定 1）
 *   npm run eval:report              # 過去の実行履歴を一覧表示（定点観測ビュー）
 *
 * 環境変数:
 *   CLAUDE_BIN       — claude CLI のパス（未指定なら PATH → VSCode 拡張同梱を探索）
 *   EVAL_MODEL       — 生成エージェントのモデル（未指定なら CLI のデフォルト）
 *   EVAL_JUDGE_MODEL — 審査員のモデル（未指定なら CLI のデフォルト）
 */

import { execFileSync, execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, COMMON_PATTERNS } from "./cases.mjs";
import { STATUS_SYMBOL, classifyResult, isError } from "./status.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(__dirname, "output");
const resultsDir = path.join(__dirname, "results");
const hookPath = path.join(projectRoot, ".claude/hooks/relay-hardcode-gate.mjs");

const args = process.argv.slice(2);
const onlyCase = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;
const skipGenerate = args.includes("--skip-generate");
const skipJudge = args.includes("--skip-judge");
const votes = args.includes("--votes") ? Math.max(1, Number(args[args.indexOf("--votes") + 1]) || 1) : 1;

/* ------------------------------------------------------------- claude CLI */

function resolveClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  try {
    return execSync("command -v claude", { encoding: "utf8", shell: "/bin/zsh" }).trim();
  } catch {
    /* PATH に無い → VSCode 拡張同梱のバイナリを探す */
  }
  const extDir = path.join(process.env.HOME ?? "", ".vscode/extensions");
  const candidates = fs.existsSync(extDir)
    ? fs.readdirSync(extDir).filter((d) => d.startsWith("anthropic.claude-code-")).sort()
    : [];
  for (const d of candidates.reverse()) {
    const bin = path.join(extDir, d, "resources/native-binary/claude");
    if (fs.existsSync(bin)) return bin;
  }
  throw new Error(
    "claude CLI が見つかりません。PATH に追加するか CLAUDE_BIN で指定してください（npm i -g @anthropic-ai/claude-code でも可）",
  );
}

/* ------------------------------------------------------------- 生成 */

const MCP_CONFIG = JSON.stringify({
  mcpServers: { "relay-ds": { command: "node", args: ["src/mcp/server.mjs"] } },
});

function generationPrompt(c) {
  return [
    "あなたは relay Design System を使って UI を実装するエージェントです。",
    "",
    `以下の要件を満たす完全な単一 HTML ページを作成し、Write ツールで evals/output/${c.id}.html に保存してください。`,
    "",
    `要件: ${c.prompt}`,
    "",
    "制約:",
    "- relay Design System の仕様は MCP ツール（relay-ds）で必ず確認しながら実装すること。",
    "- CSS は同じディレクトリに relay.css として配置済み。<head> で <link rel=\"stylesheet\" href=\"./relay.css\"> を読み込むこと（npm セットアップは不要）。",
    "- アイコンが必要な場合は、インライン SVG（<symbol> 定義 + <use href=\"#id\">）にするか省略する（アイコン用の外部 .svg 参照は書かない）。",
    "- ロゴ・イラストが必要な場合は list_assets の直リンク URL を <img> でそのまま使う（独自に描かない）。",
    "- 完成したら保存したファイルパスを 1 行報告して終了。",
  ].join("\n");
}

function generate(claudeBin, c) {
  const cliArgs = [
    "-p",
    generationPrompt(c),
    "--mcp-config",
    MCP_CONFIG,
    "--strict-mcp-config",
    "--allowedTools",
    "Write,mcp__relay-ds",
    "--max-turns",
    "50",
  ];
  if (process.env.EVAL_MODEL) cliArgs.push("--model", process.env.EVAL_MODEL);
  const res = spawnSync(claudeBin, cliArgs, {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 15 * 60 * 1000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.error) return { ok: false, detail: String(res.error) };
  if (res.status !== 0) return { ok: false, detail: (res.stderr || res.stdout || "").slice(-500) };
  return { ok: true };
}

/* ------------------------------------------------------------- 機械チェック */

/** 配布中の hardcode gate と同一判定を得る（stdin に PostToolUse 形式を合成） */
function checkHardcode(filePath) {
  const res = spawnSync("node", [hookPath], {
    input: JSON.stringify({ tool_input: { file_path: filePath } }),
    encoding: "utf8",
  });
  if (res.status === 0) return { pass: true, detail: [] };
  return { pass: false, detail: res.stderr.trim().split("\n").slice(1) }; // 先頭行は総括メッセージ
}

function extractClassTokens(html) {
  const tokens = new Set();
  for (const m of html.matchAll(/class\s*=\s*["']([^"']*)["']/g)) {
    for (const t of m[1].split(/\s+/)) if (t) tokens.add(t);
  }
  return [...tokens];
}

function loadKnownClasses() {
  const index = JSON.parse(fs.readFileSync(path.join(projectRoot, "dist/mcp-index.json"), "utf8"));
  const known = new Set();
  for (const c of index.components) for (const cls of c.classes) known.add(cls);
  return known;
}

function checkClasses(html, mustClasses, known) {
  const tokens = extractClassTokens(html);
  const tokenSet = new Set(tokens);
  const missing = mustClasses.filter((c) => !tokenSet.has(c));
  // 捏造 variant: relay クラスを接頭辞に持つのに index に存在しないクラス（例: btn-outline）
  const invented = tokens.filter(
    (t) => !known.has(t) && [...known].some((b) => t.startsWith(`${b}-`)),
  );
  return {
    pass: missing.length === 0 && invented.length === 0,
    missing,
    invented: [...new Set(invented)],
  };
}

/** mustPatterns（必須）+ COMMON_PATTERNS（全お題共通。forbid はマッチで不合格）を判定 */
function checkPatterns(html, mustPatterns) {
  const failed = [...COMMON_PATTERNS, ...mustPatterns].filter((p) => {
    const hit = new RegExp(p.pattern).test(html);
    return p.forbid ? hit : !hit;
  });
  return { pass: failed.length === 0, failed: failed.map((p) => p.label) };
}

/* ------------------------------------------------------------- LLM 審査員 */

function judgePrompt(c, html) {
  return [
    "あなたは relay Design System の品質審査員です。デザインシステムのルールに生成 UI が従っているかを厳格に判定します。",
    "",
    `お題（この HTML が満たすべき要件）: ${c.prompt}`,
    "",
    "審査項目:",
    ...c.rubric.map((r, i) => `${i + 1}. ${r}`),
    "",
    "対象 HTML:",
    "```html",
    html,
    "```",
    "",
    "指示:",
    "- ツールは使わず、このメッセージ内の情報だけで判定すること。",
    "- 項目ごとに pass を true / false で判定し、reason に根拠を 40 字以内で書くこと。",
    "- 判定に迷う場合・HTML から確認できない場合は pass: false に倒すこと（甘い審査をしない）。",
    "- 出力は次の JSON のみ。説明文・コードフェンスを付けないこと:",
    `{"verdicts":[{"item":1,"pass":true,"reason":"…"}, …（全 ${c.rubric.length} 項目）]}`,
  ].join("\n");
}

/** 応答から最初の { … 最後の } を JSON として取り出す（フェンス等のノイズ耐性） */
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function judgeOnce(claudeBin, c, html) {
  const cliArgs = [
    "-p",
    judgePrompt(c, html),
    "--strict-mcp-config",
    "--mcp-config",
    '{"mcpServers":{}}',
    "--max-turns",
    "4",
  ];
  if (process.env.EVAL_JUDGE_MODEL) cliArgs.push("--model", process.env.EVAL_JUDGE_MODEL);
  const res = spawnSync(claudeBin, cliArgs, {
    cwd: projectRoot,
    encoding: "utf8",
    timeout: 5 * 60 * 1000,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (res.error || res.status !== 0) return null;
  const parsed = extractJson(res.stdout ?? "");
  return Array.isArray(parsed?.verdicts) ? parsed.verdicts : null;
}

/** votes 回審査して項目ごとに多数決。全項目 must 扱い（1 つでも NO なら不合格） */
function judgeRubric(claudeBin, c, html) {
  const passVotes = c.rubric.map(() => 0);
  const reasons = c.rubric.map(() => "");
  let validVotes = 0;
  for (let v = 0; v < votes; v++) {
    // 応答の解析失敗は審査員側の故障（品質シグナルではない）なので 1 回だけ再試行する
    const verdicts = judgeOnce(claudeBin, c, html) ?? judgeOnce(claudeBin, c, html);
    if (!verdicts) continue;
    validVotes++;
    for (const vd of verdicts) {
      const i = Number(vd.item) - 1;
      if (i < 0 || i >= c.rubric.length) continue;
      if (vd.pass === true) passVotes[i]++;
      else if (!reasons[i]) reasons[i] = String(vd.reason ?? "");
    }
  }
  if (validVotes === 0) {
    return { pass: false, error: "審査員の応答を解析できませんでした（全 votes 失敗）", items: [] };
  }
  const items = c.rubric.map((text, i) => {
    const pass = passVotes[i] > validVotes / 2;
    return { text, pass, ...(pass ? {} : { reason: reasons[i] }) };
  });
  return { pass: items.every((it) => it.pass), items, validVotes };
}

/* ------------------------------------------------------------- 定点観測 */

/** 直前の実行結果（あれば）を読み込む。現在の実行を書き込む前に呼ぶこと */
function loadPreviousSummary() {
  if (!fs.existsSync(resultsDir)) return null;
  const files = fs.readdirSync(resultsDir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) return null;
  try {
    return { file: files.at(-1), ...JSON.parse(fs.readFileSync(path.join(resultsDir, files.at(-1)), "utf8")) };
  } catch {
    return null;
  }
}

function printComparison(prev, results) {
  if (!prev) return;
  const prevById = new Map((prev.results ?? []).map((r) => [r.id, r]));
  const changes = [];
  for (const r of results) {
    const p = prevById.get(r.id);
    if (!p) continue;
    const [ps, rs] = [classifyResult(p), classifyResult(r)];
    if (ps !== rs) changes.push(`  ${STATUS_SYMBOL[ps]}→${STATUS_SYMBOL[rs]} ${r.id}`);
  }
  console.log(`\n== 前回比（${prev.file}）==`);
  if (changes.length) for (const c of changes) console.log(c);
  else console.log("  変化なし");
  if (Boolean(prev.skipJudge) !== skipJudge || Boolean(prev.skipGenerate) !== skipGenerate) {
    console.log("  ※ 前回と実行条件（--skip-*）が異なるため単純比較できない可能性あり");
  }
}

/* ------------------------------------------------------------- main */

const cases = onlyCase ? CASES.filter((c) => c.id === onlyCase) : CASES;
if (!cases.length) {
  console.error(`お題 "${onlyCase}" がありません。利用可能: ${CASES.map((c) => c.id).join(", ")}`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(resultsDir, { recursive: true });

// 常に作業ツリーの最新知識で評価する（DS の変更が index に反映されてから測る）
execFileSync("npm", ["run", "build:mcp-index"], { cwd: projectRoot, stdio: "ignore" });
const known = loadKnownClasses();

// お題の期待値そのもののドリフトを検知する（存在しないクラスを「必須」にすると
// eval が永久に FAIL する。初回実装時に README 由来の btn-danger で実際に起きた）
const badExpectations = CASES.flatMap((c) =>
  c.mustClasses.filter((m) => !known.has(m)).map((m) => `${c.id}: "${m}"`),
);
if (badExpectations.length) {
  console.error("✗ cases.mjs の mustClasses に存在しないクラスがあります（正本: dist/mcp-index.json）:");
  for (const b of badExpectations) console.error(`  - ${b}`);
  process.exit(1);
}

// 生成物をブラウザで目視できるよう配布 CSS を隣に置く（無くても採点は可能）
const builtCss = path.join(projectRoot, "dist/relay.css");
if (fs.existsSync(builtCss)) fs.copyFileSync(builtCss, path.join(outputDir, "relay.css"));
else console.warn("⚠ dist/relay.css がありません（npm run build で生成）。採点は可能ですが目視確認はできません。");

const claudeBin = skipGenerate && skipJudge ? null : resolveClaudeBin();
const previous = loadPreviousSummary();
const results = [];

for (const c of cases) {
  const outPath = path.join(outputDir, `${c.id}.html`);
  process.stdout.write(`\n■ ${c.id}\n`);

  if (!skipGenerate) {
    process.stdout.write("  生成中…（数分かかることがあります）\n");
    const gen = generate(claudeBin, c);
    if (!gen.ok) {
      console.error(`  G 生成失敗（ハーネス起因・品質シグナルではない）: ${gen.detail}`);
      results.push({ id: c.id, generated: false, pass: false, status: "error:generation" });
      continue;
    }
  }
  if (!fs.existsSync(outPath)) {
    console.error(`  G 生成物がありません（ハーネス起因・品質シグナルではない）: evals/output/${c.id}.html`);
    results.push({ id: c.id, generated: false, pass: false, status: "error:generation" });
    continue;
  }

  const html = fs.readFileSync(outPath, "utf8");
  const hardcode = checkHardcode(outPath);
  const classes = checkClasses(html, c.mustClasses, known);
  const patterns = checkPatterns(html, c.mustPatterns);

  console.log(`  ${hardcode.pass ? "✓" : "✗"} hardcode${hardcode.pass ? "" : ` — ${hardcode.detail.length} 件`}`);
  for (const d of hardcode.detail.slice(0, 5)) console.log(`      ${d.trim()}`);
  console.log(`  ${classes.pass ? "✓" : "✗"} classes${classes.missing.length ? ` — 必須クラス不足: ${classes.missing.join(", ")}` : ""}${classes.invented.length ? ` — 捏造 variant: ${classes.invented.join(", ")}` : ""}`);
  console.log(`  ${patterns.pass ? "✓" : "✗"} patterns${patterns.failed.length ? ` — 未達: ${patterns.failed.join(" / ")}` : ""}`);

  let rubric = null;
  if (!skipJudge) {
    process.stdout.write(`  審査中…（LLM 審査員 × ${votes}）\n`);
    rubric = judgeRubric(claudeBin, c, html);
    if (rubric.error) {
      console.log(`  J rubric 判定不能（審査員の故障・品質シグナルではない）— ${rubric.error}`);
    } else {
      console.log(`  ${rubric.pass ? "✓" : "✗"} rubric（${rubric.items.filter((i) => i.pass).length}/${rubric.items.length}）`);
      for (const it of rubric.items.filter((i) => !i.pass)) {
        console.log(`      ✗ ${it.text}${it.reason ? ` — ${it.reason}` : ""}`);
      }
    }
  }

  const machinePass = hardcode.pass && classes.pass && patterns.pass;
  const pass = machinePass && (skipJudge || rubric.pass);
  // 審査員が判定不能でも、機械チェックが落ちていれば品質 fail は確定している
  const status = rubric?.error ? (machinePass ? "error:judge" : "fail") : pass ? "pass" : "fail";
  results.push({ id: c.id, generated: true, status, pass, hardcode, classes, patterns, ...(rubric ? { rubric } : {}) });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const errorCount = results.filter((r) => isError(classifyResult(r))).length;
const summary = {
  ranAt: new Date().toISOString(),
  dsVersion: JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")).version,
  model: process.env.EVAL_MODEL ?? "(cli default)",
  judgeModel: skipJudge ? null : process.env.EVAL_JUDGE_MODEL ?? "(cli default)",
  skipGenerate,
  skipJudge,
  votes,
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  errors: errorCount,
  results,
};
const resultPath = path.join(resultsDir, `${stamp}.json`);
fs.writeFileSync(resultPath, JSON.stringify(summary, null, 2));

if (errorCount) {
  console.log(`\n== PASS ${summary.passed} / FAIL ${summary.total - summary.passed - errorCount} / 測定不能 ${errorCount}（全 ${summary.total}）==`);
  console.log("   測定不能（G/J）はハーネス・審査員の故障で、品質シグナルではありません（詳細は結果 JSON の status）");
} else {
  console.log(`\n== ${summary.passed}/${summary.total} PASS ==`);
}
printComparison(previous, results);
console.log(`\n結果: evals/results/${path.basename(resultPath)}（生成物: evals/output/*.html をブラウザで目視可）`);
console.log("履歴の一覧: npm run eval:report");
process.exit(summary.passed === summary.total ? 0 : 1);
