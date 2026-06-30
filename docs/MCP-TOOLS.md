# relay Design System MCP — ツールリファレンス

relay Design System の MCP サーバーが提供する **7 つのツール** と、その使い方をまとめる。

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

## ツール以外の仕組み

- **接続時の常駐ガイダンス（`initialize` の instructions）**: 接続時に「まず get_setup →（get_design_principles）→ 使うコンポーネントを get_component、機能/使用法の NG を必ず確認、ハードコード禁止」というルールがシステムコンテキストとして渡され、セッション中ずっと効く。一度ツールを呼んだあとハードコードに drift する失敗を防ぐ狙い。
- **resources**: ツールとは別に、一部データをリソースとしても公開（`resources/list` / `resources/read`）。

---

## 典型的な使い方

```
get_setup            ← CSS 導入確認（未導入なら導入してから書く）
  ↓
get_design_principles ← 必須ルール / 禁止パターンを把握
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
- [CLAUDE.md](../CLAUDE.md) — MCP の設計判断・ヘッダ正本ルール
