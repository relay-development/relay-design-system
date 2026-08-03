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
import { createHash } from "node:crypto";
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

// ── Code sample syntax highlighting ──────────────────────────────────────────
// カタログの `<pre class="code-sample" data-code>…</pre>` を、ビルド時に
// タグ / 属性 / 文字列 / 記号へトークン分割してハイライトする。中身は素の
// （エスケープ済み）HTML スニペットを書くだけでよく、手で span を張らない。
// `[[ … ]]` で囲んだ範囲は <mark>（要点ハイライト）になる。
const decodeEntities = (s) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

function highlightHtmlSnippet(rawEscaped) {
  const code = decodeEntities(rawEscaped);
  const escText = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let out = "";
  let i = 0;
  const n = code.length;
  while (i < n) {
    if (code[i] === "<") {
      let j = i + 1;
      let slash = "";
      if (code[j] === "/") { slash = "/"; j++; }
      out += `<span class="tok-punc">&lt;${slash}</span>`;
      let name = "";
      while (j < n && /[a-zA-Z0-9-]/.test(code[j])) { name += code[j]; j++; }
      if (name) out += `<span class="tok-tag">${name}</span>`;
      while (j < n && code[j] !== ">") {
        const ch = code[j];
        if (/\s/.test(ch)) { out += ch; j++; continue; }
        if (ch === "/") { out += `<span class="tok-punc">/</span>`; j++; continue; }
        if (ch === "=") { out += `<span class="tok-punc">=</span>`; j++; continue; }
        if (ch === '"' || ch === "'") {
          let k = j + 1;
          while (k < n && code[k] !== ch) k++;
          out += `<span class="tok-str">${escText(code.slice(j, Math.min(k + 1, n)))}</span>`;
          j = k < n ? k + 1 : n;
          continue;
        }
        let attr = "";
        while (j < n && /[a-zA-Z0-9:_-]/.test(code[j])) { attr += code[j]; j++; }
        if (attr) { out += `<span class="tok-attr">${attr}</span>`; continue; }
        out += escText(ch); j++;
      }
      if (code[j] === ">") { out += `<span class="tok-punc">&gt;</span>`; j++; }
      i = j;
    } else {
      let t = "";
      while (i < n && code[i] !== "<") { t += code[i]; i++; }
      out += escText(t);
    }
  }
  return out.replace(/\[\[/g, "<mark>").replace(/\]\]/g, "</mark>");
}

/** `<pre class="code-sample" data-code>…</pre>` の中身をハイライトして data-code を外す。 */
function highlightCodeSamples(content) {
  return content.replace(
    /<pre ([^>]*?)\bdata-code\b\s*>([\s\S]*?)<\/pre>/g,
    (_, attrs, inner) =>
      `<pre ${attrs.trim()}>${highlightHtmlSnippet(inner)}</pre>`,
  );
}

/** 機能 card — what the component is for. Returns card HTML or "". */
function renderFuncCard(c) {
  if (!c?.function) return "";
  return `      <div class="card mb-8">
        <div class="card-header">
          <h3 class="card-title">機能</h3>
          <p class="card-subtitle">このコンポーネントの用途</p>
        </div>
        <div class="card-body">
          <p class="typo-article text-fg-high">${esc(c.function).replace(/\n/g, "<br>")}</p>
        </div>
      </div>`;
}

/** 使用法 card — OK / NG patterns side by side. Returns card HTML or "". */
function renderGuideCard(c) {
  const li = (mark, cls, t) =>
    `              <li class="flex gap-2"><span class="${cls} shrink-0 font-bold">${mark}</span><span>${esc(t)}</span></li>`;
  const ok = (c?.usage?.ok || []).map((t) => li("✓", "text-success-700", t)).join("\n");
  const ng = (c?.usage?.ng || []).map((t) => li("✕", "text-negative-600", t)).join("\n");
  const okBlock = ok
    ? `            <div class="p-5">
              <p class="typo-medium font-bold text-success-700 mb-3">OK</p>
              <ul class="typo-small text-fg-middle space-y-2">
${ok}
              </ul>
            </div>`
    : "";
  const ngBlock = ng
    ? `            <div class="p-5">
              <p class="typo-medium font-bold text-negative-600 mb-3">NG</p>
              <ul class="typo-small text-fg-middle space-y-2">
${ng}
              </ul>
            </div>`
    : "";
  if (!okBlock && !ngBlock) return "";
  return `      <div class="card overflow-hidden mb-8">
        <div class="card-header">
          <h3 class="card-title">使用法</h3>
          <p class="card-subtitle">推奨される使い方と、やりがちな NG パターン</p>
        </div>
        <div class="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-stroke-low">
${[okBlock, ngBlock].filter(Boolean).join("\n")}
        </div>
      </div>`;
}

// 直前要素に下マージンが無いページ（badge / card 等）でも一定の間隔を保つため、
// 注入の先頭カードに mt-8 を付ける。直前が mb-8 のページでは隣接マージンが相殺され 32px のまま。
const withTopMargin = (html) =>
  html ? html.replace('<div class="card', '<div class="card mt-8') : "";

