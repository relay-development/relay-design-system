# relay Design System

relay プロダクトのための、Tailwind CSS v4 ベースのフレームワーク非依存デザインシステムです。
**デザイントークン + 14 コンポーネント** を HTML スニペット集として提供します。
トークンは Figma ファイル `hJcKE8FkiyXtB1F9SuuE08` の `semantic tokens` コレクションと同期されています。

- 📦 npm: `@light-right/design-system`
- 🌐 プレビューサイト: https://relay-development.github.io/relay-design-system
- 🎨 Figma: `hJcKE8FkiyXtB1F9SuuE08`

---

## チームメンバー向け：プロダクトで使う

### 1. インストール

```bash
npm install @light-right/design-system
```

### 2. CSS を 1 行 import

```ts
// 任意のエントリ（例: main.ts / _app.tsx / app.css）
import "@light-right/design-system/css";
```

これだけで `.btn / .input / .card / .badge / .alert / .filter-chip ...` などのクラスが
使えるようになります。Tailwind の `bg-primary-500` などのトークンユーティリティも有効です。

### 3. すぐ書ける例

```html
<button class="btn btn-md btn-primary">保存</button>

<div class="alert alert-info">
  <div class="alert-body">
    <p class="alert-title">お知らせ</p>
    <p>新しいバージョンが利用可能です。</p>
  </div>
</div>
```

### 4. コンポーネント一覧と HTML スニペット

- 全コンポーネントの状態網羅プレビュー: https://relay-development.github.io/relay-design-system
- コピペ用 HTML: `node_modules/@light-right/design-system/snippets/*.html`

### 5. トークンだけ使いたい（自前 Tailwind 環境がある場合）

```css
@import "tailwindcss";
@import "@light-right/design-system/tokens";

/* 以降、bg-primary-500 / text-fg-high / shadow-md などが利用可能 */
```

### 6. Icons (Lucide)

