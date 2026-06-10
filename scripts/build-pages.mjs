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

// ── Master page list (single source of truth for nav + titles) ──────────────
// group: sidebar group title (pages with the same group are bundled together).
// label: sidebar link text.  title: <title> + landing card heading.
const PAGES = [
  { file: "accessibility.html", group: "アクセシビリティ", label: "取り組み", title: "アクセシビリティについての取り組み", desc: "WCAG 2.1 AAA に向けた DS の担保とプロダクト側の責務" },

  { file: "color.html",      group: "Foundations", label: "色",      title: "色",           desc: "カラースケール / セマンティックロール / WCAG コントラスト" },
  { file: "typography.html", group: "Foundations", label: "タイポグラフィ",  title: "タイポグラフィ", desc: "フォントスケール + .typo-* クラス" },
  { file: "layout.html",     group: "Foundations", label: "レイアウト",      title: "レイアウト",     desc: "余白 / 角丸 / 境界線" },
  { file: "effects.html",    group: "Foundations", label: "エフェクト",      title: "エフェクト",     desc: "シャドウ / Opacity" },
  { file: "icons.html",      group: "Foundations", label: "アイコン",          title: "アイコン",        desc: "Lucide スプライト 38 アイコン" },

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
  { file: "simple-table.html", group: "Components", label: "シンプルテーブル", title: "シンプルテーブル", desc: "キー / バリュー テーブル" },
  { file: "card.html",         group: "Components", label: "カード",         title: "カード",         desc: "コンテナ (header / body / footer)" },
  { file: "badge.html",        group: "Components", label: "バッジ",        title: "バッジ",        desc: "ステータス / ラベルバッジ" },
  { file: "alert.html",        group: "Components", label: "アラート",        title: "アラート",        desc: "アラート (info / success / warning / negative)" },

  { file: "guidelines.html",   group: "ガイドライン", label: "ガイドライン", title: "ガイドライン", desc: "Checkbox vs Radio / Web Accessibility" },
];

const INDEX = { file: "index.html", title: "Relay Design System" };

// ── Sidebar nav (grouped, active link marked) ───────────────────────────────
function navHtml(activeFile) {
  const groups = [];
  for (const p of PAGES) {
    let g = groups.find((x) => x.title === p.group);
    if (!g) { g = { title: p.group, items: [] }; groups.push(g); }
    g.items.push(p);
  }
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
      return `        <div class="docs-sidebar-group">
          <div class="docs-sidebar-group-title">${g.title}</div>
${links}
        </div>`;
    })
    .join("\n\n");
}

// ── Page template ───────────────────────────────────────────────────────────
function render({ title, content, activeFile }) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Relay Design System</title>
  <link rel="stylesheet" href="../src/index.css" />
  <link rel="stylesheet" href="./catalog.css" />
</head>
<body class="bg-neutral-50 text-fg-high font-sans antialiased">
  <div class="docs-layout">
    <aside class="docs-sidebar">
      <a class="docs-sidebar-brand" href="./index.html">
        <div>
          <div class="brand-name">relay Design System</div>
          <div class="brand-sub">Tailwind v4 · Figma synced</div>
        </div>
      </a>

      <nav class="docs-sidebar-nav" aria-label="ドキュメントナビゲーション">
${navHtml(activeFile)}
      </nav>
    </aside>

    <div class="docs-main">
${content}
    </div>
  </div>

  <script src="./catalog.js"></script>
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
  const content = readFragment(p.file);
  const html = render({ title: p.title, content, activeFile: p.file });
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
