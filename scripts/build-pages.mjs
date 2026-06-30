/*
 * build-pages.mjs — generate the multi-page catalog from shared chrome + fragments.
 *
 *   examples/pages/<file>.html   (content-only fragment, the inside of .docs-main)
 *        +  this template  +  NAV (single source)  +  catalog.css / catalog.js
 *        ->  examples/<file>.html   (full page, gitignored — build output)
 *
 * Run:  npm run build:pages   (also runs inside `npm run dev` and `npm run build:site`)
 *
 * Adding a page = drop a fragment in examples/pages/ and add one line to PAGES below.
 * Links are RELATIVE (./button.html) so they work both on the dev server (served
 * at "/") and on GitHub Pages (served under "/relay-design-system/").
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const EXAMPLES = resolve(ROOT, "examples");
const PAGES_DIR = resolve(EXAMPLES, "pages");

// ── 機能 / 使用法 auto-injection ─────────────────────────────────────────────
// The MCP index (dist/mcp-index.json, built by build-mcp.mjs which runs before
// this script — see package.json `dev` / `build:site`) is the single source of
// truth for each component's 機能 (purpose) + 使用法 (OK/NG). A fragment opts in
// with a `<!-- usage:auto:<component-name> -->` marker; we render a card from the
// index in its place. Missing index → markers are left as-is (no failure).
let mcpComponents = new Map();
try {
  const idx = JSON.parse(readFileSync(resolve(ROOT, "dist/mcp-index.json"), "utf8"));
  mcpComponents = new Map((idx.components || []).map((c) => [c.name, c]));
} catch {
  mcpComponents = new Map(); // index not built yet (older checkout) — skip injection
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Render the 機能・使用法 card for a component, or "" if it has no such data. */
function renderUsageCard(c) {
  if (!c || (!c.function && !c.usage)) return "";
  const fn = c.function
    ? `<p class="typo-article text-fg-high">${esc(c.function).replace(/\n/g, "<br>")}</p>`
    : "";
  const li = (mark, cls, t) =>
    `              <li class="flex gap-2"><span class="${cls} shrink-0 font-bold">${mark}</span><span>${esc(t)}</span></li>`;
  const ok = (c.usage?.ok || []).map((t) => li("✓", "text-success-700", t)).join("\n");
  const ng = (c.usage?.ng || []).map((t) => li("✕", "text-negative-600", t)).join("\n");
  const okBlock = ok
    ? `            <div class="p-5">
              <p class="typo-medium font-bold text-success-700 mb-3">OK</p>
              <ul class="typo-small text-fg-middle space-y-2">
${ok}
              </ul>
            </div>`
    : "";
  const ngBlock = ng
    ? `            <div class="p-5 bg-negative-50">
              <p class="typo-medium font-bold text-negative-600 mb-3">NG</p>
              <ul class="typo-small text-fg-middle space-y-2">
${ng}
              </ul>
            </div>`
    : "";
  const grid =
    okBlock || ngBlock
      ? `          <div class="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-stroke-low border-t border-stroke-low">
${[okBlock, ngBlock].filter(Boolean).join("\n")}
          </div>`
      : "";
  return `      <div class="card overflow-hidden mb-8">
        <div class="card-header">
          <h3 class="card-title">機能・使用法</h3>
          <p class="card-subtitle">このコンポーネントの用途と、やりがちな NG パターン</p>
        </div>
        <div class="card-body">
${fn}
        </div>
${grid}
      </div>`;
}

/** Replace every `<!-- usage:auto:<name> -->` marker with the rendered card. */
function injectUsage(content) {
  return content.replace(/<!-- usage:auto:([\w-]+) -->/g, (_, name) =>
    renderUsageCard(mcpComponents.get(name)),
  );
}

