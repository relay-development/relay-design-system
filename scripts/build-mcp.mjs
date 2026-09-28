/**
 * Build the data index consumed by the relay Design System MCP server.
 *
 *   input:
 *     src/components/*.css   — header doc comment + class selectors per component
 *     src/tokens/*.css        — --token: value pairs grouped by category
 *     snippets/*.html         — copy-paste HTML, matched to a component by basename
 *     examples/pages/assets.html — downloadable brand assets (logo / illustrations)
 *     examples/pages/<Patterns>.html — UI patterns (form / feedback …), listed by
 *                               the group: "Patterns" entries of scripts/build-pages.mjs
 *     DESIGN.md               — the design constitution (principles + forbidden patterns)
 *     package.json            — name + version stamped onto the index
 *   output:
 *     dist/mcp-index.json
 *
 *   The MCP server (src/mcp/server.mjs) imports this JSON and esbuild inlines it
 *   into the bundled dist/mcp.mjs, so the server ships as a single self-contained
 *   file with no runtime dependency on this script or the source tree.
 *
 *   Single source of truth stays in the existing files — this script only
 *   re-shapes them. Re-run via `npm run build:mcp` (also part of `npm run build`).
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// Brand assets ship in the repo and are served — with a stable, un-hashed path —
// from raw.githubusercontent.com. The catalog's deployed copies get Vite content
// hashes (relay_main-BDI_TTMS.png), so the GitHub Pages URL is NOT stable; the raw
// URL is. Pinned to `main` so the link tracks the latest committed asset.
const ASSET_RAW_BASE =
  "https://raw.githubusercontent.com/relay-development/relay-design-system/main/examples/assets";

/** Strip /* ... *​/ block comments from CSS so they don't pollute selector parsing. */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Pull the first leading block comment, cleaned of the ` * ` gutter. */
function extractHeaderDoc(css) {
  const m = css.match(/\/\*([\s\S]*?)\*\//);
  if (!m) return "";
  return m[1]
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .trim();
}

/**
 * Collect component class names: every `.foo` that appears in selector position
 * (i.e. in the text before a `{`). This deliberately skips utility names inside
 * `@apply ...;` declarations, which live in the rule body, not the selector.
 */
function extractClasses(css) {
  const body = stripCssComments(css);
  const classes = new Set();
  for (const m of body.matchAll(/([^{}]+)\{/g)) {
    const selector = m[1];
    for (const c of selector.matchAll(/\.(-?[a-zA-Z_][\w-]*)/g)) {
      classes.add(c[1]);
    }
  }
  return [...classes].sort();
}

/**
 * ビルド済み dist/relay.css から「HTML で使える全クラス名」を抽出する。
 * Tailwind の JIT で dist に実在するクラスの権威ある一覧（safelist の実体）。
 * これを index に載せることで、search が「このクラスは効くか」に答えられ、
 * 利用者・AI が実 CSS を grep して確認する必要がなくなる。
 * CSS のエスケープ（`.sm\:flex-row` `.w-1\/2`）は外して HTML 上の表記に戻す。
 */
/** dist/icons.svg（Lucide sprite）の <symbol> を name ごとに切り出す。
 *  get_icon が「外部スプライトを参照できない環境向けの inline 定義」を返すための正本。 */
async function buildIcons() {
  let svg;
  try {
    svg = await readFile(path.join(projectRoot, "dist/icons.svg"), "utf8");
  } catch {
    console.warn("[build-mcp] dist/icons.svg が無いため icons は空（先に npm run build:icons が必要）");
    return [];
  }
  const icons = [];
  for (const m of svg.matchAll(/<symbol id="lucide-([a-z0-9-]+)"([^>]*)>([\s\S]*?)<\/symbol>/g)) {
    const attrs = m[2].trim();
    const body = m[3].replace(/\s+/g, " ").replace(/> </g, "><").trim();
    icons.push({ name: m[1], symbol: `<symbol id="lucide-${m[1]}" ${attrs}>${body}</symbol>` });
  }
  return icons;
}

async function buildAllClasses() {
  const cssPath = path.join(projectRoot, "dist/relay.css");
  let css;
  try {
    css = await readFile(cssPath, "utf8");
  } catch {
    console.warn("[build-mcp] dist/relay.css が無いため allClasses は空（先に vite build が必要）");
    return [];
  }
  const body = stripCssComments(css);
  const set = new Set();
  // `.` + （語字 or バックスラッシュ・エスケープ）の連続。未エスケープの `:`（擬似クラス）で止まる
  for (const m of body.matchAll(/\.((?:[a-zA-Z0-9_%-]|\\.)+)/g)) {
    set.add(m[1].replace(/\\/g, "")); // \: → :, \/ → / に戻す
  }
  return [...set].sort();
}

/** Best-effort one-line summary from the header doc (skips boilerplate lines). */
function deriveSummary(doc, componentName) {
  const lines = doc.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(componentName)) continue; // title line
    if (/recreated from|component set|props\s*:|Usage\s*:|機能\s*:|使用法\s*:|^(OK|NG):|^\*+$/i.test(line)) continue;
    if (line.endsWith(":")) continue; // sub-header label, not prose
    return line;
  }
  return null;
}

