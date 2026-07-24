# relay Design System

relay プロダクトのための、Tailwind CSS v4 ベースのフレームワーク非依存デザインシステムです。
**デザイントークン + コンポーネント** を HTML スニペット集として提供します。
正本はこのリポジトリのコードです。Figma はデザイン探求の場で、そこで固まったデザインをコードに取り込みます。

- 📦 npm: `@light-right/design-system`
- 🌐 プレビューサイト: https://relay-development.github.io/relay-design-system
- 🐛 Issue / 要望: https://github.com/relay-development/relay-design-system/issues

---

## 使い始める

### 1. インストール + CSS を 1 行 import

```bash
npm install @light-right/design-system
```

```ts
// 任意のエントリ（例: main.ts / _app.tsx / app.css）
import "@light-right/design-system/css";
```

これだけで `.btn / .input / .card / .badge / .alert ...` などのクラスと、
`bg-primary-500` / `text-fg-high` などのトークンユーティリティが使えます。

bundler を使わない場合は `<link rel="stylesheet" href="node_modules/@light-right/design-system/dist/relay.css" />` でも同じです。

### 2. すぐ書ける例

```html
<button class="btn btn-md btn-primary">保存</button>

<div class="alert alert-info">
  <div class="alert-body">
    <p class="alert-title">お知らせ</p>
    <p>新しいバージョンが利用可能です。</p>
  </div>
</div>
```

- 全コンポーネントの状態網羅プレビュー: https://relay-development.github.io/relay-design-system
- コピペ用 HTML（主要コンポーネント分）: `node_modules/@light-right/design-system/snippets/*.html`

### 3. トークンだけ使いたい（自前 Tailwind v4 環境がある場合）

```css
@import "tailwindcss";
@import "@light-right/design-system/tokens";

/* 以降、bg-primary-500 / text-fg-high / shadow-md などが利用可能 */
```

トークンの値一覧（色 / タイポ / 余白 / 角丸 / 影）と使用ルールは [DESIGN.md](DESIGN.md) を参照してください。
すべて CSS 変数なので `:root { --color-primary-500: #ff5a36; }` のように上書き可能です。

### 4. アイコン（Lucide SVG sprite・43 種）

```html
<svg class="icon icon-md">
  <use href="./node_modules/@light-right/design-system/dist/icons.svg#lucide-search"></use>
</svg>
```

サイズクラス・bundler での import 方法・同梱アイコン一覧は [docs/ICONS.md](docs/ICONS.md) を参照。

---

## コンポーネント一覧（25 個）

| # | コンポーネント | 主要クラス |
|---|---|---|
| 1 | Button         | `.btn` + `.btn-{primary,secondary,neutral,negative}` + `.btn-{solid,outline,subtle,ghost}` + `.btn-{sm,md,lg,xl}` |
| 2 | Icon Button    | `.icon-btn` + `.icon-btn-{primary,neutral,negative}` + `.icon-btn-{sm,md,lg}` + `.icon-btn-{solid,outline,ghost}` |
| 3 | Label Control  | `.label-control`, `.label-control-row`, `.label-control-support`, `.label-badge-{required,optional,disabled,private,support}` |
| 4 | Input          | `.input`, `.input-error`, `.input-{sm,md,lg}` |
| 5 | Search Input   | `.search-input`, `.search-input-{field,clear,submit,icon}`, `.search-input-{sm,md,lg}` |
| 6 | Selector       | `.selector`, `.selector-{field,icon,error}`, `.selector-{sm,md,lg}` |
| 7 | Textarea       | `.textarea`, `.textarea-{sm,md}`, `.textarea-control`, `.textarea-footer`, `.textarea-counter` |
| 8 | Checkbox       | `.checkbox`, `.checkbox-{sm,md}`, `.checkbox-error`, `.checkbox-label` |
| 9 | Radio          | `.radio`, `.radio-{sm,md}`, `.radio-error`, `.radio-label`, `.radio-group` |
| 10 | Filter Chip   | `.filter-chip`, `.filter-chip-{main,icon,label,count,check,check-circle}` |
| 11 | Tab           | `.tabs`, `.tabs-{solid,line}`, `.tab`, `.tab-{solid,line}`, `.tab-count` |
| 12 | Table         | `.data-table`（thead が項目名行。Tailwind の `table` ユーティリティと衝突するため `data-` 接頭辞） |
| 13 | Simple Table  | `.simple-table` (`<th>` / `<td>` を子要素として使用、`rowspan` で merge 可) |
| 14 | Card          | `.card`, `.card-elevated`, `.card-{header,title,subtitle,body,footer}` |
| 15 | Badge         | `.badge` + `.badge-{solid,soft}-{neutral,primary,info,success,warning,danger}` |
| 16 | Alert         | `.alert`, `.alert-{neutral,success,negative,warning,info}`, `.alert-{icon,body,title,close}` |
| 17 | Link          | `.link`, `.link-label`（緑下線 + external-link アイコン、enable=primary-700 / hover=primary-800） |
| 18 | Breadcrumb    | `.breadcrumb`, `.breadcrumb-sep`, `.breadcrumb-current`（`.link` + `chevron-right` 区切り） |
| 19 | Menu          | `.menu`, `.menu-group`, `.menu-divider`, `.menu-item`（項目は a / button、現在地は `aria-current="page"`） |
| 20 | Pagination    | `.pagination`, `.pagination-item`, `.pagination-ellipsis`（現在ページは `aria-current="page"`、端の矢印は `aria-disabled="true"`） |
| 21 | Stepper       | `.stepper`, `.stepper-step`, `.stepper-marker`, `.stepper-label`（現在地は `aria-current="step"`、完了は `.is-completed`） |
| 22 | Modal         | `.modal`, `.modal-{header,title,body,footer}`（ネイティブ `<dialog>` ベース。開閉は `showModal()` / `close()`） |
| 23 | Tooltip       | `.tooltip`, `.tooltip-content`, `.tooltip-{top,bottom,left,right}`（CSS のみで動作。関連付けは `aria-describedby`） |
| 24 | Toggle Switch | `.switch`, `.switch-sm`, `.switch-label`（`<input type="checkbox" role="switch">` ベース。ON/OFF は `:checked`） |
| 25 | Page Shell    | `.page-shell`（コンテンツ領域を `--container-page` に中央寄せ。長文本文は `max-w-article`） |