// ── Master page list (single source of truth for nav + titles) ──────────────
// group: sidebar group title (pages with the same group are bundled together).
// label: sidebar link text.  title: <title> + landing card heading.
const PAGES = [
  { file: "mcp.html",           group: "イントロダクション", label: "MCP サーバー", title: "MCP サーバー", desc: "AI コーディングツールに relay の規約・トークン・コンポーネントを理解させる" },
  { file: "accessibility.html", group: "イントロダクション", label: "取り組み", title: "アクセシビリティについての取り組み", desc: "WCAG 2.2 AAA に向けたデザインシステムの担保とプロダクト側の責務" },

  { file: "color.html",      group: "Foundations", label: "色",      title: "色",           desc: "カラースケール / セマンティックロール / WCAG コントラスト" },
  { file: "typography.html", group: "Foundations", label: "タイポグラフィ",  title: "タイポグラフィ", desc: "フォントスケール + .typo-* クラス" },
  { file: "layout.html",     group: "Foundations", label: "レイアウト",      title: "レイアウト",     desc: "余白 / 角丸 / 境界線" },
  { file: "effects.html",    group: "Foundations", label: "エフェクト",      title: "エフェクト",     desc: "シャドウ / Opacity" },
  { file: "icons.html",      group: "Foundations", label: "アイコン",          title: "アイコン",        desc: "Lucide スプライト 43 アイコン" },
  { file: "assets.html",     group: "Foundations", label: "アセット",          title: "アセット",        desc: "ロゴ / イラストのダウンロード" },

  { file: "button.html",       group: "Components", label: "ボタン",       title: "ボタン",       desc: "variant × theme × size × state" },
  { file: "icon-button.html",  group: "Components", label: "アイコンボタン",  title: "アイコンボタン",  desc: "アイコンのみのボタン" },
  { file: "label-control.html",group: "Components", label: "ラベルコントロール",title: "ラベルコントロール",desc: "フォーム項目ラベル + バッジ" },
  { file: "input.html",        group: "Components", label: "インプット",        title: "インプット",        desc: "単一行テキスト入力" },
  { file: "search-input.html", group: "Components", label: "サーチインプット", title: "サーチインプット", desc: "検索フィールド + クリア / 送信" },
  { file: "selector.html",     group: "Components", label: "セレクター",     title: "セレクター",     desc: "セレクト / ドロップダウン" },
  { file: "textarea.html",     group: "Components", label: "テキストエリア",     title: "テキストエリア",     desc: "複数行入力 + 文字カウンター" },
  { file: "checkbox.html",     group: "Components", label: "チェックボックス",     title: "チェックボックス",     desc: "チェックボックス + nested" },
  { file: "radio.html",        group: "Components", label: "ラジオ",        title: "ラジオ",        desc: "ラジオボタン + group" },
  { file: "filter-chip.html",  group: "Components", label: "フィルターチップ",  title: "フィルターチップ",  desc: "トグル可能なチップ" },
  { file: "tab.html",          group: "Components", label: "タブ",          title: "タブ",          desc: "タブバー (solid / line)" },
  { file: "table.html",        group: "Components", label: "テーブル",         title: "テーブル",         desc: "項目名が上の比較テーブル" },
  { file: "simple-table.html", group: "Components", label: "シンプルテーブル", title: "シンプルテーブル", desc: "キー / バリュー テーブル" },
  { file: "card.html",         group: "Components", label: "カード",         title: "カード",         desc: "コンテナ (header / body / footer)" },
  { file: "badge.html",        group: "Components", label: "バッジ",        title: "バッジ",        desc: "ステータス / ラベルバッジ" },
  { file: "alert.html",        group: "Components", label: "アラート",        title: "アラート",        desc: "アラート (info / success / warning / negative)" },
  { file: "link-text.html",    group: "Components", label: "リンクテキスト",   title: "リンクテキスト",   desc: "緑下線 + 外部リンクアイコン" },
  { file: "breadcrumb.html",   group: "Components", label: "パンくずリスト",   title: "パンくずリスト",   desc: "chevron 区切りの階層ナビ" },
  { file: "side-nav.html",     group: "Components", label: "サイドナビ",       title: "サイドナビ",       desc: "現在地を示す縦型ナビゲーション" },
  { file: "pagination.html",   group: "Components", label: "ページネーション", title: "ページネーション", desc: "ページ送りナビゲーション" },
  { file: "stepper.html",      group: "Components", label: "ステッパー",       title: "ステッパー",       desc: "複数ステップの進捗表示" },
  { file: "modal.html",        group: "Components", label: "モーダル",         title: "モーダル",         desc: "最前面に重ねる確認ダイアログ" },

  { file: "guidelines.html",   group: "ガイドライン", label: "ガイドライン", title: "ガイドライン", desc: "Checkbox vs Radio / Web Accessibility" },
];

const INDEX = { file: "index.html", title: "relay Design System" };