/**
 * Pull the indented body under a column-0 `<label>:` line from the de-gutter'd
 * header doc (e.g. "機能" / "使用法"). Stops at the next column-0 label (props:,
 * Usage:, 使用法: …) or end of doc. Returns the trimmed body, or null if absent.
 */
function sliceDocLabel(doc, label) {
  const lines = doc.split("\n");
  const start = lines.findIndex((l) => l.trim() === `${label}:`);
  if (start === -1) return null;
  const body = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") { body.push(""); continue; }
    if (!/^\s/.test(line)) break; // hit the next column-0 label → end of this block
    body.push(line.trim());
  }
  return body.join("\n").trim() || null;
}

/**
 * Split a 使用法 block into { ok[], ng[] } from leading OK:/NG: bullet lines.
 * OK:/NG: で始まらない行は直前の項目の継続行として連結する（例: 長い NG の
 * 「→ 是正」を 2 行目に書くケース。従来は継続行が黙って捨てられていた）。
 */
function parseOkNg(block) {
  if (!block) return null;
  const ok = [];
  const ng = [];
  let current = null; // 直前に push した配列（継続行の連結先）
  for (const raw of block.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(OK|NG):\s*(.+)$/);
    if (m) {
      current = m[1] === "OK" ? ok : ng;
      current.push(m[2].trim());
    } else if (current && current.length) {
      current[current.length - 1] += ` ${line}`;
    }
  }
  return ok.length || ng.length ? { ok, ng } : null;
}

async function buildComponents() {
  const dir = path.join(projectRoot, "src/components");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".css")).sort();

  const snippetsDir = path.join(projectRoot, "snippets");
  const snippetFiles = new Set(
    (await readdir(snippetsDir)).filter((f) => f.endsWith(".html")),
  );

  const components = [];
  for (const file of files) {
    const name = file.replace(/\.css$/, "");
    const css = await readFile(path.join(dir, file), "utf8");
    const doc = extractHeaderDoc(css);

    const figmaNode = (doc.match(/component set\s+([\d:]+)/) || [])[1] || null;
    // Japanese name in the parens after the Figma node id, e.g. "... 3120:1917 (インプット)"
    // "Link (リンクテキスト) — recreated from Figma component 3208:1456" のように、
    // component set でない単体コンポーネントはタイトル行の括弧に和名を置く（link.css）。
    // 従来はこの形式を拾えず nameJa が null になり、list_components / search から和名が落ちていた。
    const nameJa =
      (doc.match(/component set\s+[\d:]+\s*\(([^)]+)\)/) || [])[1] ||
      (doc.match(/^[^\n(]*\(([^)]+)\)\s*—/) || [])[1] ||
      null;

    // 別名 — 利用者が呼びそうな別の言い方（"テキストリンク / text link / anchor"）。
    // search / get_component の索引になる。英名・和名・機能文のどれにも含まれない語で
    // 探されると到達できない（実例: search("テキストリンク") が link を返さず、利用側で
    // テキストリンクが独自クラスで自作された）。
    const aliasBlock = sliceDocLabel(doc, "別名");
    const aliases = aliasBlock
      ? aliasBlock.split(/\s*\/\s*|\n/).map((s) => s.trim()).filter(Boolean)
      : [];

    let snippet = null;
    if (snippetFiles.has(`${name}.html`)) {
      snippet = (
        await readFile(path.join(snippetsDir, `${name}.html`), "utf8")
      ).trim();
    }

    // 機能 (what it's for / when to use vs alternatives) + 使用法 (OK/NG bullets).
    // Optional per component — null until a header is migrated to the new format.
    const functionDoc = sliceDocLabel(doc, "機能");
    const usageBlock = sliceDocLabel(doc, "使用法");
    const usage = parseOkNg(usageBlock);
    if (usageBlock && !usage) {
      console.warn(`[build-mcp] ${file}: 使用法 ブロックがあるが OK:/NG: 行を検出できません`);
    }

    // アクセシビリティ — 実装時に必須の a11y 対応を 1 行 1 項目で。get_component が
    // 使用法の直後に出す。詳細な WCAG チェックリストは get_accessibility（正本は
    // docs/ACCESSIBILITY.md）。
    const a11yBlock = sliceDocLabel(doc, "アクセシビリティ");
    const accessibility = a11yBlock
      ? a11yBlock.split("\n").map((l) => l.trim()).filter(Boolean)
      : null;

    components.push({
      name,
      nameJa,
      aliases,
      figmaNode,
      summary: deriveSummary(doc, name),
      function: functionDoc,
      usage,
      accessibility,
      classes: extractClasses(css),
      doc,
      snippet,
    });
  }
  return components;
}