/** Render the 機能 card + 使用法 card for a component (separate cards), or "". */
function renderUsageCard(c) {
  if (!c || (!c.function && !c.usage)) return "";
  const cards = [renderFuncCard(c), renderGuideCard(c)].filter(Boolean);
  if (cards.length) cards[0] = withTopMargin(cards[0]);
  return cards.join("\n");
}

/**
 * Replace injection markers with rendered cards:
 *   `<!-- usage:auto:<name> -->` → 機能 + 使用法（既存・両方）
 *   `<!-- func:auto:<name> -->`  → 機能のみ
 *   `<!-- guide:auto:<name> -->` → 使用法のみ
 */
function injectUsage(content) {
  return content
    .replace(/<!-- usage:auto:([\w-]+) -->/g, (_, name) =>
      renderUsageCard(mcpComponents.get(name)),
    )
    .replace(/<!-- func:auto:([\w-]+) -->/g, (_, name) =>
      withTopMargin(renderFuncCard(mcpComponents.get(name))),
    )
    .replace(/<!-- guide:auto:([\w-]+) -->/g, (_, name) =>
      withTopMargin(renderGuideCard(mcpComponents.get(name))),
    );
}

// ── リリースログ auto-injection ──────────────────────────────────────────────
// examples/pages/releases.json（正本）から年ごとのタイムラインを描画し、
// releases.html の `<!-- releases:auto -->` マーカーに差し込む。
// リリースエントリの追加手順は docs/RELEASING.md を参照。

// Lucide "tag" — sprite（配布物）を増やさずカタログ専用に inline で使う
const RELEASE_MARKER_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>';

function renderReleaseEntry(r) {
  const tag = `v${r.version}`;
  const url = `https://github.com/relay-development/relay-design-system/releases/tag/${tag}`;
  const [, m, d] = r.date.split("-");
  const dateLabel = `${Number(m)}月${Number(d)}日`;
  return `          <article class="release-entry">
            <span class="release-marker">${RELEASE_MARKER_ICON}</span>
            <div class="release-entry-head">
              <span class="typo-medium font-bold text-fg-high">${esc(tag)} をリリース</span>
              <span class="badge badge-soft-neutral"><time datetime="${esc(r.date)}">${dateLabel}</time></span>
            </div>
            <div class="card">
              <div class="card-header">
                <h4 class="card-title">${esc(r.title)}</h4>
              </div>
              <div class="card-body">
                <p class="typo-article text-fg-high mb-4">${esc(r.summary)}</p>
                <a class="link" href="${url}" target="_blank" rel="noopener noreferrer"><span class="link-label">GitHub リリースノート</span><svg class="icon"><use href="./icons.svg#lucide-external-link"></use></svg></a>
              </div>
            </div>
          </article>`;
}

/** 新しい順のまま年ごとに区切り、年見出し + タイムラインを描画する。 */
function renderReleaseTimeline() {
  const { releases } = JSON.parse(
    readFileSync(resolve(PAGES_DIR, "releases.json"), "utf8"),
  );
  const years = [];
  for (const r of releases) {
    const year = r.date.slice(0, 4);
    let g = years.find((y) => y.year === year);
    if (!g) { g = { year, items: [] }; years.push(g); }
    g.items.push(r);
  }
  return years
    .map(
      (y) => `        <h3 class="typo-xlarge">${y.year}</h3>
        <div class="release-timeline">
${y.items.map(renderReleaseEntry).join("\n")}
        </div>`,
    )
    .join("\n");
}

function injectReleases(content) {
  return content.replace(/<!-- releases:auto -->/g, renderReleaseTimeline);
}

