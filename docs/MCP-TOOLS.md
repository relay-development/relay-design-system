# relay Design System MCP — ツールリファレンス

relay Design System の MCP サーバーが提供する **8 つのツール** と、その使い方をまとめる。

- **リモート（authless / Streamable HTTP）**: `https://relay-design-system-mcp.s-taguchi.workers.dev/mcp`
- **ローカル（stdio / npm 同梱）**: `npx relay-ds-mcp`（`@light-right/design-system` に同梱）
- 実体: [src/mcp/handlers.mjs](../src/mcp/handlers.mjs)（両トランスポート共有）。データは `dist/mcp-index.json`（[scripts/build-mcp.mjs](../scripts/build-mcp.mjs) が正本ファイルから生成）。

> relay 系プロダクトの UI を作るときは必ずこのサーバーの情報を使い、自前のデザインや独自色で実装しないこと。

---

## ツール一覧

| # | ツール | 入力 | ひとことで |
|---|---|---|---|
| 1 | `get_setup` | なし | CSS 導入手順と確認方法（**最初に呼ぶ**） |
| 2 | `get_design_principles` | なし | 必須ルール＋禁止パターン Top 10 |
| 3 | `list_components` | なし | 全 25 コンポーネントの一覧 |
| 4 | `get_component` | `name` | 指定コンポーネントの完全仕様 |
| 5 | `get_tokens` | `category?` | デザイントークン（解決済み実値） |
| 6 | `list_assets` | なし | ロゴ／イラストの直リンク URL |
| 7 | `search` | `query` | 横断あいまい検索 |
| 8 | `get_sprint_kit` | なし | スプリント開発キットの配布（Claude Code 向け） |

---

## 1. `get_setup` — CSS 導入手順を返す

**入力**: なし

**何ができる**: relay の CSS をプロジェクトに導入する手順と、効いているかの確認方法を返す。

**なぜ最初に呼ぶか**: relay のクラス（`.btn` / `.card` / `.input` 等）は npm パッケージ `@light-right/design-system` の CSS が読み込まれて初めて効く。MCP はクラス名やトークンの「知識」を渡すだけで CSS 実体は渡さないため、未導入のまま relay クラスを書いても見た目が変わらず、ハードコードに逃げる結果になる。UI 着手前のセットアップ確認に使う。

---

## 2. `get_design_principles` — 規約とガードを返す

**入力**: なし

**何ができる**: コード生成前のガードとして、以下を返す。

- Non-Negotiable Principles（ハードコード禁止 / semantic color / blessed spacing / typo セマンティック層 / ARIA 状態 など）
- 禁止パターン Top 10
- ブランド色

---

## 3. `list_components` — コンポーネント一覧

**入力**: なし

**何ができる**: 全 25 コンポーネントを、英名・和名・**概要（＝機能の 1 行目）**・主要クラスの一覧で返す。UI を組む前の全体把握に使う。各コンポーネントの完全仕様は `get_component` で取得する。

---

## 4. `get_component(name)` — 完全仕様 ★中心ツール

**入力**: `name`（コンポーネント英名。例: `button` / `input` / `alert` / `card`。和名・クラス名でも解決される）

**何ができる**: 指定コンポーネントの完全仕様を、以下の順で返す。**用途と NG を先に読ませて誤用を防ぐ**設計。

1. **機能** — 何のためのコンポーネントか／似た別コンポーネントとの使い分け（例: 遷移は `link`、実行は `button`）
2. **使用法** — ✅ OK パターン / ❌ NG パターン（アンチパターン → 是正）
3. 仕様 — props・状態・色マッピング（CSS ヘッダ由来）
4. CSS クラス一覧
5. コピペ用 HTML スニペット
6. Figma リンク

> マークアップはゼロから組まず、返ってくるスニペットとクラスを土台にする。

---

## 5. `get_tokens(category?)` — デザイントークン

**入力**: `category`（任意。`colors` / `typography` / `spacing` / `radius` / `shadow`。省略で全件）

