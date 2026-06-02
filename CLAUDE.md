# Relay Design System — Claude Code 用ガイド

このファイルは Claude Code が本リポジトリで作業する際に毎回読み込む運用ガイドです。
リポジトリの慣習、定型ワークフロー、過去の設計判断をここに集約します。

---

## プロジェクト概要

- **何**: Tailwind CSS v4 ベース、フレームワーク非依存のデザインシステム
- **誰が使う**: relay 系プロダクトのチーム（npm `@light-right/design-system`）
- **配布**: npm package + 公開 GitHub Pages カタログ
- **同期元**: Figma file `hJcKE8FkiyXtB1F9SuuE08`（片方向: Figma → コード）

---

## リポジトリ構造

```
src/
  index.css              ← Tailwind v4 エントリ。tokens + components の @import を集約
  tokens/                ← @theme による primitive / role トークン
    colors.css           ← primitive + semantic（fg / stroke / overlay 等）
    typography.css       ← --text-* / --font-weight-* / --tracking-*
    spacing.css          ← --spacing: 0.25rem (Tailwind single-base; 9 段階を公式に祝福)
    radius.css           ← --radius-{none,xs,sm,md,lg,full}
    shadow.css           ← --shadow-{sm,md,lg,focus-ring,destructive}
  components/            ← @layer components で書く CSS 定義（1 component = 1 file）
    typography.css       ← .typo-{xsmall,small,medium,large,xlarge,2xlarge,3xlarge}
    icon.css             ← .icon + .icon-{xs,sm,md,lg,xl}
    button.css / icon-button.css / input.css / ... 各コンポーネント
examples/
  index.html             ← カタログ（プレビューサイト）。左サイドナビ + 全コンポーネントの状態網羅
  icons.svg              ← scripts/build-icons.mjs が生成（gitignored）
scripts/
  build-icons.mjs        ← Lucide subset → dist/icons.svg + examples/icons.svg
snippets/                ← 利用者向けコピペ HTML（軽め、メインはカタログ）
docs/
  INTRODUCTION.md        ← チームへの案内（4 つの入り口）
  RELEASING.md           ← リリース手順 + Slack 自動通知の仕組み
.github/workflows/
  deploy-pages.yml          ← push to main → GitHub Pages にカタログをデプロイ
  notify-slack-on-release.yml ← Release published → #dev_information に自動通知
dist/                    ← ビルド成果物 (gitignored)
```

---

## デザイントークンの使い方

トークンは `@theme` で宣言されており、Tailwind v4 が自動でユーティリティクラスを生成します。
**カスタム CSS を書く時は、可能な限り Tailwind ユーティリティを `@apply` または `var(--*)` で参照**してください。

| 概念 | 推奨参照 |
|---|---|
| 色 | `bg-primary-500` / `text-fg-high` / `border-stroke-middle` (utility) または `var(--color-primary-500)` |
| 余白 | `p-2` / `m-4` / `gap-6` etc. (4px 単位、9 段階を祝福: 0/1/2/3/4/6/8/12/16) |
| 角丸 | `rounded-sm` / `var(--radius-md)` 等 |
| 影 | `shadow-md` / `var(--shadow-focus-ring)` 等 |
| タイポ | **必ず `.typo-{xsmall,small,medium,large,xlarge,2xlarge,3xlarge}` を使う**（直接 `text-sm` 等は避け、セマンティック層を通す） |

`<style>` ブロックに生 CSS を書く時（`@apply` が効かない場所）は `var(--text-sm)` + `var(--text-sm--line-height)` のように **typography トークン CSS 変数を参照** する。

---

## 🎯 定型ワークフロー: Figma → 新規コンポーネント追加

> 過去事例: Filter Chip / Tab / Typography / Spacing 等

### Phase 0. Figma 仕様取得

```text
mcp__claude_ai_Figma__get_design_context
  fileKey: hJcKE8FkiyXtB1F9SuuE08
  nodeId:  <ユーザーが共有した URL の node-id>
```

