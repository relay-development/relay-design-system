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

```bash
# 1) main を最新化
git checkout main
git pull --ff-only

# 2) 変更が積まれていることを確認
git log --oneline $(git describe --tags --abbrev=0)..HEAD

# 3) バージョンを bump（package.json 更新 + git tag v0.x.y が自動で作られる）
npm version patch    # or minor / major

# 4) push（タグも一緒に送る）
git push --follow-tags

# 5) npm に publish
#    prepublishOnly が走るため、自動的に `npm run build` が実行される
npm publish

# 6) GitHub Releases にリリースノート
#    https://github.com/relay-development/relay-design-system/releases/new
#    → 作られた tag を選択 → 変更点を箇条書きで記載
```

## 公開前チェックリスト

- [ ] `examples/index.html` をブラウザで開き、追加 / 変更したコンポーネントが正しく表示される
- [ ] `npm run build` が成功し、`dist/relay.css` と `dist/tokens.css` が更新される
- [ ] `npm pack --dry-run` で配布物に余計なファイルが含まれていない
- [ ] README のコンポーネント一覧が最新（追加した場合）
- [ ] Figma との突き合わせ：トークンを変更した場合、Figma 側の `semantic tokens` も更新済み

## 失敗 / リカバリ

- `npm publish` でエラー（403 / 404 等）が出たら publish 自体は失敗で取り消しは不要
- 既に publish した直後に重大な不具合が見つかった場合: **新しい patch バージョンを出す**（`npm unpublish` は 72 時間以内のみ可だが推奨しない）

## 通知

publish 完了後、Slack / Notion などで一度告知する。テンプレ:

```
🚀 @light-right/design-system v0.x.y を公開しました
- 変更点: …
- リリースノート: https://github.com/relay-development/relay-design-system/releases/tag/v0.x.y
- プレビュー: https://relaydesign.netlify.app
```