// ── Master page list (single source of truth for nav + titles) ──────────────
// group: sidebar group title (pages with the same group are bundled together).
// label: sidebar link text.  title: <title> + landing card heading.
const PAGES = [
  { file: "mcp.html",           group: "イントロダクション", label: "MCP サーバー", title: "MCP サーバー", desc: "AI コーディングツールに relay の規約・トークン・コンポーネントを理解させる" },
  { file: "accessibility.html", group: "イントロダクション", label: "取り組み", title: "アクセシビリティについての取り組み", desc: "WCAG 2.2 AAA に向けたデザインシステムの担保とプロダクト側の責務" },
  { file: "evals.html",         group: "イントロダクション", label: "品質評価", title: "品質評価（evals）", desc: "AI が DS のルール通りに作れるかを測る定期健康診断とスコアの定点観測" },
  { file: "releases.html",      group: "イントロダクション", label: "リリースログ", title: "リリースログ", desc: "各バージョンの変更点の要約と GitHub リリースノートへのリンク" },

  { file: "color.html",      group: "Foundations", label: "色",      title: "色",           desc: "カラースケール / セマンティックロール / WCAG コントラスト" },
  { file: "typography.html", group: "Foundations", label: "タイポグラフィ",  title: "タイポグラフィ", desc: "フォントスケール + .typo-* クラス" },
  { file: "layout.html",     group: "Foundations", label: "レイアウト",      title: "レイアウト",     desc: "余白 / 角丸 / 境界線" },
  { file: "effects.html",    group: "Foundations", label: "エフェクト",      title: "エフェクト",     desc: "シャドウ / Opacity" },
  { file: "icons.html",      group: "Foundations", label: "アイコン",          title: "アイコン",        desc: "Lucide スプライト 53 アイコン" },
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
  { file: "menu.html",         group: "Components", label: "メニュー",         title: "メニュー",         desc: "縦型のナビ / アクションメニュー" },
  { file: "pagination.html",   group: "Components", label: "ページネーション", title: "ページネーション", desc: "ページ送りナビゲーション" },
  { file: "stepper.html",      group: "Components", label: "ステッパー",       title: "ステッパー",       desc: "複数ステップの進捗表示" },
  { file: "modal.html",        group: "Components", label: "モーダル",         title: "モーダル",         desc: "最前面に重ねる確認ダイアログ" },
  { file: "tooltip.html",      group: "Components", label: "ツールチップ",     title: "ツールチップ",     desc: "ホバー / フォーカスで出る補足の吹き出し" },
  { file: "switch.html",       group: "Components", label: "トグルスイッチ",   title: "トグルスイッチ",   desc: "ON/OFF を即時に切り替えるスイッチ" },
  { file: "page-shell.html",   group: "Components", label: "ページシェル",     title: "ページシェル",     desc: "コンテンツ領域を標準幅に整えるラッパー" },

  // hidden: サイドバーに出さない（checkbox / radio ページ下部のカードリンクからのみ遷移）
  { file: "guidelines.html",   group: "ガイドライン", label: "チェックボックスとラジオボタン", title: "チェックボックスとラジオボタン", desc: "Don't / Good パターン集", hidden: true },
];

const INDEX = {
  file: "index.html",
  title: "relay Design System",
  desc: "Tailwind CSS v4 ベースのフレームワーク非依存デザインシステム。デザイントークン・コンポーネント・AI 連携（MCP / evals）を提供します。",
};

// OGP の絶対 URL 用（GitHub Pages の公開先）
const SITE_URL = "https://relay-development.github.io/relay-design-system/";

// og:image に画像の内容ハッシュを付与する（X 等は og:image の URL 単位で
// カードをキャッシュするため、画像を差し替えても URL が同じだと古いカードが
// 出続ける。内容が変わったときだけ URL が変わり、キャッシュが確実に割れる）
const ogpHash = createHash("md5")
  .update(readFileSync(resolve(__dirname, "../examples/assets/ogp.png")))
  .digest("hex")
  .slice(0, 8);
const OGP_IMAGE_URL = `${SITE_URL}assets/ogp.png?v=${ogpHash}`;

// ── Sidebar nav (grouped, active link marked) ───────────────────────────────
// 項目は DS の menu コンポーネント (menu-group / menu-item) で組む。現在地は
// aria-current="page"。.menu コンテナは使わない (背景・パディングは docs-sidebar
// が兼ねるため。二重になる)。
function navHtml(activeFile) {
  const groups = [];
  for (const p of PAGES) {
    if (p.hidden) continue;
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
          const active = p.file === activeFile ? ' aria-current="page"' : "";
          return `            <li><a class="menu-item menu-item-sm" href="./${p.file}"${active}>${p.label}</a></li>`;
        })
        .join("\n");
      if (COLLAPSIBLE.has(g.title)) {
        return `        <details class="docs-sidebar-group" data-nav-group="${g.title}">
          <summary class="docs-sidebar-group-title">${g.title}${chevron}</summary>
          <ul class="menu-group">
${links}
          </ul>
        </details>`;
      }
      return `        <div class="docs-sidebar-group">
          <div class="docs-sidebar-group-title">${g.title}</div>
          <ul class="menu-group">
${links}
          </ul>
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
function render({ title, group, content, activeFile, desc }) {
  // index はサイト名そのものなので「— relay Design System」を重ねない
  const fullTitle = title === "relay Design System" ? title : `${title} — relay Design System`;
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${fullTitle}</title>
  <meta name="description" content="${desc}" />
  <!-- OGP / X カード（画像はブランドアセット examples/assets/ogp.png・1800x945） -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="relay Design System" />
  <meta property="og:title" content="${fullTitle}" />
  <meta property="og:description" content="${desc}" />
  <meta property="og:url" content="${SITE_URL}${activeFile}" />
  <meta property="og:image" content="${OGP_IMAGE_URL}" />
  <meta name="twitter:card" content="summary_large_image" />
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
            <div class="brand-sub">Tailwind v4</div>
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
  const content = highlightCodeSamples(injectReleases(injectUsage(readFragment(p.file))));
  const html = render({ title: p.title, group: p.group, content, activeFile: p.file, desc: p.desc });
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
