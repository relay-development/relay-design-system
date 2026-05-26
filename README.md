# Relay Design System

Relay プロダクトのための、Tailwind CSS v4 ベースのフレームワーク非依存デザインシステムです。
**デザイントークン + 14 コンポーネント** を HTML スニペット集として提供します。
トークンは Figma ファイル `hJcKE8FkiyXtB1F9SuuE08` の `semantic tokens` コレクションと同期されています。

- 📦 npm: `@relay/design-system`
- 🌐 プレビューサイト: https://<netlify-subdomain>.netlify.app
- 🎨 Figma: `hJcKE8FkiyXtB1F9SuuE08`

---

## チームメンバー向け：プロダクトで使う

### 1. インストール

```bash
npm install @relay/design-system
```

### 2. CSS を 1 行 import

```ts
// 任意のエントリ（例: main.ts / _app.tsx / app.css）
import "@relay/design-system/css";
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

- 全コンポーネントの状態網羅プレビュー: https://<netlify-subdomain>.netlify.app
- コピペ用 HTML: `node_modules/@relay/design-system/snippets/*.html`

### 5. トークンだけ使いたい（自前 Tailwind 環境がある場合）

```css
@import "tailwindcss";
@import "@relay/design-system/tokens";

/* 以降、bg-primary-500 / text-fg-high / shadow-md などが利用可能 */
```

### 6. Issue / 要望

https://github.com/<org>/relay-design-system/issues

---

## 構成

```
src/
  index.css        ← エントリ（@import "tailwindcss" + tokens + components）
  tokens.css       ← トークンのみのエントリ（プリビルド配布用、plain CSS 変数）
  tokens/          ← @theme によるトークン定義（color/typography/spacing/radius/shadow）
  components/      ← .btn / .input / .card など、@layer components のクラス定義
snippets/          ← 各コンポーネントの貼り付け可能な HTML
examples/index.html← 全コンポーネントを一覧できるプレビューページ
dist/              ← ビルド成果物（relay.css / tokens.css）
```

---

## セットアップ

```bash
npm install
npm run dev      # http://localhost:5173/examples/index.html
npm run build    # dist/relay.css と dist/tokens.css を生成
```

## 利用側からの使い方

### A. プリビルド CSS をそのまま使う（最もシンプル）

```html
<link rel="stylesheet" href="node_modules/@relay/design-system/dist/relay.css" />

<button class="btn btn-md btn-primary">保存</button>
```

または bundler 経由:

```js
import "@relay/design-system/css";
```

### B. 利用側で Tailwind v4 を使い、トークンだけ取り込む

```css
/* app.css */
@import "tailwindcss";
@import "@relay/design-system/tokens";

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

## コンポーネント一覧（14 個）

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
| 11 | Card          | `.card`, `.card-elevated`, `.card-{header,title,subtitle,body,footer}` |
| 12 | Badge         | `.badge` + `.badge-{solid,soft}-{neutral,primary,info,success,warning,negative}` |
| 13 | Alert         | `.alert`, `.alert-{neutral,success,negative,warning,info}`, `.alert-{icon,body,title,close}` |
| 14 | （ガイドライン） | デザイン原則・利用上の注意事項（プレビューサイト内）|

各コンポーネントの完成形 HTML は `snippets/*.html` を参照してください。

---

## Figma → コード ワークフロー

このリポジトリは Figma → コードの片方向同期で運用します。

1. `mcp__claude_ai_Figma__get_variable_defs` または Plugin API 経由で `semantic tokens` コレクションを取得
2. 値を `src/tokens/*.css` の `@theme` と `src/tokens.css` の `:root` へ反映
3. 各コンポーネントの Figma 仕様（`get_design_context`）と CSS を突き合わせて調整
4. `examples/index.html` で視覚確認 → 必要なら Figma スクリーンショットと並べて差分検証

最新の Figma 同期日: 2026-05-25。

---

## バージョン

`v0.1.0` — 初期リリース（ライトモードのみ、トークンは Figma 同期済み）。ダークモードは将来のバージョンで対応予定。
