/*
 * check-consistency.mjs — 正本と派生ドキュメントの整合性チェック
 *
 *   コードが正本、ドキュメントは派生。人力更新に頼っていた数の表記や規約を
 *   機械照合し、ズレた瞬間に CI（check-consistency.yml）で PR を落とす。
 *   （SmartHR Design System の coverage / checklist-sync 方式を relay 向けに縮約）
 *
 * チェック内容:
 *   1. アイコン数     — 正本: scripts/build-icons.mjs の ICONS 配列
 *                        照合先: README / DESIGN.md ×2 / docs/ICONS.md /
 *                                examples/pages/index.html / scripts/build-pages.mjs
 *   2. コンポーネント数 — 正本: scripts/build-pages.mjs の Components グループ
 *                        照合先: README の見出しと表の行数 / docs/INTRODUCTION.md
 *   3. ヘッダ規約     — src/components/*.css 先頭コメントに 機能: / 使用法: が
 *                        あること（MCP get_component の正本のため必須）
 *   4. index.css      — src/tokens/ と src/components/ の全ファイルが import され、
 *                        tokens → components の順序が守られていること
 *
 * 実行: npm run check:consistency（依存パッケージ不要・ネットワーク不要）
 *
 * 表記のパターンが見つからない場合もエラーにする（文言を変えたら本スクリプトの
 * CLAIMS も更新すること。見つからないまま素通りさせると検査が形骸化するため）。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const read = (rel) => fs.readFileSync(path.join(projectRoot, rel), "utf8");

/** @type {{check: string, message: string}[]} */
const violations = [];
const fail = (check, message) => violations.push({ check, message });

// ---------------------------------------------------------------------------
// 1. アイコン数 — ICONS 配列（正本）と各ドキュメントの数表記を照合
// ---------------------------------------------------------------------------

function countIcons() {
  const src = read("scripts/build-icons.mjs");
  const m = src.match(/export const ICONS = \[([\s\S]*?)\];/);
  if (!m) throw new Error("scripts/build-icons.mjs から ICONS 配列を見つけられません");
  const body = m[1].replace(/\/\/[^\n]*/g, ""); // コメント行を除去
  return (body.match(/"[a-z0-9-]+"/g) ?? []).length;
}

// 各ドキュメントの数表記。文言を変更したらここも更新する
const ICON_CLAIMS = [
  { file: "README.md", pattern: /アイコン（Lucide SVG sprite・(\d+) 種）/ },
  { file: "DESIGN.md", pattern: /Lucide SVG sprite, (\d+) icons/ },
  { file: "DESIGN.md", pattern: /Lucide subset (\d+) icons/ },
  { file: "docs/ICONS.md", pattern: /(\d+) アイコンを SVG sprite として同梱/ },
  { file: "examples/pages/index.html", pattern: /Lucide スプライト (\d+) アイコン/ },
  { file: "scripts/build-pages.mjs", pattern: /Lucide スプライト (\d+) アイコン/ },
];

function checkIconCount() {
  const actual = countIcons();
  for (const { file, pattern } of ICON_CLAIMS) {
    const m = read(file).match(pattern);
    if (!m) {
      fail("icon-count", `${file}: アイコン数の表記が見つかりません（期待パターン: ${pattern}）。文言を変えた場合は scripts/check-consistency.mjs の ICON_CLAIMS を更新してください`);
      continue;
    }
    if (Number(m[1]) !== actual) {
      fail("icon-count", `${file}: アイコン数の表記が ${m[1]} ですが、正本（scripts/build-icons.mjs の ICONS）は ${actual} です`);
    }
  }
}

// ---------------------------------------------------------------------------
// 2. コンポーネント数 — カタログの Components グループ（正本）と README / INTRODUCTION
//    ※ src/components/ のファイル数とは意図的に一致しない（icon / typography は
//      Foundations、select は selector の縮小版でカタログ非掲載）
// ---------------------------------------------------------------------------

