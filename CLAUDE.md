# relay Design System — Claude Code 用ガイド

このファイルは Claude Code が本リポジトリで作業する際に毎回読み込む運用ガイドです。
リポジトリの慣習、定型ワークフロー、過去の設計判断をここに集約します。

---

## プロジェクト概要

- **何**: Tailwind CSS v4 ベース、フレームワーク非依存のデザインシステム
- **誰が使う**: relay 系プロダクトのチーム（npm `@light-right/design-system`）
- **配布**: npm package + 公開 GitHub Pages カタログ
- **同期元**: Figma file `hJcKE8FkiyXtB1F9SuuE08`（片方向: Figma → コード）
- **Quick reference (1 枚憲法)**: [DESIGN.md](DESIGN.md) — トークン値・主要コンポーネント API・禁止パターンが 1 ファイルに集約されている。UI を生成する単発タスクならまず DESIGN.md を見て、複雑な作業や運用判断が必要な時に本ファイル (CLAUDE.md) を参照する

---

## リポジトリ構造

```
DESIGN.md                ← AI が UI を生成する時に最初に読む 1 枚憲法（トークン・主要 API・禁止パターン）
CLAUDE.md                ← 本ファイル。運用ガイド + ワークフロー詳細
README.md                ← 全コンポーネントクラス一覧 + トークン参照表
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
  mcp/
    handlers.mjs         ← MCP の tools/resources ロジック（トランスポート非依存・両エントリで共有）
    server.mjs           ← stdio エントリ。handlers を stdio に接続し esbuild で dist/mcp.mjs に単一バンドル（bin）
    worker.mjs           ← Cloudflare Workers エントリ。handlers を Streamable HTTP (POST /mcp) で公開（authless・リモート）
examples/
  index.html             ← カタログ（プレビューサイト）。左サイドナビ + 全コンポーネントの状態網羅
  icons.svg              ← scripts/build-icons.mjs が生成（gitignored）
scripts/
  build-icons.mjs        ← Lucide subset → dist/icons.svg + examples/icons.svg
  build-mcp.mjs          ← DESIGN.md / components / tokens / snippets を解析 → dist/mcp-index.json を生成（MCP の素材）
snippets/                ← 利用者向けコピペ HTML（軽め、メインはカタログ）
docs/
  INTRODUCTION.md        ← チームへの案内（4 つの入り口）
  ACCESSIBILITY.md       ← WCAG 2.1 AAA 実務チェックリスト
  WORKSHOP.md            ← Git / PR ワークフロー（非エンジニア向け勉強会資料）
  RELEASING.md           ← リリース手順 + Slack 自動通知の仕組み
.github/workflows/
  deploy-pages.yml          ← push to main → GitHub Pages にカタログをデプロイ
  notify-slack-on-release.yml ← Release published → #dev_information に自動通知
dist/                    ← ビルド成果物 (gitignored)
```

---

## ハードコード禁止 — 背景と運用

> ルール本文 (色 / 余白 / タイポ / 角丸 / 影をトークン経由でしか書かない) と禁止パターン Top 10 は [DESIGN.md](DESIGN.md) を参照。本セクションは **なぜ** その規律が必要か、**例外**、**検証コマンド**、`@apply` が使えない場面の対処を補足する。

### なぜ

- トークン化されていない値は **デザインシステム改訂時に取り残される**（Figma 側で色を変えた時、ハードコード箇所だけ更新されない）
- 「ここだけ 14.5px」のような **off-scale な値** がしれっと混入し、4px ベースグリッドが崩れる
- 後から読む人が「なぜこの値？」を辿れない

### 例外（ハードコードを許容するケース）

| 状況 | 例 | 理由 |
|---|---|---|
| Figma 由来の **bespoke カラー** がパレットに無い | hero gradient `#d9ebea` / `#e7f6f6` | 1 箇所限定の装飾色。トークン化するほどではない。コメントで由来を明記 |
| Figma 仕様で **off-scale な余白** が出る | (例) コンポーネント内 7px パディング | 該当パーツで本当に必要なら raw 値 OK。ただしコメントで「Figma 仕様」と明記 |
| **比率・100% / auto** | `width: 50%` `height: auto` `inset: 0` | スケール非依存値はそのまま |

