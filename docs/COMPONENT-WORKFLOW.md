# 定型ワークフロー: Figma → 新規コンポーネント追加

> 過去事例: Filter Chip / Tab / Typography / Spacing 等。
> チェックポイント運用（push で止まる / PR・merge はユーザー承認後）は [CONTRIBUTING.md](CONTRIBUTING.md) 参照。

## Phase 0. Figma 仕様取得

```text
mcp__claude_ai_Figma__get_design_context
  fileKey: hJcKE8FkiyXtB1F9SuuE08
  nodeId:  <ユーザーが共有した URL の node-id>
```

確認すべき情報:

- props（variant / size / state / isSelected 等）
- 各状態の色 / 余白 / 線・影
- トークン参照名（`stroke/middle` / `primary/500` 等）→ 既存トークン名にマッピング

## Phase 1. ブランチ作成

main 保護されているので必ず feature branch から PR。

```bash
git checkout main && git pull --ff-only
git checkout -b add-<component-name>
```

## Phase 2. コンポーネント CSS 作成

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
 * 機能:
 *   <何のためのコンポーネントか＝役割を 1〜3 行。似て非なるものがあれば
 *    「いつコレで、いつ別のものか」を 1 行で（例: 遷移=link / 実行=button）。>
 *
 * 使用法:
 *   OK: <推奨される使い方を 1 行>
 *   NG: <アンチパターン> → <代わりにどうするか / 理由>
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

**注意**:

- **state は ARIA 属性を優先** (`[aria-pressed="true"]`, `[aria-selected="true"]`, `:disabled`)。クラス名（`.is-selected`）は最終手段
- **ヘッダコメントは MCP `get_component` の正本**。`機能:` / `使用法:`（`OK:` / `NG:` 行）ブロックの書式を必ず踏襲する（ヘッダが無いと doc が空になる）。ブロックの**どの行にも `*/` を書かない**（CSS ブロックコメントが閉じてしまう）。詳細は [DECISIONS.md](DECISIONS.md) 参照

## Phase 3. index.css に登録

```css
/* src/index.css — 適切な位置に @import を追加 */
@import "./components/<name>.css";
```

`@import` は tokens → components の順序を守る（Tailwind v4 の cascade に影響）。

## Phase 4. カタログにセクション追加

`examples/index.html` の適切な位置に `<section id="<name>">` を挿入。

セクション構造（必須・他コンポーネントと統一）:

```html
<section id="<name>">
  <div class="flex items-baseline justify-between mb-2">
    <h2 class="typo-2xlarge"><Japanese name></h2>
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

## Phase 5. 必要なら振る舞い JS を追加

`</body>` 直前の `<script>` ブロック群に追加。**document.addEventListener('click', ...)** の event delegation パターン推奨（filter-chip / tab 等を参考）。
データ属性で対象を識別（`[data-tabgroup]` 等）。

## Phase 6. ドキュメント更新

- [README.md](../README.md): 「コンポーネント一覧（N 個）」の表に行を追加し、N をインクリメント
- [docs/INTRODUCTION.md](INTRODUCTION.md): 冒頭の "N 種類のコンポーネント" と「入っているもの」リストを更新

## Phase 7. コミット & push（ここで一度ユーザーに確認）

```bash
# dev server (起動済みでなければ)
npm run dev   # http://localhost:5173/examples/index.html

# コミット + push（PR はまだ作らない）
git add -A
git commit -m "feat(<name>): ..."   # Conventional Commits
git push -u origin add-<component-name>
```

push が終わったらユーザーに「ローカル確認お願いします」と伝えて **止まる**。`gh pr create` はまだ叩かない。

## Phase 8. PR 作成（ユーザー OK 後）

ユーザーから「OK / PR 出して / マージして」など明示的な承認が来てから:

```bash
gh pr create --base main --head add-<component-name> --title "feat(<name>): …" --body "..."
```

## Phase 9. マージ（ユーザー承認後）

「マージして」と来てから:

```bash
gh pr merge <N> --squash --delete-branch
git checkout main && git pull --ff-only
```

merge 後、`.github/workflows/deploy-pages.yml` が自動で GitHub Pages にデプロイ（1〜2 分）。

---

## raw CSS で書く時の早見表

> 色 / 余白 / タイポ / 角丸 / 影をトークン経由でしか書かない規律、禁止パターン Top 10、ハードコード許容例外は [DESIGN.md](../DESIGN.md) を参照。

`@apply` が使えない場所（`examples/index.html` 内の `<style>` ブロック等）では Tailwind の theme 変数を直接参照:

| 欲しいもの | 書き方 |
|---|---|
| `gap-4` 相当 (16px) | `gap: calc(var(--spacing) * 4);` |
| `p-2 px-4` 相当 | `padding: calc(var(--spacing) * 2) calc(var(--spacing) * 4);` |
| `text-base leading-6` 相当 | `font-size: var(--text-base); line-height: var(--text-base--line-height);` |
| `font-bold` 相当 | `font-weight: var(--font-weight-bold);` |
| `bg-fg-high` 相当 | `background: var(--color-fg-high);` |
| `rounded-md` 相当 | `border-radius: var(--radius-md);` |

---

## トークンの Figma 同期（Figma → コード 片方向）

1. `mcp__claude_ai_Figma__get_variable_defs` または Plugin API 経由で `semantic tokens` コレクションを取得
2. 値を `src/tokens/*.css` の `@theme` と `src/tokens.css` の `:root` へ反映
3. 各コンポーネントの Figma 仕様（`get_design_context`）と CSS を突き合わせて調整
4. `npm run dev` で該当コンポーネントのプレビューページ（`examples/<name>.html`）を視覚確認 → 必要なら Figma スクリーンショットと並べて差分検証