確認すべき情報:
- props（variant / size / state / isSelected 等）
- 各状態の色 / 余白 / 線・影
- トークン参照名（`stroke/middle` / `primary/500` 等）→ 既存トークン名にマッピング

### Phase 1. ブランチ作成

main 保護されているので必ず feature branch から PR。

```bash
git checkout main && git pull --ff-only
git checkout -b add-<component-name>
```

### Phase 2. コンポーネント CSS 作成

`src/components/<name>.css` に新規。**他コンポーネント（最近では tab.css / filter-chip.css）を必ず参考**にしてフォーマットを揃える。

雛形:

```css
/*
 * <Name> — recreated from Figma component set <node-id> (<Japanese name>)
 *
 *   <一文の用途説明>
 *
 *   props: <props 一覧>
 *
 *   サイズ / 余白 / 色のサマリ（Figma 値）
 *
 * Usage:
 *   <最小 HTML スニペット>
 */

@layer components {
  /* ============================================================
   * Container / base
   * ============================================================ */
  .<name> {
    @apply ...;
  }

  /* ============================================================
   * Variants / states
   * ============================================================ */
  .<name>-<variant> { ... }
  .<name>[aria-selected="true"] { ... }   /* state は ARIA 属性を優先 */

  /* Hover / focus preview modifiers (カタログで全状態を可視化するため) */
  .<name>:hover:not(:disabled):not([aria-selected="true"]),
  .<name>.is-hover-preview:not([aria-selected="true"]) { ... }
  .<name>:focus-visible:not(:disabled),
  .<name>.is-focus-preview { ... }
}
```

**state は ARIA 属性を優先** (`[aria-pressed="true"]`, `[aria-selected="true"]`, `:disabled`)。クラス名（`.is-selected`）は最終手段。

### Phase 3. index.css に登録

```css
/* src/index.css — 適切な位置に @import を追加 */
@import "./components/<name>.css";
```

### Phase 4. カタログにセクション追加

`examples/index.html` の適切な位置に `<section id="<name>">` を挿入。

セクション構造（必須・他コンポーネントと統一）:

```html
<section id="<name>">
  <div class="flex items-baseline justify-between mb-2">
    <h2 class="typo-2xlarge font-semibold"><Japanese name></h2>
    <span class="badge badge-soft-primary">component</span>
  </div>
  <p class="typo-small text-fg-low mb-6">プロパティ: <code class="px-1 bg-neutral-100 rounded">prop1</code> × <code class="px-1 bg-neutral-100 rounded">prop2</code></p>
  <p class="typo-small text-fg-middle mb-6">用途の説明文</p>

  <!-- ===== state × variant マトリクス（カード形式・3 列 grid が定番）===== -->
  <div class="card mb-6 overflow-hidden">
    <div class="card-header">
      <h3 class="card-title">variant × state</h3>
      <p class="card-subtitle">説明</p>
    </div>
    <div class="card-body grid grid-cols-[100px_1fr_1fr] gap-4 items-center">
      <!-- header row + state rows -->
    </div>
  </div>

  <!-- ===== 使用例 ===== -->
  <div class="card mb-8">
    <div class="card-header">
      <h3 class="card-title">使用例</h3>
      <p class="card-subtitle">…</p>
    </div>
    <div class="card-body">…</div>
  </div>
</section>
```

サイドナビ (`.docs-sidebar-nav` 内の適切なグループ) に `<a href="#<name>"><Name></a>` を追加。

### Phase 5. 必要なら振る舞い JS を追加

`</body>` 直前の `<script>` ブロック群に追加。**document.addEventListener('click', ...)** の event delegation パターン推奨（filter-chip / tab 等を参考）。
データ属性で対象を識別（`[data-tabgroup]` 等）。

### Phase 6. ドキュメント更新

- [README.md](README.md): 「コンポーネント一覧（N 個）」の表に行を追加し、N をインクリメント
- [docs/INTRODUCTION.md](docs/INTRODUCTION.md): 冒頭の "N 種類のコンポーネント" と「入っているもの」リストを更新

### Phase 7. ローカル確認 → PR → マージ

