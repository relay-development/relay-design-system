# コントリビューションガイド（Git / PR 運用）

`main` は **保護ブランチ**。直接 push できません。すべての変更は PR 経由で。

## 保護設定（GitHub Settings → Branches）

| ルール | 状態 |
|---|---|
| Require a pull request before merging | ✅ ON（レビュー 0 人で OK、セルフマージ可） |
| Block force pushes | ✅ ON |
| Block deletions | ✅ ON |
| Enforce for admins (オーナーにも適用) | ✅ ON |

## 開発セットアップ

```bash
npm install
npm run dev        # build:pages 後に起動 → http://localhost:5173/examples/index.html（トップ）
npm run build:pages# examples/*.html を生成（断片 examples/pages/* を編集したら再実行）
npm run build      # dist/relay.css と dist/tokens.css を生成
```

> プレビューは **マルチページ**構成。ページは `examples/pages/*.html`（本文断片）+ 共通テンプレート（`scripts/build-pages.mjs`）から生成され、生成物 `examples/*.html` は gitignore 対象。

## 開発フロー

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

## AI ツール（Claude Code 等）のチェックポイント運用

「実装 → branch push → user OK → PR 作成 → user OK → merge」の **2 段階で人間判断を挟む**。

```
[実装] → [git commit] → [git push] → 🛑 ここでユーザー確認待ち
                                       ↓ ユーザー「OK」
                                     [gh pr create] → 🛑 ここでもユーザー確認待ち
                                                        ↓ ユーザー「マージして」
                                                      [gh pr merge --squash]
```

- push までは autonomous に進めて OK。PR / merge は必ず人間判断を挟む
- AI が PR をどんどん量産すると、ユーザーがローカルで確認する暇なく PR が積み上がるのを防ぐため
- PR は **self-contained** に — 単一の concern を扱う。複数の変更を 1 PR に混ぜない（過去事例: Tab と CLAUDE.md は別 PR に分けた）

## ブランチ命名

`<verb>-<scope>` 形式:

| 例 | パターン |
|---|---|
| `add-tab-component` | add-<name> |
| `fix-slack-notify-jq` | fix-<bug> |
| `refactor-catalog-radius-section` | refactor-<area> |
| `release-v0.2.0` | release-<version> |
| `move-guidelines-below-alert` | move-<what>-<destination> |

## コミットメッセージ

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

## コーディング規約

CSS / HTML を書く時は **必ずデザインシステムが用意した変数を使う**（pixel / hex / 生数値の直書きは禁止）。
詳細は [DESIGN.md](../DESIGN.md) の Non-Negotiable Principles と禁止パターン Top 10 を参照。

## 整合性チェック（CI）

PR を出すと `check-consistency` ワークフローが自動実行され、正本（コード側）と派生ドキュメントのズレを検知する。ローカルでは `npm run check:consistency` で同じチェックを実行できる（依存インストール不要）。

| チェック | 正本 | 照合先 |
|---|---|---|
| アイコン数 | `scripts/build-icons.mjs` の `ICONS` | README / DESIGN.md / docs/ICONS.md / カタログの数表記 |
| コンポーネント数 | `scripts/build-pages.mjs` の Components グループ | README の見出し・表 / docs/INTRODUCTION.md |
| ヘッダ規約 | — | `src/components/*.css` 先頭コメントの 機能: / 使用法:（MCP の正本） |
| index.css | `src/tokens/` `src/components/` の実ファイル | `@import` の網羅と tokens → components 順序 |

CI が落ちたら、エラーメッセージの指示に従いドキュメント側の表記を更新する。意図的に文言を変えた場合は `scripts/check-consistency.mjs` のパターン定義（`ICON_CLAIMS` 等）も更新する。

## 関連ドキュメント

- [COMPONENT-WORKFLOW.md](COMPONENT-WORKFLOW.md) — Figma → 新規コンポーネント追加の Phase 0〜9
- [RELEASING.md](RELEASING.md) — npm publish + Slack 通知のリリース手順
