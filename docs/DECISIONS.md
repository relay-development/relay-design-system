# 過去の設計判断（Architecture Decision Records）

> ルールとして [DESIGN.md](../DESIGN.md) の Non-Negotiable Principles に昇格した項目（typo セマンティック層 / ARIA 状態 / Blessed Scale 等）は本ファイルには含めない。ここに残るのは **歴史的経緯** や **デザインシステム内部の実装判断**。

## アイコン: Lucide subset を SVG sprite として同梱

`scripts/build-icons.mjs` → `dist/icons.svg`。JS 依存ゼロで vanilla HTML から `<use href="...#lucide-x">` で使える。

## Spacing: Tailwind single-base

`--spacing: 0.25rem` で全 `p-*` / `m-*` を自動派生。`--spacing-0..16` 等の名前付きトークンは追加しない（Tailwind v4 の流儀に合わせる）。

## カタログ用 hover / focus プレビュー

`.is-hover-preview` / `.is-focus-preview` modifier を CSS 側で `:hover` / `:focus-visible` と OR 条件にする。カタログで全状態を静的に可視化するため。

## プレビューサイトのホスティング: Netlify → GitHub Pages

Netlify のクレジット上限超過のため移行済み。GitHub Pages は public repo + Free プランで容量無制限。

## MCP サーバーは既存パッケージに同梱

- `bin: relay-ds-mcp` → `dist/mcp.mjs`
- `@modelcontextprotocol/sdk` は **esbuild でバンドル**して単一ファイル化し devDependency に留める（CSS だけ使う利用者に runtime 依存を増やさない）
- コンテンツは二重管理せず `scripts/build-mcp.mjs` が正本ファイルから `dist/mcp-index.json` を生成 → server にインライン
- **`get_component` の品質は `src/components/*.css` 先頭のヘッダコメント形式（`recreated from Figma component set NNNN:NNNN (和名)` + props + Usage）に依存する**ので、新規コンポーネントでも雛形を必ず踏襲する（ヘッダが無いと doc が空になる）

## コンポーネントの「機能」「使用法(OK/NG)」も CSS ヘッダが正本

- ヘッダに `機能:`（用途・代替コンポーネントとの使い分け）と `使用法:`（`OK:` / `NG:` で始まる行）ブロックを書くと、`build-mcp.mjs` が `function` / `usage{ok,ng}` フィールドに抽出し `get_component` がクラスより前に表示する
- さらに `build-pages.mjs` が `dist/mcp-index.json` を読み、カタログ fragment 内の `<!-- usage:auto:<name> -->` マーカーを「機能・使用法」カードに置換する（人間向け表示も同じ正本から自動生成・二重管理なし）
- **この自動注入のため `dev` / `build:site` は `build:pages` の前に `build:mcp-index` を実行する**（順序を崩さない）
- ブロックの**どの行にも `*/` を書かない**（CSS ブロックコメントが閉じてしまう／ヘッダが途中で切れる）
- `使用法:` があるのに `OK:` / `NG:` 行が無いと build-mcp が warn を出す