async function buildTokens() {
  const dir = path.join(projectRoot, "src/tokens");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".css")).sort();

  // First pass: collect raw name→value across ALL token files (semantic tokens
  // reference primitives via var(--…), so we need the full map to resolve them).
  const rawByCat = {};
  const raw = {};
  for (const file of files) {
    const category = file.replace(/\.css$/, "");
    const css = stripCssComments(await readFile(path.join(dir, file), "utf8"));
    const entries = [];
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      const name = m[1];
      const value = m[2].trim().replace(/\s+/g, " ");
      entries.push({ name, value });
      raw[name] = value;
    }
    rawByCat[category] = entries;
  }

  // Resolve a value to its final literal (e.g. var(--color-brand-green-500) → #30b686).
  const resolve = (value, depth = 0) => {
    if (depth > 10) return value;
    const m = value.match(/^var\((--[\w-]+)\)$/);
    if (m && raw[m[1]] !== undefined) return resolve(raw[m[1]], depth + 1);
    return value;
  };

  // Second pass: emit resolved values. `via` records the immediate semantic→primitive
  // alias so consumers can see e.g. primary-500 = #30b686 (= brand-green-500).
  const tokens = {};
  for (const [category, entries] of Object.entries(rawByCat)) {
    tokens[category] = entries.map(({ name, value }) => {
      const resolved = resolve(value);
      const out = { name, value: resolved };
      const ref = value.match(/^var\((--color-[\w-]+)\)$/);
      if (ref && resolved !== value) out.via = ref[1].replace(/^--color-/, "");
      return out;
    });
  }
  return tokens;
}

/**
 * Parse the downloadable assets out of the catalog's assets page. Each asset
 * card carries an <img>, a human label, and a download <a>; we key off the
 * download link so page-only decorations (bg blur, hero art) are excluded.
 * The page fragment is the single source of truth for "what is published".
 */