// ── Sidebar nav (grouped, active link marked) ───────────────────────────────
function navHtml(activeFile) {
  const groups = [];
  for (const p of PAGES) {
    let g = groups.find((x) => x.title === p.group);
    if (!g) { g = { title: p.group, items: [] }; groups.push(g); }
    g.items.push(p);
  }
  // Foundations / Components はアコーディオン (details、初期表示は閉)。開閉状態は
  // catalog.js が localStorage に保存してページ間で引き継ぐ。
  const COLLAPSIBLE = new Set(["Foundations", "Components"]);
  const chevron =
    '<svg class="docs-sidebar-group-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  return groups
    .map((g) => {
      const links = g.items
        .map((p) => {
          const active = p.file === activeFile
            ? ' class="is-active" aria-current="page"'
            : "";
          return `          <a href="./${p.file}"${active}>${p.label}</a>`;
        })
        .join("\n");
      if (COLLAPSIBLE.has(g.title)) {
        return `        <details class="docs-sidebar-group" data-nav-group="${g.title}">
          <summary class="docs-sidebar-group-title">${g.title}${chevron}</summary>
${links}
        </details>`;
      }
      return `        <div class="docs-sidebar-group">
          <div class="docs-sidebar-group-title">${g.title}</div>
${links}
        </div>`;
    })
    .join("\n\n");
}

// ── Breadcrumb (ホーム / グループ / ページ名) ─────────────────────────────────
// Breadcrumb コンポーネント (.breadcrumb) と同じ UI: .link (緑下線) +
// chevron-right 区切り + .breadcrumb-current。group が無いページ (index) では出さない。
const sep =
  '<li class="breadcrumb-sep" aria-hidden="true"><svg class="icon"><use href="./icons.svg#lucide-chevron-right"></use></svg></li>';
function breadcrumb(group, title) {
  if (!group) return "";
  return `      <nav class="breadcrumb max-w-5xl mx-auto px-6 pt-6" aria-label="パンくずリスト">
        <ol>
          <li><a class="link" href="./index.html"><span class="link-label">ホーム</span></a></li>
          ${sep}
          <li><span class="typo-medium text-fg-middle">${group}</span></li>
          ${sep}
          <li><span class="breadcrumb-current" aria-current="page">${title}</span></li>
        </ol>
      </nav>
`;
}

// ── Page template ───────────────────────────────────────────────────────────
function render({ title, group, content, activeFile }) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — relay Design System</title>
  <link rel="stylesheet" href="../src/index.css" />
  <link rel="stylesheet" href="./catalog.css" />
</head>
<body class="bg-neutral-50 text-fg-high font-sans antialiased">
  <div class="docs-layout">
    <aside class="docs-sidebar">
      <div class="docs-sidebar-top">
        <a class="docs-sidebar-brand" href="./index.html">
          <div>
            <div class="brand-name">relay Design System</div>
            <div class="brand-sub">Tailwind v4 · Figma synced</div>
          </div>
        </a>
        <button type="button" class="docs-sidebar-toggle" aria-expanded="false" aria-controls="docs-sidebar-nav" aria-label="メニューを開閉">
          <svg class="icon-menu" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          <svg class="icon-close" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <nav class="docs-sidebar-nav" id="docs-sidebar-nav" aria-label="ドキュメントナビゲーション">
${navHtml(activeFile)}
      </nav>
    </aside>

    <div class="docs-main">
${breadcrumb(group, title)}${content}
    </div>
  </div>

  <script type="module" src="./catalog.js"></script>
</body>
</html>
`;
}

// ── Build ────────────────────────────────────────────────────────────────────
function readFragment(file) {
  try {
    return readFileSync(resolve(PAGES_DIR, file), "utf8").trimEnd();
  } catch {
    throw new Error(`Missing fragment: examples/pages/${file}`);
  }
}

const all = [INDEX, ...PAGES];
let written = 0;
for (const p of all) {
  const content = injectUsage(readFragment(p.file));
  const html = render({ title: p.title, group: p.group, content, activeFile: p.file });
  writeFileSync(resolve(EXAMPLES, p.file), html, "utf8");
  written++;
}

// Sanity: warn about orphan fragments (a fragment with no PAGES entry).
const known = new Set(all.map((p) => p.file));
for (const f of readdirSync(PAGES_DIR)) {
  if (f.endsWith(".html") && !known.has(f)) {
    console.warn(`⚠ orphan fragment (no PAGES entry): examples/pages/${f}`);
  }
}

console.log(`✓ Generated ${written} pages into examples/ (index + ${PAGES.length} others)`);