function checkComponentCount() {
  const catalogCount = (read("scripts/build-pages.mjs").match(/group: "Components"/g) ?? []).length;

  const readme = read("README.md");
  const heading = readme.match(/## コンポーネント一覧（(\d+) 個）/);
  if (!heading) {
    fail("component-count", "README.md: 「## コンポーネント一覧（N 個）」の見出しが見つかりません");
  } else if (Number(heading[1]) !== catalogCount) {
    fail("component-count", `README.md: 見出しは「${heading[1]} 個」ですが、正本（build-pages.mjs の Components グループ）は ${catalogCount} です`);
  }

  // 見出し直後の表の行数（「| 1 | Button | ... |」形式）も照合
  const section = readme.split(/## コンポーネント一覧/)[1]?.split(/\n## /)[0] ?? "";
  const rows = (section.match(/^\| \d+ \|/gm) ?? []).length;
  if (rows !== catalogCount) {
    fail("component-count", `README.md: コンポーネント一覧の表が ${rows} 行ですが、正本は ${catalogCount} です。表への追記漏れを確認してください`);
  }

  const intro = read("docs/INTRODUCTION.md").match(/\*\*(\d+) 種類のコンポーネント\*\*/);
  if (!intro) {
    fail("component-count", "docs/INTRODUCTION.md: 「**N 種類のコンポーネント**」の表記が見つかりません");
  } else if (Number(intro[1]) !== catalogCount) {
    fail("component-count", `docs/INTRODUCTION.md: 「${intro[1]} 種類」ですが、正本は ${catalogCount} です`);
  }
}

// ---------------------------------------------------------------------------
// 3. ヘッダ規約 — 先頭コメントに 機能: / 使用法: / アクセシビリティ:（MCP get_component の正本）
// ---------------------------------------------------------------------------

function checkComponentHeaders() {
  const dir = path.join(projectRoot, "src/components");
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith(".css")).sort()) {
    const src = fs.readFileSync(path.join(dir, name), "utf8");
    const rel = `src/components/${name}`;
    if (!src.startsWith("/*")) {
      fail("component-header", `${rel}: 先頭がヘッダコメントで始まっていません（雛形は docs/COMPONENT-WORKFLOW.md Phase 2）`);
      continue;
    }
    const header = src.slice(0, src.indexOf("*/"));
    for (const sectionName of ["機能:", "使用法:", "アクセシビリティ:"]) {
      if (!header.includes(sectionName)) {
        fail("component-header", `${rel}: ヘッダコメントに「${sectionName}」セクションがありません（MCP get_component の正本のため必須）`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 4. index.css — import の完全性と tokens → components の順序
// ---------------------------------------------------------------------------

function checkIndexCss() {
  const lines = read("src/index.css").split("\n");
  const imports = []; // { kind, name, line }
  lines.forEach((text, i) => {
    const m = text.match(/^@import "\.\/(tokens|components)\/([a-z0-9-]+)\.css";/);
    if (m) imports.push({ kind: m[1], name: m[2], line: i + 1 });
  });

  for (const kind of ["tokens", "components"]) {
    const onDisk = fs
      .readdirSync(path.join(projectRoot, "src", kind))
      .filter((f) => f.endsWith(".css"))
      .map((f) => f.replace(/\.css$/, ""));
    const imported = new Set(imports.filter((im) => im.kind === kind).map((im) => im.name));
    for (const name of onDisk) {
      if (!imported.has(name)) {
        fail("index-css", `src/index.css: src/${kind}/${name}.css が @import されていません（配布 CSS に含まれず、利用者側でクラスが効きません）`);
      }
    }
    for (const name of imported) {
      if (!onDisk.includes(name)) {
        fail("index-css", `src/index.css: 存在しない src/${kind}/${name}.css を @import しています`);
      }
    }
  }

  const lastToken = imports.filter((im) => im.kind === "tokens").at(-1);
  const firstComponent = imports.find((im) => im.kind === "components");
  if (lastToken && firstComponent && lastToken.line > firstComponent.line) {
    fail("index-css", `src/index.css: @import の順序が崩れています（${lastToken.line} 行目の tokens が ${firstComponent.line} 行目の components より後）。tokens → components の順序を守ってください`);
  }
}

// ---------------------------------------------------------------------------

const CHECKS = [
  ["icon-count", checkIconCount],
  ["component-count", checkComponentCount],
  ["component-header", checkComponentHeaders],
  ["index-css", checkIndexCss],
];

for (const [name, run] of CHECKS) {
  const before = violations.length;
  run();
  const count = violations.length - before;
  console.log(count === 0 ? `✓ ${name}` : `✗ ${name} (${count} 件)`);
}

if (violations.length > 0) {
  console.error(`\n${violations.length} 件の不整合が見つかりました:\n`);
  for (const v of violations) console.error(`  [${v.check}] ${v.message}`);
  console.error("\n正本（コード側）が正しい場合はドキュメントの表記を、意図的に表記を変えた場合は scripts/check-consistency.mjs を更新してください。");
  process.exit(1);
}

console.log("\nすべての整合性チェックを通過しました。");