async function buildAssets() {
  const file = path.join(projectRoot, "examples/pages/assets.html");
  let html;
  try {
    html = await readFile(file, "utf8");
  } catch {
    return []; // page not present (older checkout) — emit no assets rather than fail
  }

  // Split on the per-card wrapper so img / label / download stay grouped.
  const blocks = html
    .split('<div class="border border-stroke-low rounded-md overflow-hidden">')
    .slice(1);

  const assets = [];
  for (const b of blocks) {
    const name = (b.match(/href="\.\/assets\/([^"]+)"\s+download/) || [])[1];
    if (!name) continue; // no download link → decorative, skip
    const label = (b.match(/font-semibold[^"]*">([^<]+)</) || [])[1]?.trim() || null;
    const alt = (b.match(/<img[^>]*\salt="([^"]*)"/) || [])[1] || null;
    const format = (name.match(/\.([a-z0-9]+)$/i) || [])[1]?.toUpperCase() || null;
    assets.push({
      name,
      label,
      alt,
      format,
      url: `${ASSET_RAW_BASE}/${name}`,
    });
  }
  return assets;
}

/* ------------------------------------------------------------------ patterns */

// カタログのページ名 → コンポーネント名（ページ名とコンポーネント名が違うものだけ）
const PAGE_TO_COMPONENT = { "link-text": "link", table: "data-table" };

const VOID_TAGS = new Set(["br", "img", "input", "hr", "meta", "link", "source", "wbr", "col"]);
// 本文に要らない要素（見本の UI・アイコン）。inert / hidden / data-mcp-skip の付いた要素も飛ばす
const SKIP_TAGS = new Set(["svg", "script", "style", "form", "input", "select", "textarea", "button", "img"]);
const BLOCK_TAGS = new Set(["section", "main", "div", "p", "ul", "ol", "li", "table", "pre", "h1", "h2", "h3", "h4", "h5", "fieldset"]);

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** 自前で書いたカタログの断片 HTML を木にする最小のパーサ（閉じ忘れには寛容） */
function parseHtml(html) {
  const root = { tag: "#root", attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  for (const m of html.matchAll(re)) {
    const [, close, open, rawAttrs, selfClose, text] = m;
    const top = stack[stack.length - 1];
    if (text !== undefined) {
      top.children.push({ tag: "#text", text });
    } else if (open) {
      const attrs = {};
      for (const a of (rawAttrs || "").matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
        attrs[a[1]] = a[2] ?? a[3] ?? a[4] ?? "";
      }
      const node = { tag: open.toLowerCase(), attrs, children: [] };
      top.children.push(node);
      if (!selfClose && !VOID_TAGS.has(node.tag)) stack.push(node);
    } else if (close) {
      const tag = close.toLowerCase();
      const i = stack.map((n) => n.tag).lastIndexOf(tag);
      if (i > 0) stack.length = i;
    }
  }
  return root;
}

const hasClass = (n, c) => (n.attrs?.class || "").split(/\s+/).includes(c);
const isSkipped = (n) =>
  SKIP_TAGS.has(n.tag) || "inert" in n.attrs || "hidden" in n.attrs || "data-mcp-skip" in n.attrs;
const hasBlockChild = (n) => n.children.some((c) => c.tag !== "#text" && !isSkipped(c) && (BLOCK_TAGS.has(c.tag) || hasBlockChild(c)));

function textContent(n) {
  if (n.tag === "#text") return decodeEntities(n.text);
  return n.children.map(textContent).join("");
}

/** リンク先を MCP のツール呼び出しに言い換える（カタログのページはエージェントから開けないため） */
function linkTarget(href, patternFiles, componentNames) {
  const m = href.match(/^\.\/([\w-]+)\.html(?:#.*)?$/);
  if (!m) return /^https?:/.test(href) ? href : null;
  if (patternFiles.has(m[1])) return `get_pattern("${m[1]}")`;
  const comp = PAGE_TO_COMPONENT[m[1]] || m[1];
  if (componentNames.has(comp)) return `get_component("${comp}")`;
  return null;
}

function inline(n, ctx) {
  if (n.tag === "#text") return decodeEntities(n.text).replace(/\s+/g, " ");
  if (isSkipped(n)) return "";
  if (n.tag === "br") return " / ";
  // チェックリストの行頭の「!」印は飾り
  if (n.tag === "span" && textContent(n).trim() === "!") return "";
  const inner = n.children.map((c) => inline(c, ctx)).join("");
  if (n.tag === "code") return "`" + inner.trim() + "`";
  if (n.tag === "strong" || n.tag === "b") return inner.trim() ? `**${inner.trim()}**` : "";
  if (n.tag === "a") {
    const target = linkTarget(n.attrs.href || "", ctx.patternFiles, ctx.componentNames);
    if (target && /^https?:/.test(target)) return `[${inner.trim()}](${target})`;
    if (target) {
      ctx.links.add(target);
      return `${inner.trim()}（${target}）`;
    }
    return inner;
  }
  return inner;
}

const cleanInline = (s) => s.replace(/\s+/g, " ").replace(/\s+([。、）」])/g, "$1").trim();

function toMarkdown(n, ctx, out) {
  if (n.tag === "#text") {
    const t = cleanInline(inline(n, ctx));
    if (t) out.push(t, "");
    return;
  }
  if (isSkipped(n)) return;
  switch (n.tag) {
    case "h2":
      return; // ページの題は get_pattern の見出しで出す
    case "h3":
    case "h4": {
      const t = cleanInline(inline(n, ctx));
      if (t) out.push(`${n.tag === "h3" ? "##" : "###"} ${t}`, "");
      return;
    }
    case "ul":
    case "ol": {
      let i = 0;
      for (const li of n.children.filter((c) => c.tag === "li" && !isSkipped(c))) {
        i += 1;
        const t = cleanInline(inline(li, ctx));
        if (t) out.push(`${n.tag === "ol" ? `${i}.` : "-"} ${t}`);
      }
      out.push("");
      return;
    }
    case "table": {
      const rows = [];
      let headerRows = 0;
      const walk = (node, inHead) => {
        for (const c of node.children) {
          if (c.tag === "thead") walk(c, true);
          else if (c.tag === "tbody" || c.tag === "tfoot") walk(c, false);
          else if (c.tag === "tr" && !isSkipped(c)) {
            const cells = c.children
              .filter((x) => x.tag === "th" || x.tag === "td")
              .map((x) => cleanInline(inline(x, ctx)).replace(/\|/g, "\\|"));
            rows.push(cells);
            if (inHead) headerRows += 1;
          }
        }
      };
      walk(n, false);
      if (!rows.length) return;
      // 見出し行の無い 2 列の表（simple-table の「項目 → 内容」）は箇条書きにする
      if (!headerRows && rows.every((r) => r.length === 2)) {
        for (const [k, v] of rows) out.push(`- **${k}**: ${v}`);
        out.push("");
        return;
      }
      const width = Math.max(...rows.map((r) => r.length));
      const pad = (r) => [...r, ...Array(width - r.length).fill("")];
      const head = headerRows ? rows[0] : Array(width).fill("");
      const body = headerRows ? rows.slice(1) : rows;
      out.push(`| ${pad(head).join(" | ")} |`, `|${" --- |".repeat(width)}`);
      for (const r of body) out.push(`| ${pad(r).join(" | ")} |`);
      out.push("");
      return;
    }
    case "pre": {
      const code = textContent(n).replace(/\[\[|\]\]/g, "").replace(/^\n+|\s+$/g, "");
      out.push("```html", code, "```", "");
      return;
    }
    case "p":
    case "li":
    case "span": {
      let t = cleanInline(inline(n, ctx));
      if (t === "Good" || t === "Don't") t = `**${t}**`;
      if (t) out.push(t, "");
      return;
    }
    default: {
      // ページの題の行（h2 ＋ pattern バッジ）は get_pattern の見出しで出す
      if (n.children.some((c) => c.tag === "h2")) return;
      if (hasBlockChild(n)) {
        for (const c of n.children) toMarkdown(c, ctx, out);
      } else {
        let t = cleanInline(inline(n, ctx));
        if (t === "Good" || t === "Don't") t = `**${t}**`;
        if (t) out.push(t, "");
      }
    }
  }
}

/**
 * Patterns（複数のコンポーネントを組み合わせた画面の作り方）をカタログのページから取り込む。
 * 一覧の正本は scripts/build-pages.mjs の PAGES（group: "Patterns"）、本文の正本は
 * examples/pages/<name>.html。見本の UI（form・inert・hidden）とアイコンは落とし、
 * カタログへのリンクは get_component / get_pattern の呼び出しに言い換える。
 */
async function buildPatterns(components) {
  const pagesSrc = await readFile(path.join(projectRoot, "scripts/build-pages.mjs"), "utf8");
  const entries = [];
  for (const line of pagesSrc.split("\n")) {
    if (!/group:\s*"Patterns"/.test(line)) continue;
    const field = (k) => (line.match(new RegExp(`${k}:\\s*"([^"]*)"`)) || [])[1];
    const file = field("file");
    if (file) entries.push({ name: file.replace(/\.html$/, ""), title: field("title"), desc: field("desc") });
  }
  const patternFiles = new Set(entries.map((e) => e.name));
  const componentNames = new Set(components.map((c) => c.name));

  const patterns = [];
  for (const e of entries) {
    const html = await readFile(path.join(projectRoot, "examples/pages", `${e.name}.html`), "utf8");
    const ctx = { patternFiles, componentNames, links: new Set() };
    const out = [];
    toMarkdown(parseHtml(html), ctx, out);
    const body = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const links = [...ctx.links];
    patterns.push({
      name: e.name,
      title: e.title,
      summary: e.desc,
      sections: body.split("\n").filter((l) => l.startsWith("## ")).map((l) => l.slice(3)),
      components: links.filter((l) => l.startsWith("get_component")).map((l) => l.match(/"(.+)"/)[1]),
      related: links.filter((l) => l.startsWith("get_pattern")).map((l) => l.match(/"(.+)"/)[1]).filter((n) => n !== e.name),
      body,
    });
  }
  return patterns;
}

/** Slice a markdown section that starts at a heading and ends at the next heading of <= depth. */
function sliceSection(md, startHeading, stopDepths) {
  const lines = md.split("\n");
  const startIdx = lines.findIndex((l) => l.trim() === startHeading);
  if (startIdx === -1) return null;
  const stopRe = new RegExp(`^#{${stopDepths}}\\s`); // e.g. #{1,2} → ## or #
  const out = [lines[startIdx]];
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (stopRe.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out.join("\n").trim();
}

async function buildDesign() {
  const md = await readFile(path.join(projectRoot, "DESIGN.md"), "utf8");
  const philosophy = sliceSection(md, "## デザイン原則", "1,2");
  const principles = sliceSection(md, "## Non-Negotiable Principles", "1,2");
  const forbidden = sliceSection(md, "### 禁止パターン要約", "1,3");
  return { philosophy, principles, forbidden, full: md };
}

/**
 * docs/ACCESSIBILITY.md — WCAG 2.2 (A/AA/AAA) 実務チェックリスト。get_accessibility
 * が全文を返す。DS 担保早見表とプロダクト必須実装表を要約として別途スライスする。
 */
async function buildAccessibility() {
  let md;
  try {
    md = await readFile(path.join(projectRoot, "docs/ACCESSIBILITY.md"), "utf8");
  } catch {
    return null; // 未配置（古い checkout）— get_accessibility は案内のみ返す
  }
  return {
    full: md,
    provides: sliceSection(md, "## 6. DS が既に提供する保証早見表", "1,2"),
    productMust: sliceSection(md, "## 7. プロダクト側で実装が必須なもの", "1,2"),
  };
}

async function main() {
  const pkg = JSON.parse(
    await readFile(path.join(projectRoot, "package.json"), "utf8"),
  );

  const [components, tokens, design, assets, accessibility] = await Promise.all([
    buildComponents(),
    buildTokens(),
    buildDesign(),
    buildAssets(),
    buildAccessibility(),
  ]);

  const allClasses = await buildAllClasses();
  const icons = await buildIcons();
  const patterns = await buildPatterns(components);

  const index = {
    name: pkg.name,
    version: pkg.version,
    catalogUrl: "https://relay-development.github.io/relay-design-system",
    generatedFrom:
      "src/components/*.css, src/tokens/*.css, snippets/*.html, examples/pages/assets.html, examples/pages/<Patterns>.html, DESIGN.md, docs/ACCESSIBILITY.md, .claude/agents/*.md, .claude/workflows/*.js, .claude/hooks/*.mjs",
    components,
    patterns,
    tokens,
    assets,
    allClasses,
    icons,
    designPhilosophy: design.philosophy,
    principles: design.principles,
    forbiddenPatterns: design.forbidden,
    designConstitution: design.full,
    accessibility,
  };

  const outDir = path.join(projectRoot, "dist");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "mcp-index.json");
  await writeFile(outFile, JSON.stringify(index, null, 2) + "\n", "utf8");

  const tokenCount = Object.values(tokens).reduce((n, t) => n + t.length, 0);
  console.log(
    `[build-mcp] wrote ${path.relative(projectRoot, outFile)} — ` +
      `${components.length} components, ${patterns.length} patterns, ${tokenCount} tokens, ` +
      `${components.filter((c) => c.snippet).length} snippets, ${assets.length} assets, ${icons.length} icons, ` +
      `${allClasses.length} classes, ${components.filter((c) => c.function).length} with 機能`,
  );
}

main().catch((err) => {
  console.error("[build-mcp] failed:", err);
  process.exit(1);
});
