/*
 * evals/run.mjs — relay Design System の agent eval ランナー（Phase 1）
 *
 *   固定のお題（cases.mjs）を relay MCP 接続のエージェントに解かせ、
 *   生成物を機械チェックで採点する。「DS を変えたらエージェントの挙動が
 *   壊れていないか」を測る回帰スイート（LLM 審査は Phase 2 で追加予定）。
 *
 * 仕組み:
 *   1. build:mcp-index で作業ツリーの最新知識から MCP インデックスを生成
 *   2. お題ごとに claude CLI をヘッドレス起動（stdio MCP = src/mcp/server.mjs を接続）
 *      → evals/output/<id>.html に単一 HTML を生成させる
 *   3. 機械チェックで採点:
 *      - hardcode  — .claude/hooks/relay-hardcode-gate.mjs をサブプロセス実行
 *                    （利用者に配布しているゲートと同一判定）
 *      - classes   — mustClasses が使われているか / relay クラスの捏造
 *                    variant（例: btn-outline）がないか（dist/mcp-index.json と照合）
 *      - patterns  — mustPatterns（aria-current 等）を満たすか
 *   4. 結果を console と evals/results/<timestamp>.json に出力
 *
 * 実行（サブスク枠で LLM 生成が走る。1 回 = お題数ぶんのエージェント実行）:
 *   npm run eval                     # 全お題
 *   npm run eval -- --case <id>      # 1 お題のみ
 *   npm run eval -- --skip-generate  # 生成を飛ばし既存 output を再採点（無料）
 *
 * 環境変数:
 *   CLAUDE_BIN — claude CLI のパス（未指定なら PATH → VSCode 拡張同梱を探索）
 *   EVAL_MODEL — 生成エージェントのモデル（未指定なら CLI のデフォルト）
 */

import { execFileSync, execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES } from "./cases.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(__dirname, "output");
const resultsDir = path.join(__dirname, "results");
const hookPath = path.join(projectRoot, ".claude/hooks/relay-hardcode-gate.mjs");

const args = process.argv.slice(2);
const onlyCase = args.includes("--case") ? args[args.indexOf("--case") + 1] : null;
const skipGenerate = args.includes("--skip-generate");

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
    "- アイコンが必要な場合は、インライン SVG（<symbol> 定義 + <use href=\"#id\">）にするか省略する。外部 .svg ファイルへの参照は書かない。",
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

function checkPatterns(html, mustPatterns) {
  const failed = mustPatterns.filter((p) => !new RegExp(p.pattern).test(html));
  return { pass: failed.length === 0, failed: failed.map((p) => p.label) };
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

const claudeBin = skipGenerate ? null : resolveClaudeBin();
const results = [];

for (const c of cases) {
  const outPath = path.join(outputDir, `${c.id}.html`);
  process.stdout.write(`\n■ ${c.id}\n`);

  if (!skipGenerate) {
    process.stdout.write("  生成中…（数分かかることがあります）\n");
    const gen = generate(claudeBin, c);
    if (!gen.ok) {
      console.error(`  ✗ 生成失敗: ${gen.detail}`);
      results.push({ id: c.id, generated: false, pass: false });
      continue;
    }
  }
  if (!fs.existsSync(outPath)) {
    console.error(`  ✗ 生成物がありません: evals/output/${c.id}.html`);
    results.push({ id: c.id, generated: false, pass: false });
    continue;
  }

  const html = fs.readFileSync(outPath, "utf8");
  const hardcode = checkHardcode(outPath);
  const classes = checkClasses(html, c.mustClasses, known);
  const patterns = checkPatterns(html, c.mustPatterns);
  const pass = hardcode.pass && classes.pass && patterns.pass;

  console.log(`  ${hardcode.pass ? "✓" : "✗"} hardcode${hardcode.pass ? "" : ` — ${hardcode.detail.length} 件`}`);
  for (const d of hardcode.detail.slice(0, 5)) console.log(`      ${d.trim()}`);
  console.log(`  ${classes.pass ? "✓" : "✗"} classes${classes.missing.length ? ` — 必須クラス不足: ${classes.missing.join(", ")}` : ""}${classes.invented.length ? ` — 捏造 variant: ${classes.invented.join(", ")}` : ""}`);
  console.log(`  ${patterns.pass ? "✓" : "✗"} patterns${patterns.failed.length ? ` — 未達: ${patterns.failed.join(" / ")}` : ""}`);

  results.push({ id: c.id, generated: true, pass, hardcode, classes, patterns });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const summary = {
  ranAt: new Date().toISOString(),
  dsVersion: JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8")).version,
  model: process.env.EVAL_MODEL ?? "(cli default)",
  skipGenerate,
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  results,
};
const resultPath = path.join(resultsDir, `${stamp}.json`);
fs.writeFileSync(resultPath, JSON.stringify(summary, null, 2));

console.log(`\n== ${summary.passed}/${summary.total} PASS ==`);
console.log(`結果: evals/results/${path.basename(resultPath)}（生成物: evals/output/*.html をブラウザで目視可）`);
process.exit(summary.passed === summary.total ? 0 : 1);
