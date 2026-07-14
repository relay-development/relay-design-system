# リリース手順

このドキュメントは `@light-right/design-system` の新バージョン公開フローを定義する。

## 前提

- npm に publish 権限を持っている（`npm whoami` が通る、`@light-right` 組織のメンバー）
- GitHub の repo に push 権限を持っている
- `main` ブランチが最新の状態

## SemVer 運用ルール

| 種別 | コマンド | 例 | 使うとき |
|---|---|---|---|
| patch | `npm version patch` | 0.1.0 → 0.1.1 | バグ修正 / スタイル微調整 / ドキュメント修正 |
| minor | `npm version minor` | 0.1.0 → 0.2.0 | 後方互換のあるコンポーネント / トークン追加 |
| major | `npm version major` | 0.1.0 → 1.0.0 | トークン名変更 / 既存クラス削除など破壊的変更 |

## 手順

> **main は保護ブランチ**のため、バージョンコミットも直接 push できない。他の変更と同じく PR 経由でマージし、タグは**マージ後の main のコミット**に打つ。
> （`npm version` が自動で作るタグをそのまま `git push --follow-tags` すると、main が拒否されてもタグだけ孤児コミットを指したまま届いてしまう）

```bash
# 1) main を最新化
git checkout main
git pull --ff-only

# 2) 変更が積まれていることを確認
git log --oneline $(git describe --tags --abbrev=0)..HEAD

# 3) release ブランチでバージョンを bump（タグはまだ作らない）
git checkout -b release-v0.x.y
npm version patch --no-git-tag-version    # or minor / major
git commit -am "chore(release): 0.x.y"

# 4) push → PR 作成 → ユーザー承認後に squash merge（通常のチェックポイント運用と同じ）
git push -u origin release-v0.x.y
gh pr create --title "chore(release): 0.x.y" --body "..."
gh pr merge --squash --delete-branch

# 5) マージ後の main にタグを打って push
git checkout main && git pull --ff-only
git tag -a v0.x.y -m "0.x.y"
git push origin v0.x.y

# 6) npm に publish
#    prepublishOnly が走るため、自動的に `npm run build` が実行される
npm publish

# 7) GitHub Releases にリリースノート
#    gh release create v0.x.y --title "v0.x.y" --notes "変更点を箇条書きで"
#    （publish すると Slack 通知が自動で流れる。下記「通知」参照）
```

## 公開前チェックリスト

- [ ] `npm run dev`（または `npm run build:pages`）で生成した `examples/index.html` をブラウザで開き、追加 / 変更したコンポーネントが正しく表示される（`examples/*.html` はビルド生成物・gitignored）
- [ ] `npm run build` が成功し、`dist/relay.css` と `dist/tokens.css` が更新される
- [ ] `npm pack --dry-run` で配布物に余計なファイルが含まれていない
- [ ] README のコンポーネント一覧が最新（追加した場合）
- [ ] トークンを変更した場合、DESIGN.md / README のトークン記載も更新済み（正本はコード。Figma への反映は必須でない）

## 失敗 / リカバリ

- `npm publish` でエラー（403 / 404 等）が出たら publish 自体は失敗で取り消しは不要
- 既に publish した直後に重大な不具合が見つかった場合: **新しい patch バージョンを出す**（`npm unpublish` は 72 時間以内のみ可だが推奨しない）

## 通知（自動）

GitHub で Release を **publish** すると、[.github/workflows/notify-slack-on-release.yml](../.github/workflows/notify-slack-on-release.yml) が自動で `#dev_information` に通知を投稿します。**手動で Slack に貼る必要はありません。**

通知に含まれる情報:

- バージョン（タグ名）
- 変更点の要約（Release 本文の箇条書きを最大 3 件。超過分は「その他 N 件対応」にまとめる）
- このリリース期間に close された Issue 一覧（`Fixes #N` で PR 経由 close したものも含む）
- リリースノート / プレビューサイトへのリンク

### 通知が動かない時のチェック

- GitHub → Actions タブで `Notify Slack on release` ワークフローのログ確認
- 通知先チャンネル変更や Webhook 失効時は repo の Secrets `SLACK_WEBHOOK_URL` を更新
  - https://github.com/relay-development/relay-design-system/settings/secrets/actions

### 初期セットアップ（一度だけ）

1. https://api.slack.com/apps で App を作成
2. **Incoming Webhooks** → Add New Webhook → 投稿先に `#dev_information` を選択
3. 生成された URL を repo Secrets に `SLACK_WEBHOOK_URL` として登録
