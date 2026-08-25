/*
 * relay hardcode gate — Claude Code PostToolUse hook (Write|Edit)
 *
 * relay DS のハードコード違反（軸A 相当）を、evaluator が見つける前に
 * 「書き込んだ直後」に検知して Claude へ即フィードバックする品質ゲート。
 * 検知したら exit 2 で stderr の内容が Claude に返り、その場で修正させる。
 *
 * 検査対象: .html / .css / .jsx / .tsx / .vue / .svelte
 * 検査項目（generator セルフチェック / evaluator 軸A と同一基準）:
 *   - 生 hex / rgb() 色（color-mix・var()・ブランド色コメント行を除く）
 *   - font-size 生 px / 生 var(--text-*)（.typo-* 未使用）
 *   - 祝福外 spacing（var(--spacing) * N, N ∉ {0,1,2,3,4,6,8,12,16}）
 *   - letter-spacing 生 em / font-weight 生数値（var() 行を除く）
 *   - 生 px の border-radius / box-shadow（var() 行を除く）
 *   - 独自状態クラス is-{selected,active,pressed,current}（ARIA 化されているべき）
 *   - 外部スプライト参照 <use href="….svg#…">（file:// でブロックされる）
 *
 * 例外（DESIGN.md 準拠）: 第三者ブランド色は同一行のコメントに「ブランド」または
 * "brand" と明記すればスキップされる。構造ジオメトリの実 px（width/height 等）は
 * そもそも検査対象外。
 *
 * 導入（利用側プロジェクトの .claude/settings.json）:
 *   { "hooks": { "PostToolUse": [ { "matcher": "Write|Edit",
 *     "hooks": [ { "type": "command", "command": "node .claude/hooks/relay-hardcode-gate.mjs" } ] } ] } }
 *
 * --include <正規表現>（任意）: file_path がマッチするファイルだけを検査する。
 * relay-design-system リポジトリ自体での有効化に使う — DS ソース（src/ のトークン定義・
 * ヘッダコメントで管理された正当な例外を含むコンポーネント CSS）や、トークン実値を
 * 文中に表記するカタログ断片（examples/pages/）を誤検知しないよう、エージェント生成物と
 * 利用者向けコードだけにスコープする（配線は .claude/settings.json）。
 * 利用側プロジェクトは従来どおり引数なし = 全対象ファイル検査で変更なし。
 */
import { readFileSync } from "node:fs";

const TARGET_EXT = /\.(html|css|jsx|tsx|vue|svelte)$/i;
const BLESSED = new Set(["0", "1", "2", "3", "4", "6", "8", "12", "16"]);

function checkLine(line) {
  const hits = [];
  const skipBrand = /ブランド|brand/i.test(line);
  const skipVar = /var\(/.test(line);
  // var(...) / color-mix(...) の中身は正当なので除去してから生色を探す
  // （行単位スキップだと var() と同居する生 hex を見逃す）
  const colorScan = line.replace(/color-mix\([^;]*\)/g, "").replace(/var\([^)]*\)/g, "");

  if (!skipBrand && /#[0-9a-fA-F]{3,8}\b|rgba?\([0-9 ,.%/]+\)/.test(colorScan))
    hits.push("生色（hex/rgb 直書き）→ var(--color-*) か color-mix(in srgb, var(--color-*) N%, transparent) を使う");
  if (/font-size:\s*([0-9]+px|var\(--text-)/.test(line))
    hits.push("font-size 生値 → .typo-{xsmall…3xlarge} クラスを使う");
  for (const m of line.matchAll(/var\(--spacing\)\s*\*\s*([0-9.]+)/g)) {
    if (!BLESSED.has(m[1])) hits.push(`祝福外 spacing（* ${m[1]}）→ {0,1,2,3,4,6,8,12,16} の近傍値に丸める`);
  }
  if (!skipVar && /letter-spacing:\s*[0-9.]+em|font-weight:\s*[0-9]{3}\b/.test(line))
    hits.push("letter-spacing/font-weight 生値 → var(--tracking-*) / var(--font-weight-*) を使う");
  if (!skipVar && /border-radius:\s*[0-9]|box-shadow:\s*[0-9]/.test(line))
    hits.push("border-radius/box-shadow 生値 → var(--radius-*) / var(--shadow-*) を使う");
  if (/\bis-(selected|active|pressed|current)\b/.test(line))
    hits.push("独自状態クラス → aria-selected/aria-pressed/aria-current/:disabled で表現する");
  if (/<use[^>]*href="[^"#]*\.svg#/.test(line))
    hits.push("外部スプライト参照 → インライン SVG か同一文書内 <symbol> + <use href=\"#id\"> にする（file:// でブロックされる）");
  return hits;
}

function main() {
  let input;
  try {
    input = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return 0; // stdin が JSON でない — 邪魔をしない
  }
  const filePath = input?.tool_input?.file_path;
  if (!filePath || !TARGET_EXT.test(filePath)) return 0;

  // --include <正規表現>: マッチするパスだけ検査（DS リポジトリ自身でのスコープ運用向け）
  const includeIdx = process.argv.indexOf("--include");
  if (includeIdx !== -1) {
    const pattern = process.argv[includeIdx + 1];
    try {
      if (!pattern || !new RegExp(pattern).test(filePath)) return 0;
    } catch {
      return 0; // 正規表現が不正 — 邪魔をしない
    }
  }

  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    return 0; // 読めない（削除直後等）— 邪魔をしない
  }

  const violations = [];
  content.split("\n").forEach((line, i) => {
    for (const hit of checkLine(line)) {
      violations.push(`${filePath}:${i + 1} — ${hit}\n    ${line.trim().slice(0, 120)}`);
    }
  });

  if (!violations.length) return 0;

  console.error(
    [
      `⛔ relay hardcode gate: ${filePath} にハードコード違反 ${violations.length} 件。トークン経由に修正してから先に進むこと。`,
      ...violations.slice(0, 20),
      violations.length > 20 ? `…ほか ${violations.length - 20} 件` : "",
      "正当な例外（第三者ブランド色）は同一行のコメントに「ブランド」/ brand と明記する。実値が必要なら relay DS MCP の get_tokens を呼ぶ。",
    ].filter(Boolean).join("\n"),
  );
  return 2; // exit 2: stderr が Claude にフィードバックされる
}

process.exit(main());