### コードレビュー時のセルフチェック

PR 出す前に以下を grep して 0 件か確認:

```bash
# CSS / HTML 中の pixel リテラル（タイポを除く）
grep -nE ':\s*[0-9]+px' examples/index.html src/components/*.css \
  | grep -v 'font-size\|line-height\|gap-\|@apply'
```

`Figma 仕様` コメントの無い pixel 値があったらトークン化する。

### raw CSS で書く時の早見表

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

### Phase 7. コミット & push（ここで一度ユーザーに確認）

```bash
# dev server (起動済みでなければ)
npm run dev   # http://localhost:5173/examples/index.html

# コミット + push（PR はまだ作らない）
git add -A
git commit -m "feat(<name>): ..."   # Conventional Commits
git push -u origin add-<component-name>
```

push が終わったらユーザーに「ローカル確認お願いします」と伝えて **止まる**。`gh pr create` はまだ叩かない。

### Phase 8. PR 作成（ユーザー OK 後）

ユーザーから「OK / PR 出して / マージして」など明示的な承認が来てから:

```bash
gh pr create --base main --head add-<component-name> --title "feat(<name>): …" --body "..."
```

### Phase 9. マージ（ユーザー承認後）

「マージして」と来てから:

```bash
gh pr merge <N> --squash --delete-branch
git checkout main && git pull --ff-only
```

merge 後、`.github/workflows/deploy-pages.yml` が自動で GitHub Pages にデプロイ（1〜2 分）。

---

## 🚀 リリースワークフロー（npm + Slack）

