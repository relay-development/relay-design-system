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
 *   - テキストリンクの自作 — (a) class に underline / text-色 / hover: を直付けした a 要素、または
 *     (b) 独自のリンク系クラス（.text-link / .footer-link / .link-primary 等。DS の link / link-neutral /
 *     link-inverse / link-label 以外で "link" を含む）を持つ a 要素で、relay のアンカー系クラス
 *     （link / btn / menu-item / pagination-item / breadcrumb / tab / sr-only / card-link）が無いもの。
 *     (b) はカード全体リンク等のブロックラッパー（block / flex / grid / absolute 等を併記）を除外。
 *     (c) その独自リンククラスに color / text-decoration を書く CSS 規則（= link の再実装）
 *     （実例: 2026-09 利用側で .link を使わず独自クラスのテキストリンクが実装された）
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

// テキストリンクの自作検知（タグ単位・複数行の a タグにも対応するため行ではなく全文を走査）。
// 素の <a>（ロゴ・画像リンク・カード全体リンク等、class 無し／レイアウト用クラスのみ）は対象外。
// evals/cases.mjs の同名 forbid パターンと同じ判定基準。
// card-link は card-clickable の見出しリンク（DS のクラス。当たり判定をカード全面に広げる）
const DS_ANCHOR_CLASS = /(?:^|\s)(?:link|btn|menu-item|pagination-item|breadcrumb|tab|sr-only|card-link)(?:\s|$)/;
const SELF_STYLED_ANCHOR =
  /(?:^|\s)(?:underline|no-underline|decoration-|hover:|text-(?:primary|secondary|fg|neutral|slate|info|success|warning|negative)\b)/;
// "link" を含むが DS の link 系（link / link-neutral / link-inverse / link-label）でないクラス名
// （.text-link / .footer-link / .skip-link / .link-primary / .textLink 等）
const CUSTOM_LINK_TOKEN = /^(?:[A-Za-z0-9_-]+[Ll]ink[A-Za-z0-9_-]*|link-(?!(?:neutral|inverse|label)$)[A-Za-z0-9_-]+)$/;
const hasCustomLinkClass = (cls) => cls.split(/\s+/).some((t) => CUSTOM_LINK_TOKEN.test(t));
// カード全体リンク（.card-link block 等）はテキストリンクでないので独自クラス判定から外す
const BLOCK_WRAPPER = /(?:^|\s)(?:block|inline-block|flex|inline-flex|grid|absolute|fixed|inset-0)(?:\s|$)/;
const LINK_FIX =
  'class="link" + <span class="link-label">（補助は link-neutral、暗い背景は link-inverse。ボタン形状の導線は btn）';
function checkAnchors(content) {
  const hits = [];
  for (const m of content.matchAll(/<a\b[^>]*>/g)) {
    const cls = (m[0].match(/\bclass="([^"]*)"/) || [])[1];
    if (!cls || DS_ANCHOR_CLASS.test(cls)) continue;
    let why = null;
    if (SELF_STYLED_ANCHOR.test(cls)) why = "a に underline / text-* を直付け";
    else if (hasCustomLinkClass(cls) && !BLOCK_WRAPPER.test(cls)) why = "a に独自のリンククラス";
    if (!why) continue;
    hits.push({
      line: content.slice(0, m.index).split("\n").length,
      text: m[0].replace(/\s+/g, " "),
      hit: `テキストリンクの自作（${why}）→ ${LINK_FIX}`,
    });
  }
  return hits;
}

// 独自リンククラスに color / text-decoration を書く CSS 規則 = link コンポーネントの再実装。
// .css と HTML 内 <style> の両方を対象に、規則ブロック単位で走査する。
const CUSTOM_LINK_SELECTOR =
  /(?:^|[\s,>+~(])\.(?:[A-Za-z0-9_-]+[Ll]ink[A-Za-z0-9_-]*|link-(?!(?:neutral|inverse|label)(?![A-Za-z0-9_-]))[A-Za-z0-9_-]+)(?![A-Za-z0-9_-])/;
function checkCustomLinkCss(content) {
  const hits = [];
  for (const m of content.matchAll(/([^{};]*)\{([^{}]*)\}/g)) {
    const [, rawSelector, body] = m;
    // HTML 内 <style> では直前のタグ末尾 ">" までが巻き込まれるので、最後の ">" 以降をセレクタとみなす
    const cut = rawSelector.lastIndexOf(">") + 1;
    const selector = rawSelector.slice(cut);
    if (!CUSTOM_LINK_SELECTOR.test(selector)) continue;
    if (!/(?:^|[;\s])(?:color|text-decoration(?:-[a-z]+)?)\s*:/.test(body)) continue;
    const start = m.index + cut + (selector.length - selector.trimStart().length);
    hits.push({
      line: content.slice(0, start).split("\n").length,
      text: `${selector.trim().replace(/\s+/g, " ")} { … }`,
      hit: `独自リンククラスの CSS 定義（color / text-decoration）→ link の再実装。a に ${LINK_FIX} を使い、独自定義を消す`,
    });
  }
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
  for (const a of [...checkAnchors(content), ...checkCustomLinkCss(content)]) {
    violations.push(`${filePath}:${a.line} — ${a.hit}\n    ${a.text.slice(0, 120)}`);
  }

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