[Lucide](https://lucide.dev) から 38 アイコンを SVG sprite として同梱しています。JS フレームワーク不要、`currentColor` で着色追従します。

#### Vite / Webpack / Next.js の場合

```ts
import iconsUrl from "@light-right/design-system/icons";

<svg className="icon icon-md">
  <use href={`${iconsUrl}#lucide-search`} />
</svg>
```

#### vanilla HTML の場合

```html
<svg class="icon icon-md">
  <use href="./node_modules/@light-right/design-system/dist/icons.svg#lucide-search"></use>
</svg>
```

#### サイズ

| クラス | px |
|---|---|
| `.icon-xs` | 12 |
| `.icon-sm` | 16 |
| `.icon-md` | 20 (default) |
| `.icon-lg` | 24 |
| `.icon-xl` | 32 |

#### 着色

`currentColor` を継承します。`text-primary-500` / `text-fg-low` などのトークンユーティリティで色付け可能。

#### 同梱アイコン一覧

カタログの [アイコンページ](https://relay-development.github.io/relay-design-system/icons.html) を参照。追加して欲しい Lucide アイコンがあれば GitHub Issue で。

### 7. Issue / 要望

https://github.com/relay-development/relay-design-system/issues

---

## 構成

```
src/
  index.css        ← エントリ（@import "tailwindcss" + tokens + components）
  tokens.css       ← トークンのみのエントリ（プリビルド配布用、plain CSS 変数）
  tokens/          ← @theme によるトークン定義（color/typography/spacing/radius/shadow）
  components/      ← .btn / .input / .card など、@layer components のクラス定義
snippets/          ← 各コンポーネントの貼り付け可能な HTML
examples/
  pages/           ← プレビュー各ページの本文断片（編集する source）
  catalog.css      ← プレビュー共通スタイル
  catalog.js       ← プレビュー共通スクリプト
  *.html           ← build:pages が生成するページ（gitignore）
scripts/
  build-pages.mjs  ← 共通テンプレート + 断片 → examples/*.html を生成
dist/              ← ビルド成果物（relay.css / tokens.css）
```

---

## セットアップ

```bash
npm install
npm run dev        # build:pages 後に起動 → http://localhost:5173/examples/index.html（トップ）
npm run build:pages# examples/*.html を生成（断片 examples/pages/* を編集したら再実行）
npm run build      # dist/relay.css と dist/tokens.css を生成
```

> プレビューは **マルチページ**構成です。トップ（`index.html`）から各コンポーネント／Foundations ページへ遷移できます。ページは `examples/pages/*.html`（本文断片）+ 共通テンプレート（`scripts/build-pages.mjs`）から生成され、生成物 `examples/*.html` は gitignore 対象です。

## 利用側からの使い方

### A. プリビルド CSS をそのまま使う（最もシンプル）

```html
<link rel="stylesheet" href="node_modules/@light-right/design-system/dist/relay.css" />

<button class="btn btn-md btn-primary">保存</button>
```

または bundler 経由:

```js
import "@light-right/design-system/css";
```

### B. 利用側で Tailwind v4 を使い、トークンだけ取り込む

```css
/* app.css */
@import "tailwindcss";
@import "@light-right/design-system/tokens";

/* 以降、bg-primary-500 / text-text-high / shadow-md などが利用可能 */
```

---

## デザイントークン

Tailwind v4 の `@theme` で宣言されており、すべて CSS 変数として上書き可能です。命名は Figma の `semantic tokens` コレクションに準拠します。

### Color

| ロール | キー | 用途 |
|---|---|---|
| Primary (brand-green) | `--color-primary-{50..950}` | ブランドプライマリ。`primary-500 = #30b686` |
| Secondary (brand-yellow) | `--color-secondary-{50..950}` | アクセント / 警告補助 |
| Neutral (slate) | `--color-neutral-{50..950}` | テキスト / 背景 / ボーダー基盤 |
| Success | `--color-success-{50..950}` | 成功状態 |
| Warning | `--color-warning-{50..950}` | 警告状態 |
| Negative | `--color-negative-{50..950}` | エラー / 削除（赤） |
| Info | `--color-info-{50..950}` | 情報 / リンク |

### Role-based (推奨ユース)

| 役割 | キー | 解決値 |
|---|---|---|
| 背景 | `--color-bg-page` | white |
|  | `--color-bg-page-green` | primary-50 |
|  | `--color-bg-surface` | white |
|  | `--color-bg-overlay` | slate-900 @ 60% |
| テキスト | `--color-text-high` | slate-900 |
|  | `--color-text-middle` | slate-700 |
|  | `--color-text-low` | slate-500 |
|  | `--color-text-placeholder` | slate-400 |
|  | `--color-text-disabled` | slate-400 |
|  | `--color-text-high-inverse` | white |
| ボーダー | `--color-border-high` | slate-300 |
|  | `--color-border-middle` | slate-200 |
|  | `--color-border-low` | slate-100 |
| Focus ring | `--color-outline-focus` | blue-600 |

### Typography

| キー | 値 |
|---|---|
| `--font-sans` | "Noto Sans JP" + フォールバック |
| `--text-xs..3xl` | 12 / 14 / 16 / 20 / 24 / 32 / 40 px |
| Line-height | 16 / 24 / 24 / 32 / 32 / 40 / 48 px |
| `--font-weight-{thin..black}` | 100 / 300 / 400 / 500 / 700 / 700 / 900 |

`.typo-medium`（16/24）とは別に、記事・読み物用の独立スケール `.typo-article`（16px / **32px** / regular）があります。長文の可読性のため行間を広く取った用途特化クラスです。

### Spacing

8px グリッドを基本単位とする 9 段階。Tailwind v4 の `--spacing: 0.25rem` から全 `p-*` / `m-*` / `gap-*` / `space-*` ユーティリティが派生。

| Token | px | Tailwind 例 |
|---|---|---|
| `spacing/0`  | 0  | `p-0`, `gap-0` |
| `spacing/1`  | 4  | `p-1`, `gap-1` |
| `spacing/2`  | 8  | `p-2`, `gap-2` |
| `spacing/3`  | 12 | `p-3` |
| `spacing/4`  | 16 | `p-4`, `gap-4` |
| `spacing/6`  | 24 | `gap-6` |
| `spacing/8`  | 32 | `p-8` |
| `spacing/12` | 48 | `mb-12` |
| `spacing/16` | 64 | `py-16` |

### Radius / Shadow

| キー | 値 |
|---|---|
| `--radius-{none,xs,sm,md,lg,xl,2xl,3xl,4xl,full}` | 0 / 2 / 4 / 8 / 12 / 16 / 20 / 24 / 28 / 9999 px |
| `--shadow-sm` | `0 1px 3px 0 rgb(0 0 0 / 0.10)` |
| `--shadow-md` | 2層構成（Figma 仕様） |
| `--shadow-lg` | 2層構成（Figma 仕様） |
| `--shadow-focus-ring` | `0 0 0 3px #2563eb` |
| `--shadow-destructive` | `0 0 0 3px #ef4444` |

### ブランドカラーの上書き例

```css
:root {
  --color-primary-500: #ff5a36; /* 別ブランドカラーに差し替え */
}
```

---

## コンポーネント一覧（23 個）

| # | コンポーネント | 主要クラス |
|---|---|---|
| 1 | Button         | `.btn` + `.btn-{primary,secondary,ghost,danger}` + `.btn-{sm,md,lg,xl}` |
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
| 15 | Badge         | `.badge` + `.badge-{solid,soft}-{neutral,primary,info,success,warning,negative}` |
| 16 | Alert         | `.alert`, `.alert-{neutral,success,negative,warning,info}`, `.alert-{icon,body,title,close}` |
| 17 | Link          | `.link`, `.link-label`（緑下線 + external-link アイコン、enable=primary-700 / hover=primary-800） |
| 18 | Breadcrumb    | `.breadcrumb`, `.breadcrumb-sep`, `.breadcrumb-current`（`.link` + `chevron-right` 区切り） |
| 19 | Side Nav      | `.sidenav`, `.sidenav-group`, `.sidenav-divider`, `.sidenav-item`（現在地は `aria-current="page"`） |
| 20 | Pagination    | `.pagination`, `.pagination-item`, `.pagination-ellipsis`（現在ページは `aria-current="page"`、端の矢印は `aria-disabled="true"`） |
| 21 | Stepper       | `.stepper`, `.stepper-step`, `.stepper-marker`, `.stepper-label`（現在地は `aria-current="step"`、完了は `.is-completed`） |
| 22 | Modal         | `.modal`, `.modal-{header,title,body,footer}`（ネイティブ `<dialog>` ベース。開閉は `showModal()` / `close()`） |
| 23 | （ガイドライン） | デザイン原則・利用上の注意事項（プレビューサイト内）|

各コンポーネントの完成形 HTML は `snippets/*.html` を参照してください。

---

## Figma → コード ワークフロー

このリポジトリは Figma → コードの片方向同期で運用します。

1. `mcp__claude_ai_Figma__get_variable_defs` または Plugin API 経由で `semantic tokens` コレクションを取得
2. 値を `src/tokens/*.css` の `@theme` と `src/tokens.css` の `:root` へ反映
3. 各コンポーネントの Figma 仕様（`get_design_context`）と CSS を突き合わせて調整
4. `npm run dev` で該当コンポーネントのプレビューページ（`examples/<name>.html`）を視覚確認 → 必要なら Figma スクリーンショットと並べて差分検証

最新の Figma 同期日: 2026-05-25。

---

## コントリビューション

### ブランチ運用

`main` は **保護ブランチ**で、直接 push できません。変更はすべて PR 経由でマージしてください。

| ルール | 設定 |
|---|---|
| Pull Request 必須 | ✅ 直接 push 不可（レビューは 0 人で OK、セルフマージ可） |
| Force push | ✅ 禁止 |
| ブランチ削除 | ✅ 禁止（`main` のみ） |
| Admin にも適用 | ✅ オーナー権限でも PR 経由 |

### 開発フロー

```bash
# 1. main から作業ブランチを切る
git checkout main && git pull --ff-only
git checkout -b <verb>-<scope>           # 例: add-tab-component, fix-slack-notify-jq

# 2. 編集 → コミット → push（ここで一旦止める）
git add .
git commit -m "feat(<scope>): ..."        # Conventional Commits 必須
git push -u origin <verb>-<scope>

# 3. ローカル / Deploy Preview で動作確認
#    確認 OK になってから次へ

# 4. PR 作成
gh pr create --fill                       # またはブラウザで PR 作成

# 5. セルフマージ（squash で main は 1 PR = 1 commit に保つ）
gh pr merge <N> --squash --delete-branch
git checkout main && git pull --ff-only
```

> **AI ツール (Claude Code 等) で作業する場合**: 「実装 → branch push → user OK → PR 作成 → user OK → merge」の **2 段階で人間判断を挟む** 運用です（push と PR を分けない・PR を即作らない）。詳細は [CLAUDE.md → Claude Code が守るべき行動規範](CLAUDE.md#claude-code-が守るべき行動規範) 参照。

### コミットメッセージ規約

[Conventional Commits](https://www.conventionalcommits.org/) に従ってください。

| プレフィックス | 用途 |
|---|---|
| `feat:`     | 新機能・新コンポーネント |
| `fix:`      | バグ修正 |
| `refactor:` | 動作を変えずに構造を整える |
| `style:`    | 見た目・コード整形のみ |
| `docs:`     | ドキュメント変更のみ |
| `chore:`    | ビルド設定 / 依存更新など |
| `ci:`       | GitHub Actions / リリース系 |

### コーディング規約

CSS / HTML を書く時は **必ずデザインシステムが用意した変数を使う**（pixel / hex / 生数値の直書きは禁止）。詳細は [CLAUDE.md](CLAUDE.md#-必須ルール-ハードコーディング禁止) を参照。

要点:

- **余白**: `p-2` / `gap-4` 等の utility、または `calc(var(--spacing) * N)`（祝福スケール: 0/1/2/3/4/6/8/12/16）
- **色**: `text-fg-high` / `bg-primary-500` 等の semantic ロール、または `var(--color-*)`
- **タイポ**: `.typo-{xsmall,small,medium,large,xlarge,2xlarge,3xlarge}` クラス
- **角丸 / シャドウ**: `rounded-sm` / `shadow-md` 等の utility、または `var(--radius-*)` / `var(--shadow-*)`

### 関連ドキュメント

- 📖 [CLAUDE.md](CLAUDE.md) — リポジトリ全体の運用ガイド（Claude Code 用 + 人間向け詳細）
- 🚀 [docs/RELEASING.md](docs/RELEASING.md) — npm publish + Slack 通知のリリース手順
- 👋 [docs/INTRODUCTION.md](docs/INTRODUCTION.md) — チーム向けオンボーディング

---

## バージョン

`v0.1.0` — 初期リリース（ライトモードのみ、トークンは Figma 同期済み）。ダークモードは将来のバージョンで対応予定。

---

## MCP サーバー（AI コーディングツール連携）

AI（Claude Code / Cursor / Windsurf 等）で UI を書くときに、このデザインシステムの
**コンポーネント仕様・トークン・必須ルール**を AI に直接読ませるための MCP サーバーを提供しています。
これにより、ハードコード値や規約違反（`text-sm` 直書き等）を避けた relay 準拠の UI を生成しやすくなります。

提供形態は 2 つあります:

- **ローカル版（stdio）** — npm パッケージ `@light-right/design-system` に `relay-ds-mcp` として同梱。`npx` で起動（Node が必要）
- **リモート版** — Cloudflare 上で稼働。URL を登録するだけで使え、npm / Node 不要（→ 後述の「リモート版」）

### セットアップ（ローカル版 / stdio）

このパッケージに `relay-ds-mcp` という stdio MCP サーバーが入っています。利用ツールの設定に登録してください。

**Claude Code**（プロジェクトの `.mcp.json` または `claude mcp add`）:

```json
{
  "mcpServers": {
    "relay-ds": {
      "command": "npx",
      "args": ["-y", "--package=@light-right/design-system", "relay-ds-mcp"]
    }
  }
}
```

> 既にプロジェクトに `npm install @light-right/design-system` 済みなら、`command: "relay-ds-mcp"`（引数なし）でローカル版を直接起動できます。Cursor / Windsurf も同じ stdio コマンドを各ツールの MCP 設定に登録すれば使えます。

### 使えるツール

| ツール | 内容 |
|---|---|
| `list_components` | 全コンポーネント一覧（英名 / 和名 / 概要 / 主要クラス） |
| `get_component(name)` | 指定コンポーネントの完全仕様（props・状態・色・usage・クラス・コピペ HTML・Figma リンク） |
| `get_tokens(category?)` | デザイントークン（colors / typography / spacing / radius / shadow） |
| `get_design_principles` | 必須ルール（ハードコード禁止・semantic color 等）+ 禁止パターン Top 10 |
| `list_assets` | ブランドアセット（ロゴ / イラスト）一覧 + 直リンク URL（`<img src>` にそのまま使える） |
| `search(query)` | コンポーネント / トークン / 規約 / アセットの横断検索 |

公開データは `DESIGN.md` / `src/components/*.css` / `src/tokens/*.css` / `snippets/*.html` / `examples/pages/assets.html` から
ビルド時に自動生成されるため、デザインシステム本体を更新すれば MCP の応答も追従します。

### リモート版（任意・Cloudflare Workers）

`npx` / Node を使わず **URL で繋ぐ**リモート MCP も稼働しています（[src/mcp/worker.mjs](src/mcp/worker.mjs)）。
claude.ai（Web）のカスタムコネクタや、URL 登録に対応した各ツールで使えます。中身は公開情報のため **authless**（認証なし）・stateless で、Cloudflare Workers の無料枠で動きます。

**エンドポイント**: `https://relay-design-system-mcp.s-taguchi.workers.dev/mcp`

- **claude.ai**: Settings → Connectors → Add custom connector → 上記 URL を貼る（認証不要）
- 各ツールに URL を登録するだけ。**npm / Node は不要**。stdio 版とまったく同じツール／リソースを返します（ロジックは [src/mcp/handlers.mjs](src/mcp/handlers.mjs) で共通化）

メンテナ向け（デプロイ）:

```bash
npm run dev:mcp-remote   # ローカル確認（http://localhost:8787/mcp）
npm run deploy:mcp       # デプロイ（要 Cloudflare アカウント / wrangler login）
```

参考: [社内デザインシステムをMCPサーバー化したらUI実装が爆速になった (Ubie Dev)](https://zenn.dev/ubie_dev/articles/f927aaff02d618)
