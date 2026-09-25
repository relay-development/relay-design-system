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

### 4. アイコン（Lucide SVG sprite・58 種）

```html
<svg class="icon icon-md">
  <use href="./node_modules/@light-right/design-system/dist/icons.svg#lucide-search"></use>
</svg>
```

サイズクラス・bundler での import 方法・同梱アイコン一覧は [docs/ICONS.md](docs/ICONS.md) を参照。

---

## コンポーネント一覧（31 個）

| # | コンポーネント | 主要クラス |
|---|---|---|
| 1 | Button         | `.btn` + `.btn-{primary,secondary,neutral,negative}` + `.btn-{solid,outline,subtle,ghost}` + `.btn-{sm,md,lg,xl}` |
| 2 | Icon Button    | `.icon-btn` + `.icon-btn-{primary,neutral,negative}` + `.icon-btn-{sm,md,lg}` + `.icon-btn-{solid,outline,ghost}` |
| 3 | Button Group  | `.btn-group`（中は `.btn` / `.icon-btn` の outline を同じ theme・サイズで。`role="group"` + `aria-label`。分割ボタンは icon-btn ＋ action-menu） |
| 4 | Toggle Button Group | `.toggle-btn-group`, `.toggle-btn-group-vertical`（中は `.btn` / `.icon-btn` の neutral ghost。選択は各ボタンの `aria-pressed`、`data-selection="single\|multiple"` で単一 / 複数選択。`role="group"` + `aria-label`） |
| 5 | Label Control  | `.label-control`, `.label-control-row`, `.label-control-support`, `.label-badge-{required,optional,disabled,private,support}`, `.field-error-text`, `.field-support-text` |
| 6 | Input          | `.input`, `.input-error`, `.input-{sm,md,lg}` |
| 7 | Search Input   | `.search-input`, `.search-input-{field,clear,submit,submit-icon}`, `.search-input-{sm,md,lg}`（`<form role="search">` で包み、送信ボタン（sm は `.search-input-submit-icon`）か Enter で確定してから検索する。`.search-input-icon` は非推奨） |
| 8 | Token Input   | `.token-input`, `.token-input-field`, `.token-input-list`, `.token-input-item`, `.token-input-label`, `.token-input-remove`（複数の値を 1 つずつ追加・削除する入力欄。入力欄 ＋「追加」ボタンの下にトークンを並べる。入力欄の中にトークンを入れない） |
| 9 | Selector       | `.selector`, `.selector-{icon,error}`, `.selector-{sm,md,lg}`（中の select は `.select`。`.selector-field` は非推奨エイリアス） |
| 10 | Textarea       | `.textarea`, `.textarea-{sm,md}`, `.textarea-control`, `.textarea-footer`, `.textarea-counter` |
| 11 | Checkbox       | `.checkbox`, `.checkbox-{sm,md}`, `.checkbox-error`, `.checkbox-label` |
| 12 | Radio          | `.radio`, `.radio-{sm,md}`, `.radio-error`, `.radio-label`, `.radio-group` |
| 13 | Filter Chip   | `.filter-chip`, `.filter-chip-{main,icon,label,count,check,check-circle}` |
| 14 | Tab           | `.tabs`, `.tabs-{solid,line}`, `.tab`, `.tab-{solid,line}`, `.tab-count` |
| 15 | Table         | `.data-table`, `.data-table-fit`, `.data-table-num`, `.data-table-text`, `.data-table-wrap`, `.data-table-filter`, `.data-table-filter-trigger`, `.data-table-filter-panel`, `.data-table-filter-actions`, `.data-table-sort`, `.data-table-sort-icon`, `.data-table-header`, `.data-table-heading`, `.data-table-title`, `.data-table-subtitle`, `.data-table-toolbar`, `.data-table-count`, `.data-table-actions`, `.data-table-filter-field`（表の上の見出し行に、タイトルと、表示件数・表全体への操作（検索・複数条件の絞り込み・書き出し・新規作成）をまとめる。thead が項目名行。列幅は「締める列」だけ fit / num、自由文は text、収まらなければ wrap で横スクロール。列の値での絞り込みは見出しに列フィルター、並べ替えは見出しの文字をボタンにして th に aria-sort。Tailwind の `table` ユーティリティと衝突するため `data-` 接頭辞） |
| 16 | Simple Table  | `.simple-table` (`<th>` / `<td>` を子要素として使用、`rowspan` で merge 可) |
| 17 | Card          | `.card`, `.card-elevated`, `.card-{header,title,subtitle,body,footer}`, `.card-{icon,image,metadata,action}`, `.card-compact`, `.card-body-flush`, `.card-clickable` + `.card-link`（カード全体を 1 つのリンクに。見出しの a の当たり判定を全面に広げる） |
| 18 | Badge         | `.badge` + `.badge-{solid,soft}-{neutral,primary,info,success,warning,danger}` |
| 19 | Alert         | `.alert`, `.alert-{neutral,success,negative,warning,info}`, `.alert-{icon,body,title,close}`（ページ全体に向けた常設のお知らせ） |
| 20 | Inline Message | `.inline-message`, `.inline-message-{success,negative,warning,neutral}`, `.inline-message-sm`, `.inline-message-{icon,text}`（操作した場所の直近に置く結果表示。トースト／スナックバーは用意しない） |
| 21 | Link          | `.link`, `.link-label`, `.link-neutral`, `.link-inverse`（下線 + external-link アイコン。色は緑 primary-700/800 / neutral fg-middle/high / inverse 白＝暗い背景用の 3 種） |
| 22 | Breadcrumb    | `.breadcrumb`, `.breadcrumb-sep`, `.breadcrumb-current`（`.link` + `chevron-right` 区切り） |
| 23 | Menu          | `.menu`, `.menu-group`, `.menu-divider`, `.menu-section`, `.menu-group-title`, `.menu-item`, `.menu-item-sm`（項目は a / button、現在地は `aria-current="page"`、見出し付きグループは section + title、密なナビは sm） |
| 24 | Action Menu   | `.action-menu`, `.action-menu-end`, `.action-menu-item-danger`（Popover API ベース。トリガーに `aria-haspopup="menu"` + `popovertarget`、項目は `.menu-item` + `role="menuitem"`） |
| 25 | Pagination    | `.pagination`, `.pagination-item`, `.pagination-ellipsis`（現在ページは `aria-current="page"`、端の矢印は `aria-disabled="true"`） |
| 26 | Stepper       | `.stepper`, `.stepper-step`, `.stepper-marker`, `.stepper-label`（現在地は `aria-current="step"`、完了は `.is-completed`） |
| 27 | Modal         | `.modal`, `.modal-{header,title,body,footer}`（ネイティブ `<dialog>` ベース。開閉は `showModal()` / `close()`） |
| 28 | Tooltip       | `.tooltip`, `.tooltip-content`, `.tooltip-{top,bottom,left,right}`（CSS のみで動作。関連付けは `aria-describedby`） |
| 29 | Toggle Switch | `.switch`, `.switch-sm`, `.switch-label`（`<input type="checkbox" role="switch">` ベース。ON/OFF は `:checked`） |
| 30 | Accordion     | `.accordion`, `.accordion-item`, `.accordion-trigger`, `.accordion-icon`, `.accordion-label`, `.accordion-panel`（ネイティブ `<details>`/`<summary>` ベース。開閉アイコンは見出しの左） |
| 31 | Page Shell    | `.page-shell`（コンテンツ領域を `--container-page` に中央寄せ）/ `.page-shell-content`（900px に絞る。フォーム / 設定 / 詳細）。長文本文は `max-w-article` |

主要コンポーネントの完成形 HTML は `snippets/*.html` を（全コンポーネントのスニペットは MCP `get_component` またはプレビューサイト）、状態網羅は [プレビューサイト](https://relay-development.github.io/relay-design-system) を参照してください。

---

## MCP サーバー（AI コーディングツール連携）

AI（Claude Code / Cursor / claude.ai 等）にこのデザインシステムの**コンポーネント仕様・トークン・必須ルール**を直接読ませる MCP サーバーを提供しています。ハードコード値や規約違反を避けた relay 準拠の UI を生成しやすくなります。

- **ローカル版（stdio）**: npm パッケージに `relay-ds-mcp` として同梱
- **リモート版（URL 登録のみ・Node 不要）**: `https://relay-design-system-mcp.relaytown.workers.dev/mcp`

セットアップ手順と 9 つのツールの仕様は [docs/MCP-TOOLS.md](docs/MCP-TOOLS.md) を参照。

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
