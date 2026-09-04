# relay Design System — Claude Code 用ガイド

Claude Code が本リポジトリで作業する際に毎回読み込む運用ガイド。
**要点のみをここに置き、詳細は都度リンク先を読む。**

---

## プロジェクト概要

- **何**: Tailwind CSS v4 ベース、フレームワーク非依存のデザインシステム
- **誰が使う**: relay 系プロダクトのチーム（npm `@light-right/design-system`）
- **配布**: npm package + 公開 GitHub Pages カタログ + MCP リモート (Cloudflare Workers)
- **正本**: このリポジトリのコード（トークン・コンポーネント仕様・API すべて）。Figma は**デザイン探求の場** — 固まったデザインをコードに取り込んだ時点で正式版になる
- **Quick reference (1 枚憲法)**: [DESIGN.md](DESIGN.md) — トークン値・主要コンポーネント API・禁止パターン。UI を生成する単発タスクならまず DESIGN.md を見る

## リポジトリ構造

```
DESIGN.md              ← 1 枚憲法（トークン・主要 API・禁止パターン・ハードコード例外）
README.md              ← 利用者向け入口 + 全コンポーネントクラス一覧
src/
  index.css            ← Tailwind v4 エントリ（@import 順序: tokens → components を崩さない）
  tokens/              ← @theme による primitive / role トークン
  tokens.css           ← :root 変数ミラー（Tailwind 非使用の利用者向け。tokens/ と値を揃える）
  components/          ← @layer components の CSS（1 component = 1 file、先頭ヘッダコメントが MCP の正本）
  mcp/                 ← MCP サーバー（handlers.mjs を stdio / Cloudflare Workers で共有）
examples/pages/        ← カタログ各ページの本文断片（examples/*.html は build:pages が生成・gitignored）
snippets/              ← 利用者向けコピペ HTML
scripts/               ← build-icons / build-mcp / build-pages
docs/                  ← 詳細ドキュメント（下記リンク集参照）
.claude/
  agents/              ← planner / generator / evaluator（このリポジトリのローカル開発用。旧 sprint kit — MCP 配布は 2026-08 に終了）
  workflows/           ← sprint.js（generator ⇄ evaluator の自動往復 Workflow。同上ローカル用）
  hooks/               ← relay-hardcode-gate.mjs（ハードコード検知 hook の正本。利用側へは get_setup が単体導入を案内）
```

---

## タスク別リンク集（詳細はここを読む）

| タスク | 読むファイル |
|---|---|
| UI を書く / トークン・禁止パターン確認 | [DESIGN.md](DESIGN.md) |
| 新規コンポーネント追加（Phase 0〜9。Figma 発の取り込みは Phase 0 から） | [docs/COMPONENT-WORKFLOW.md](docs/COMPONENT-WORKFLOW.md) |
| raw CSS 早見表（`@apply` が使えない場所） | [docs/COMPONENT-WORKFLOW.md](docs/COMPONENT-WORKFLOW.md#raw-css-で書く時の早見表) |
| Git / PR 運用・ブランチ命名・コミット規約 | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |
| リリース（npm publish + Slack 通知・SemVer 基準） | [docs/RELEASING.md](docs/RELEASING.md) |
| 過去の設計判断・MCP のヘッダ正本ルール | [docs/DECISIONS.md](docs/DECISIONS.md) |
| MCP ツールの仕様・セットアップ | [docs/MCP-TOOLS.md](docs/MCP-TOOLS.md) |
| アイコン（Lucide sprite）の使い方・同梱一覧 | [docs/ICONS.md](docs/ICONS.md) |
| アクセシビリティチェック | [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) |

---

## 🔒 行動規範（毎回 must）

### Git チェックポイント

```
[実装] → [git commit] → [git push] → 🛑 ユーザー確認待ち
                                       ↓「OK / PR 出して」
                                     [gh pr create] → 🛑 ユーザー確認待ち
                                                        ↓「マージして」
                                                      [gh pr merge --squash --delete-branch]
```

- **main へ直接 push しない**（保護ブランチ）。必ず feature branch（`<verb>-<scope>` 形式）から PR
- **push したら止まる** — 「ローカル確認お願いします」と伝え、`gh pr create` は叩かない
- **PR 作成・マージは明示的なユーザー承認後のみ**
- PR は self-contained（単一 concern）、squash merge、コミットは Conventional Commits

### コーディング

- **ハードコード禁止** — 色 / 余白 / タイポ / 角丸 / 影は必ずトークン経由（詳細・例外は [DESIGN.md](DESIGN.md)）
- **正本はコード** — 既存のトークン・コンポーネント仕様は Figma でなく [DESIGN.md](DESIGN.md) / `src/` を参照する。Figma 発の新規デザインを取り込む時だけ `mcp__claude_ai_Figma__get_design_context` で仕様取得し、「だいたいこんな感じ」で実装しない
- 新規コンポーネント CSS は**先頭ヘッダコメントの雛形を必ず踏襲**（MCP `get_component` の正本。書式は [docs/COMPONENT-WORKFLOW.md](docs/COMPONENT-WORKFLOW.md) Phase 2）
- `src/index.css` の `@import` 順序（tokens → components）を崩さない
- 新しい spacing トークン（`--spacing-40` 等）を追加しない（Tailwind v4 single-base 流儀）
- npm token を会話やコミットに含めない（露出したら即 revoke）
- コンポーネント追加時は README のコンポーネント数・INTRODUCTION.md も更新（[Phase 6](docs/COMPONENT-WORKFLOW.md#phase-6-ドキュメント更新)）
- 数表記・ヘッダ規約・`@import` 網羅のズレは `npm run check:consistency` で検証できる（PR 時に CI が自動実行。詳細は [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md#整合性チェックci)）
- MCP（`src/mcp/`）・DESIGN.md・コンポーネントヘッダを変更したら `npm run eval` で前後のエージェント挙動を測定する（LLM 生成が走るため実行はユーザーに確認してから。詳細は [evals/README.md](evals/README.md)）。これらのパスを変える PR では CI の `eval-gate` が regression お題を自動実行し全 PASS を要求する（文言だけなら `skip-eval` ラベル）
