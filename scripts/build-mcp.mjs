/**
 * Build the data index consumed by the relay Design System MCP server.
 *
 *   input:
 *     src/components/*.css   — header doc comment + class selectors per component
 *     src/tokens/*.css        — --token: value pairs grouped by category
 *     snippets/*.html         — copy-paste HTML, matched to a component by basename
 *     examples/pages/assets.html — downloadable brand assets (logo / illustrations)
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

const FIGMA_FILE = "hJcKE8FkiyXtB1F9SuuE08";

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

/** Best-effort one-line summary from the header doc (skips boilerplate lines). */
function deriveSummary(doc, componentName) {
  const lines = doc.split("\n").map((l) => l.trim());
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(componentName)) continue; // title line
    if (/recreated from|component set|props\s*:|Usage\s*:|^\*+$/i.test(line)) continue;
    if (line.endsWith(":")) continue; // sub-header label, not prose
    return line;
  }
  return null;
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
    const nameJa =
      (doc.match(/component set\s+[\d:]+\s*\(([^)]+)\)/) || [])[1] || null;

    let snippet = null;
    if (snippetFiles.has(`${name}.html`)) {
      snippet = (
        await readFile(path.join(snippetsDir, `${name}.html`), "utf8")
      ).trim();
    }

    components.push({
      name,
      nameJa,
      figmaNode,
      summary: deriveSummary(doc, name),
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
  const principles = sliceSection(md, "## Non-Negotiable Principles", "1,2");
  const forbidden = sliceSection(md, "### 禁止パターン要約 (Top 10)", "1,3");
  return { principles, forbidden, full: md };
}

async function main() {
  const pkg = JSON.parse(
    await readFile(path.join(projectRoot, "package.json"), "utf8"),
  );

  const [components, tokens, design, assets] = await Promise.all([
    buildComponents(),
    buildTokens(),
    buildDesign(),
    buildAssets(),
  ]);

  const index = {
    name: pkg.name,
    version: pkg.version,
    figmaFile: FIGMA_FILE,
    catalogUrl: "https://relay-development.github.io/relay-design-system",
    generatedFrom:
      "src/components/*.css, src/tokens/*.css, snippets/*.html, examples/pages/assets.html, DESIGN.md",
    components,
    tokens,
    assets,
    principles: design.principles,
    forbiddenPatterns: design.forbidden,
    designConstitution: design.full,
  };

  const outDir = path.join(projectRoot, "dist");
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "mcp-index.json");
  await writeFile(outFile, JSON.stringify(index, null, 2) + "\n", "utf8");

  const tokenCount = Object.values(tokens).reduce((n, t) => n + t.length, 0);
  console.log(
    `[build-mcp] wrote ${path.relative(projectRoot, outFile)} — ` +
      `${components.length} components, ${tokenCount} tokens, ` +
      `${components.filter((c) => c.snippet).length} snippets, ${assets.length} assets`,
  );
}

main().catch((err) => {
  console.error("[build-mcp] failed:", err);
  process.exit(1);
});