**何ができる**: デザイントークンを**解決済みの実値**で返す（例: `--color-primary-500 = #30b686`）。semantic → primitive のエイリアス（`via`）も併記。色・余白・タイポ・角丸・影をハードコードせずトークン／ユーティリティ経由で書くために使う。CSS が無いスタンドアロン生成環境では、この実値をそのまま使う。

---

## 6. `list_assets` — ブランドアセット

**入力**: なし

**何ができる**: ブランドアセット（サービスロゴ・イラスト）を**直リンク URL 付き**で返す。`<img src>` にそのまま使える。生成物にロゴ・イラストを埋め込むときに使い、独自ロゴは作らない。

---

## 7. `search(query)` — 横断あいまい検索

**入力**: `query`（検索キーワード。日本語可）

**何ができる**: コンポーネント / トークン / アセットを横断であいまい検索し、「次に呼ぶべきツール」を示す。コンポーネントは名前・和名・概要・クラスに加え、**機能文・OK/NG も検索対象**なので、「外部リンク」「削除」などの用途語でも該当コンポーネントがヒットする。例: `ボタン` / `primary` / `余白` / `shadow` / `外部リンク`。

---

## 8. `get_sprint_kit` — スプリント開発キットの配布（Claude Code 向け）

**入力**: なし

**何ができる**: relay 流のスプリント開発を回すための subagent 定義 3 つ（`planner` / `generator` / `evaluator`）と Workflow スクリプト（`sprint`）、ハードコード検知フック（`relay-hardcode-gate`・任意）を、インストール手順付きで一式返す。「実装 → 評価 → 修正」を PASS まで自動往復させたいときに呼ぶ。

**仕組み（重要）**: subagent / workflow / hook は**利用側プロジェクトのローカル `.claude/` に実在して初めて動く**ため、MCP は配布のみを担う。受け取った AI がレスポンス内の手順に従って `.claude/agents/*.md` / `.claude/workflows/sprint.js` / `.claude/hooks/*.mjs` を書き込んで使う。正本はこのリポジトリの [.claude/agents/](../.claude/agents/) / [.claude/workflows/](../.claude/workflows/) / [.claude/hooks/](../.claude/hooks/)（`build:mcp-index` が同梱）。

**書き込み時ゲート（フック・任意）**: `relay-hardcode-gate.mjs` は Write/Edit 直後に発火する PostToolUse フックで、生 hex 色・font-size 生値・祝福外 spacing・独自状態クラス・外部スプライト参照を検知して Claude に即フィードバックする（exit 2 で stderr が返る）。evaluator が見つける前に書き込み時点で弾くので、機械的違反にスプリントのラウンドを消費しない。有効化には利用側プロジェクトの `.claude/settings.json` への hooks 設定追記が必要（手順に明記済み）。**このリポジトリ自体では有効化しない**（コンポーネント CSS にはヘッダコメントで管理された正当な例外があるため）。

**標準フロー（企画 → ユーザー承認 → 実装）**: Workflow スクリプトは実行中にユーザーへ確認を取れないため、承認ゲートはメインエージェントが挟む設計。planner が `docs/sprint-plan.md` を出力 → 計画を要約提示してユーザー承認を待つ → 承認後に各スプリントを `{ name: "sprint", args: { task: "<1機能>" } }` で実行、という順序をキットの手順と `sprint` プロンプトの両方に明記している。実装する 1 機能が確定済みの場合のみ企画を飛ばして sprint workflow を直接実行してよい。

**最低ラウンド数**: 1 ラウンドの評価では確認漏れが多発するため、sprint workflow は PASS 判定でも**最低 `minRounds`（既定 3）ラウンドは実装⇄評価を回す**。早期 PASS 後の残りラウンドは「再点検」に切り替わり、generator はセルフチェック再実行、evaluator は前回と異なる観点（キーボード操作・レスポンシブ・エッジケース入力等）での再監査を行う。

**注意**:

- agent 定義の `tools:` は claude.ai コネクタ接続時の名前（`mcp__claude_ai_relay-design-system__*`）で書かれており、stdio 接続などサーバー名が異なる環境では実際のツール名への置換が必要（手順に明記済み）
- evaluator は Playwright MCP による実機確認を前提とする

---

## セットアップ

### ローカル版（stdio）

npm パッケージに `relay-ds-mcp` という stdio MCP サーバーが同梱されている。利用ツールの設定に登録する。

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

> 既にプロジェクトに `npm install @light-right/design-system` 済みなら、`command: "relay-ds-mcp"`（引数なし）で直接起動できる。Cursor / Windsurf も同じ stdio コマンドを各ツールの MCP 設定に登録すれば使える。

### リモート版（Cloudflare Workers / npm・Node 不要）

URL を登録するだけで使える。中身は公開情報のため **authless**（認証なし）・stateless で、Cloudflare Workers の無料枠で動く（[src/mcp/worker.mjs](../src/mcp/worker.mjs)）。

- **エンドポイント**: `https://relay-design-system-mcp.s-taguchi.workers.dev/mcp`
- **claude.ai**: Settings → Connectors → Add custom connector → 上記 URL を貼る（認証不要）
- stdio 版とまったく同じツール／リソースを返す（ロジックは [src/mcp/handlers.mjs](../src/mcp/handlers.mjs) で共通化）

### メンテナ向け（デプロイ）

```bash
npm run dev:mcp-remote   # ローカル確認（http://localhost:8787/mcp）
npm run deploy:mcp       # デプロイ（要 Cloudflare アカウント / wrangler login）
```

参考: [社内デザインシステムをMCPサーバー化したらUI実装が爆速になった (Ubie Dev)](https://zenn.dev/ubie_dev/articles/f927aaff02d618)

---

## ツール以外の仕組み

- **接続時の常駐ガイダンス（`initialize` の instructions）**: 接続時に「まず get_setup → get_design_principles / list_components で全体把握 → 使うコンポーネントを get_component、機能/使用法の NG を必ず確認、ハードコード禁止」というルールがシステムコンテキストとして渡され、セッション中ずっと効く。一度ツールを呼んだあとハードコードに drift する失敗を防ぐ狙い。get_setup のレスポンス末尾にも同じ次ステップ（get_design_principles / list_components → get_component → get_tokens）を明記し、セットアップ確認直後のツール選択を誘導している。
- **resources**: ツールとは別に、一部データをリソースとしても公開（`resources/list` / `resources/read`）。スプリント開発キットも `relay://skill/sprint` としてスキル形式（手順書＋ファイル一式）で読める。
- **prompts**: `sprint` プロンプトを公開。Claude Code ではスラッシュコマンド（`/mcp__<サーバー名>__sprint`）として現れ、1 コマンドで「キット未導入なら get_sprint_kit でインストール → planner で企画 → ユーザー承認 🛑 → 承認後に Workflow 実行」まで誘導する（引数 `task` に要望・議事録等の planner への入力を渡せる）。

---

## 典型的な使い方

```
get_setup            ← CSS 導入確認（未導入なら導入してから書く）
  ↓
get_design_principles ← 必須ルール / 禁止パターンを把握
  ↓
list_components      ← コンポーネントの全体像を把握
  ↓
get_component(<name>) ← 使うコンポーネントごとに。機能・使用法(NG)・スニペットを土台に
  ↓
get_tokens(<category?>) ← 具体値が要るとき
  ↓
list_assets          ← ロゴ・イラストを埋め込むとき
```

迷ったら `search` で当たりを付け、示されたツールを呼ぶ。

---

## 関連

- [docs/INTRODUCTION.md](INTRODUCTION.md) — チーム向けの入り口
- [examples/mcp.html](../examples/pages/mcp.html) — カタログ内の MCP 紹介ページ
- [docs/DECISIONS.md](DECISIONS.md) — MCP の設計判断・ヘッダ正本ルール