主要コンポーネントの完成形 HTML は `snippets/*.html` を（全コンポーネントのスニペットは MCP `get_component` またはプレビューサイト）、状態網羅は [プレビューサイト](https://relay-development.github.io/relay-design-system) を参照してください。

---

## MCP サーバー（AI コーディングツール連携）

AI（Claude Code / Cursor / claude.ai 等）にこのデザインシステムの**コンポーネント仕様・トークン・必須ルール**を直接読ませる MCP サーバーを提供しています。ハードコード値や規約違反を避けた relay 準拠の UI を生成しやすくなります。

- **ローカル版（stdio）**: npm パッケージに `relay-ds-mcp` として同梱
- **リモート版（URL 登録のみ・Node 不要）**: `https://relay-design-system-mcp.s-taguchi.workers.dev/mcp`

セットアップ手順と 8 つのツールの仕様は [docs/MCP-TOOLS.md](docs/MCP-TOOLS.md) を参照。

---

## コントリビューション

`main` は保護ブランチです。変更はすべて **feature branch → PR → squash merge** で行います。

```bash
git checkout -b <verb>-<scope>       # 例: add-tab-component
# 編集 → commit（Conventional Commits）→ push → PR → squash merge
```

- 開発セットアップ・ブランチ命名・コミット規約・AI ツール利用時のチェックポイント運用: [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)
- コーディング規約（トークン経由必須・禁止パターン）: [DESIGN.md](DESIGN.md)
- 新規コンポーネント追加の定型ワークフロー: [docs/COMPONENT-WORKFLOW.md](docs/COMPONENT-WORKFLOW.md)

---

## ドキュメント一覧

| ファイル | 内容 |
|---|---|
| [DESIGN.md](DESIGN.md) | 1 枚憲法 — トークン値・主要 API・禁止パターン（AI が最初に読む） |
| [CLAUDE.md](CLAUDE.md) | Claude Code 用の運用ガイド（要点 + リンク集） |
| [docs/INTRODUCTION.md](docs/INTRODUCTION.md) | チーム向けオンボーディング（4 つの入り口） |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Git / PR 運用・開発セットアップ |
| [docs/COMPONENT-WORKFLOW.md](docs/COMPONENT-WORKFLOW.md) | Figma → 新規コンポーネント追加の定型手順 |
| [docs/RELEASING.md](docs/RELEASING.md) | npm publish + Slack 通知のリリース手順 |
| [docs/MCP-TOOLS.md](docs/MCP-TOOLS.md) | MCP サーバーのセットアップとツール仕様 |
| [docs/ICONS.md](docs/ICONS.md) | アイコンの使い方・一覧 |
| [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | WCAG 2.2 (A / AA / AAA) 実務チェックリスト |
| [docs/DECISIONS.md](docs/DECISIONS.md) | 過去の設計判断の記録 |