> SemVer 運用 (patch / minor / major の判断基準) は [DESIGN.md](DESIGN.md#versioning) 参照。詳細手順は [docs/RELEASING.md](docs/RELEASING.md)。

実行コマンド:

```bash
npm version patch | minor | major   # version bump + git tag 作成
git push --follow-tags
npm publish                         # bypass-2FA granular token 必要
gh release create vX.Y.Z --generate-notes --latest
# → .github/workflows/notify-slack-on-release.yml が #dev_information に自動投稿
```

main 保護下では `git push` が弾かれるため、**release ブランチを切って PR 経由でマージしてから tag を push** する手順を使う（過去事例: v0.3.0）。

---

## 🔒 Git / PR 運用ルール

`main` は **保護ブランチ**。直接 push できません。すべての変更は PR 経由で。
人間チームメンバー向けの説明は [README.md の「コントリビューション」セクション](README.md#コントリビューション) にあります。

### 保護設定（GitHub Settings → Branches）

| ルール | 状態 |
|---|---|
| Require a pull request before merging | ✅ ON（レビュー 0 人で OK） |
| Block force pushes | ✅ ON |
| Block deletions | ✅ ON |
| Enforce for admins (オーナーにも適用) | ✅ ON |

### Claude Code が守るべき行動規範

- **main へ直接 push しない** — 保護で弾かれるが意図しないこと
- 🛑 **実装 → branch push まで で一度止まる** — `git push` まで実行したらユーザーに「ローカル確認お願いします」と伝え、**`gh pr create` は叩かない**。AI が PR をどんどん量産すると、ユーザーがローカルで確認する暇なく PR が積み上がる
- **PR 作成はユーザー OK 後** — 「OK」「PR 出して」「マージして」など明示的な承認が来てから `gh pr create` を叩く
- **マージは必ずユーザー承認後** — 「マージして」と明示されてから `gh pr merge` を叩く（Auto Mode classifier の挙動と一致）
- **PR を作る時は self-contained** に — 単一の concern を扱う。複数の変更を 1 PR に混ぜない（過去事例: Tab と CLAUDE.md は別 PR に分けた）
- **squash merge を使う**（`gh pr merge <N> --squash --delete-branch`）— main は 1 PR = 1 commit を保つ

### 実装〜マージのチェックポイント

```
[実装] → [git commit] → [git push] → 🛑 ここでユーザー確認待ち
                                       ↓ ユーザー「OK」
                                     [gh pr create] → 🛑 ここでもユーザー確認待ち
                                                        ↓ ユーザー「マージして」
                                                      [gh pr merge --squash]
```

ユーザーから明示的な合図 (「PR 出して」「マージして」等) がなければ、その先のステップに進まない。push までは autonomous に進めて OK、PR / merge は必ず人間判断を挟む。

### ブランチ命名

`<verb>-<scope>` 形式:

| 例 | パターン |
|---|---|
| `add-tab-component` | add-<name> |
| `fix-slack-notify-jq` | fix-<bug> |
| `refactor-catalog-radius-section` | refactor-<area> |
| `release-v0.2.0` | release-<version> |
| `move-guidelines-below-alert` | move-<what>-<destination> |

### コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) 必須:

| プレフィックス | 用途 | 例 |
|---|---|---|
| `feat:`     | 新機能・新コンポーネント | `feat(tab): add Tab component` |
| `fix:`      | バグ修正 | `fix(ci): use string interpolation in jq` |
| `refactor:` | 動作を変えずに構造を整える | `refactor(typography): rename .typo-xs → .typo-xsmall` |
| `style:`    | 見た目・コード整形のみ | `style(hero): widen title gap` |
| `docs:`     | ドキュメント変更のみ | `docs: add CLAUDE.md` |
| `chore:`    | ビルド設定 / 依存更新 / version bump | `chore(release): 0.2.0` |
| `ci:`       | GitHub Actions / リリース系 | `ci: migrate preview hosting to GH Pages` |

ボディには **なぜ** その変更が必要だったかを書く（what は diff で見える）。Co-Authored-By: で AI 生成を明示。

---

## 過去の設計判断（読み返す価値あり）

> ルールとして DESIGN.md の Non-Negotiable Principles に昇格した項目 (typo セマンティック層 / ARIA 状態 / Blessed Scale 等) は本セクションから除外。ここに残るのは **歴史的経緯** や **DS 内部の実装判断**。

- **Lucide アイコンは SVG sprite として同梱**（`scripts/build-icons.mjs` → `dist/icons.svg`）。JS 依存ゼロで vanilla HTML から `<use href="...#lucide-x">` で使える
- **Spacing は Tailwind single-base** (`--spacing: 0.25rem`) で全 `p-*` / `m-*` を自動派生。`--spacing-0..16` 等の名前付きトークンは追加しない（Tailwind v4 の流儀に合わせる）
- **カタログ用 hover/focus プレビュー**: `.is-hover-preview` / `.is-focus-preview` modifier を CSS 側で `:hover` / `:focus-visible` と OR 条件にする
- **プレビューサイトのホスティング**: Netlify → GitHub Pages に移行済み（クレジット上限超過のため）。GitHub Pages は public repo + Free プランで容量無制限
- **MCP サーバーは既存パッケージに同梱**（`bin: relay-ds-mcp` → `dist/mcp.mjs`）。`@modelcontextprotocol/sdk` は **esbuild でバンドル**して単一ファイル化し devDependency に留める（CSS だけ使う利用者に runtime 依存を増やさない）。コンテンツは二重管理せず `scripts/build-mcp.mjs` が正本ファイルから `dist/mcp-index.json` を生成 → server にインライン。**`get_component` の品質は `src/components/*.css` 先頭のヘッダコメント形式（`recreated from Figma component set NNNN:NNNN (和名)` + props + Usage）に依存する**ので、新規コンポーネントでもこの雛形を必ず踏襲する（ヘッダが無いと doc が空になる）

---

## やってはいけないこと（DESIGN.md 補完）

> ハードコーディング / 祝福外 spacing / primitive 直参照 / `text-sm` 直書き / main 直 push 等の禁止事項は [DESIGN.md](DESIGN.md) の Non-Negotiable Principles と禁止パターン Top 10 にまとまっている。以下は DESIGN.md に書かれていない、運用面で気をつけたい点。

- ❌ **`src/index.css` の `@import` 順序を雑に変える** → Tailwind v4 の cascade に影響する（tokens → components の順序を守る）
- ❌ **Figma を見ずに「だいたいこんな感じ」で実装** → 必ず `mcp__claude_ai_Figma__get_design_context` で仕様取得
- ❌ **npm token を会話やコミットに含める** → `.npmrc` ローカル管理。露出したら即 revoke
- ❌ **新しい spacing トークン (`--spacing-40` 等) を追加する** → Tailwind v4 の single-base 流儀に反する