```bash
# dev server (起動済みでなければ)
npm run dev   # http://localhost:5173/examples/index.html

# コミット & PR
git add -A
git commit -m "feat(<name>): ..."   # Conventional Commits
git push -u origin add-<component-name>
gh pr create --base main --head add-<component-name> --title "feat(<name>): …" --body "..."

# main 保護のため必ず PR 経由。ユーザーが OK したら:
gh pr merge <N> --squash --delete-branch
git checkout main && git pull --ff-only
```

merge 後、`.github/workflows/deploy-pages.yml` が自動で GitHub Pages にデプロイ（1〜2 分）。

---

## 🚀 リリースワークフロー（npm + Slack）

詳細は [docs/RELEASING.md](docs/RELEASING.md)。サマリ:

```bash
npm version patch | minor | major   # version bump + git tag 作成
git push --follow-tags
npm publish                         # bypass-2FA granular token 必要
gh release create vX.Y.Z --generate-notes --latest
# → .github/workflows/notify-slack-on-release.yml が #dev_information に自動投稿
```

SemVer 運用:
- **patch**: バグ修正 / スタイル微調整
- **minor**: 後方互換のあるコンポーネント / トークン追加
- **major**: クラス名変更等の破壊的変更

---

## 🔒 Git / PR 運用ルール

- **main は保護**: 直接 push 不可、PR + セルフマージで運用
- **squash merge** で main に 1 PR = 1 commit を保つ
- **マージは必ずユーザー承認後**: 「マージして」と明示されてから `gh pr merge` を叩く（Auto Mode classifier に弾かれる動作と一致）
- ブランチ名: `<verb>-<scope>` (例: `add-tab-component`, `fix-slack-notify-jq`)
- コミットメッセージ: Conventional Commits (`feat:` / `fix:` / `refactor:` / `docs:` / `chore:` / `style:` / `ci:`)

---

## 過去の設計判断（読み返す価値あり）

- **Lucide アイコンは SVG sprite として同梱**（`scripts/build-icons.mjs` → `dist/icons.svg`）。JS 依存ゼロで vanilla HTML から `<use href="...#lucide-x">` で使える
- **Typography は `.typo-*` セマンティック層で統一**。生 `text-sm` の使用は段階的に駆逐済み
- **Spacing は Tailwind single-base** (`--spacing: 0.25rem`) で全 `p-*` / `m-*` を自動派生。`--spacing-0..16` 等の名前付きトークンは追加しない
- **コンポーネント state は ARIA 属性で表現** (`aria-pressed` / `aria-selected` / `disabled`)。CSS selector も `[aria-*]` を優先
- **カタログ用 hover/focus プレビュー**: `.is-hover-preview` / `.is-focus-preview` modifier を CSS 側で `:hover` / `:focus-visible` と OR 条件にする
- **プレビューサイトのホスティング**: Netlify → GitHub Pages に移行済み（クレジット上限超過のため）。GitHub Pages は public repo + Free プランで容量無制限

---

## やってはいけないこと

- ❌ `text-sm` / `text-base` 等を直接書く → `.typo-{small,medium,...}` を使う
- ❌ pixel 値を直接書く (`padding: 14px`) → Tailwind ユーティリティか `var(--spacing-*)`
- ❌ コンポーネント CSS で primitive color を直接参照 (`bg-slate-700`) → semantic ロール (`bg-fg-middle`) 経由
- ❌ main に直接 push（保護されているので失敗するが意図しないこと）
- ❌ `@import` の順序を雑に変える → Tailwind v4 の cascade に影響する
- ❌ Figma を見ずに「だいたいこんな感じ」で実装 → 必ず `get_design_context` で仕様取得

---

## 関連リンク

- **本番カタログ**: https://relay-development.github.io/relay-design-system/
- **npm**: https://www.npmjs.com/package/@light-right/design-system
- **GitHub**: https://github.com/relay-development/relay-design-system
- **Figma**: https://www.figma.com/design/hJcKE8FkiyXtB1F9SuuE08/relay-Design-System
