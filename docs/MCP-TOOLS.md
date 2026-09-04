# relay Design System MCP — ツールリファレンス

relay Design System の MCP サーバーが提供する **9 つのツール** と、その使い方をまとめる。

- **リモート（authless / Streamable HTTP）**: `https://relay-design-system-mcp.relaytown.workers.dev/mcp`
- **ローカル（stdio / npm 同梱）**: `npx relay-ds-mcp`（`@light-right/design-system` に同梱）
- 実体: [src/mcp/handlers.mjs](../src/mcp/handlers.mjs)（両トランスポート共有）。データは `dist/mcp-index.json`（[scripts/build-mcp.mjs](../scripts/build-mcp.mjs) が正本ファイルから生成）。

> relay 系プロダクトの UI を作るときは必ずこのサーバーの情報を使い、自前のデザインや独自色で実装しないこと。

---

## ツール一覧

| # | ツール | 入力 | ひとことで |
|---|---|---|---|
| 1 | `get_setup` | なし | CSS 導入手順と確認方法（**最初に呼ぶ**） |
| 2 | `get_design_principles` | なし | 必須ルール＋禁止パターン要約 |
| 3 | `get_accessibility` | `topic?` | WCAG 2.2 チェックリスト（未指定=要約＋節目次、topic 指定=該当節の本文） |
| 4 | `list_components` | なし | 全コンポーネントの一覧 |
| 5 | `get_component` | `name` | 指定コンポーネントの完全仕様（機能／使用法／**アクセシビリティ**含む） |
| 6 | `get_tokens` | `category?` | デザイントークン（解決済み実値） |
| 7 | `list_assets` | なし | ロゴ／イラストの直リンク URL |
| 8 | `search` | `query` | 横断あいまい検索 |
| 9 | `get_icon` | `name?` | 同梱 Lucide アイコンの `<symbol>` と参照方法（省略で一覧） |

---

## 1. `get_setup` — CSS 導入手順を返す

**入力**: なし

**何ができる**: relay の CSS をプロジェクトに導入する手順と、効いているかの確認方法を返す。

**なぜ最初に呼ぶか**: relay のクラス（`.btn` / `.card` / `.input` 等）は npm パッケージ `@light-right/design-system` の CSS が読み込まれて初めて効く。MCP はクラス名やトークンの「知識」を渡すだけで CSS 実体は渡さないため、未導入のまま relay クラスを書いても見た目が変わらず、ハードコードに逃げる結果になる。UI 着手前のセットアップ確認に使う。

導入済みプロジェクト向けには**バージョン確認**の手順も含む（MCP の知識の基準バージョンと利用プロジェクトの導入バージョンが異なる場合は node_modules 内の実 CSS を正とする）。

**ハードコード検知 hook の単体導入案内（2026-08 追加・Claude Code 向け）**: セットアップ手順の最後に、`relay-hardcode-gate.mjs`（Write/Edit 直後にハードコード違反を検知して Claude に即フィードバックする PostToolUse フック）を単体導入する案内を含む — リポジトリの raw URL から hook 本体を取得し、`.claude/settings.json` に hooks 設定をマージする 2 手順。正本は [.claude/hooks/relay-hardcode-gate.mjs](../.claude/hooks/relay-hardcode-gate.mjs)。旧 sprint kit（2026-08 解体）ではキット一式の同梱物だったが、hook だけを軽量に届ける形に変えた。

---

## 2. `get_design_principles` — 規約とガードを返す

**入力**: なし

**何ができる**: コード生成前のガードとして、以下を返す。

- Non-Negotiable Principles（ハードコード禁止 / semantic color / blessed spacing / typo セマンティック層 / ARIA 状態 など）
- 禁止パターン要約
- ブランド色

---

## 3. `get_accessibility` — WCAG 2.2 チェックリスト

**入力**: `topic`（任意）— 節の絞り込みキーワード。見出しの部分一致（なければ本文の全文検索）。例: `"2.4.1"` / `"スキップ"` / `"タイムアウト"`

**何ができる**: relay を採用したプロダクトが WCAG 2.2（A / AA / AAA）に準拠するための実務チェックリスト（正本は `docs/ACCESSIBILITY.md`）を返す。**topic 未指定**なら要約 2 表 —「DS が既に提供する保証」と「プロダクト側で実装が必須なもの」— と全節の目次を返す。**topic 指定**で該当節の本文（達成基準の DS 担保度・プロダクト責務・検証ツール）だけを返す。

- 以前は全文（31K 字）を一括で返していたが、実測で 1 回の応答が全ツール応答の約半分を占めたため、目次 → 節指定の 2 段構えに変更（2026-08）
- アクセシブルな UI を**生成・レビュー**するときの基準
- コンポーネント個別の必須対応は `get_component("<name>")` の**「アクセシビリティ」節**（各コンポーネント CSS ヘッダの `アクセシビリティ:` が正本）を参照

---

## 4. `list_components` — コンポーネント一覧

**入力**: なし

**何ができる**: 全コンポーネントを、英名・和名・**概要（＝機能の 1 行目）**・主要クラスの一覧で返す（UI コンポーネントのほか icon / typography 等の基盤スタイルも含む）。UI を組む前の全体把握に使う。各コンポーネントの完全仕様は `get_component` で取得する。

---

## 5. `get_component(name)` — 完全仕様 ★中心ツール

**入力**: `name`（コンポーネント英名。例: `button` / `input` / `alert` / `card`。和名・クラス名でも解決される）

**何ができる**: 指定コンポーネントの完全仕様を、以下の順で返す。**用途と NG を先に読ませて誤用を防ぐ**設計。

1. **基準バージョン注記** — この仕様がどのリリース基準か。利用プロジェクトの導入バージョンが異なる場合は node_modules 内の実 CSS（dist/relay.css）を正とする指示つき
2. **機能** — 何のためのコンポーネントか／似た別コンポーネントとの使い分け（例: 遷移は `link`、実行は `button`）
3. **使用法** — ✅ OK パターン / ❌ NG パターン（アンチパターン → 是正）
4. 仕様 — props・状態・色マッピング（CSS ヘッダ由来）
5. CSS クラス一覧
6. コピペ用 HTML スニペット

> マークアップはゼロから組まず、返ってくるスニペットとクラスを土台にする。

---

## 6. `get_tokens(category?)` — デザイントークン

**入力**: `category`（任意。`colors` / `container` / `typography` / `spacing` / `radius` / `shadow`。省略で全件）

**何ができる**: デザイントークンを**解決済みの実値**で返す（例: `--color-primary-500 = #30b686`）。semantic → primitive のエイリアス（`via`）も併記。色・余白・タイポ・角丸・影をハードコードせずトークン／ユーティリティ経由で書くために使う。CSS が無いスタンドアロン生成環境では、この実値をそのまま使う。

---

## 7. `list_assets` — ブランドアセット

**入力**: なし

**何ができる**: ブランドアセット（サービスロゴ・イラスト）を**直リンク URL 付き**で返す。`<img src>` にそのまま使える。生成物にロゴ・イラストを埋め込むときに使い、独自ロゴは作らない。

---

## 8. `search(query)` — 横断あいまい検索

**入力**: `query`（検索キーワード。日本語可）

**何ができる**: コンポーネント / トークン / アセットを横断であいまい検索し、「次に呼ぶべきツール」を示す。コンポーネントは名前・和名・概要・クラスに加え、**機能文・OK/NG も検索対象**なので、「外部リンク」「削除」などの用途語でも該当コンポーネントがヒットする。例: `ボタン` / `primary` / `余白` / `shadow` / `外部リンク`。

**クラス存在チェック**: クエリがクラス名なら relay.css（safelist 込みの dist）に**存在する／しない**を明言して返す。「ヒットなし」で濁さないのは、否定が曖昧だと AI が search を信用せず実 CSS を grep しに行くため（実例: `tabular-nums`）。

- 1 件: `search("overflow-x-auto")` → 「存在します」／ `search("tabular-nums")` → 「存在しません（書いても効かない）」＋前方一致の実在候補
- 複数一括: 空白・カンマ区切りで渡すと件ごとの ○× 表で返す。`search("flex-1 md:grid-cols-3 tabular-nums label-control-text")`。確認したいクラスが多いとき 1 件ずつ呼ばせると AI は grep ループに流れるので、こちらを使う
- 一括判定になるのは全トークンがクラス形（ASCII・記号のみ）で、かつ「実在クラス」または `-` / `:` を含むトークンが 2 つ以上あるとき。`external link` のような英単語 2 語は従来どおりあいまい検索。存在しない素の語（`underline` 等）が混ざっても他がクラスなら一括判定に入り、その語は ❌ で返る
- relay.css は 1 行にミニファイされているため grep での存在確認は機能しない。存在確認は必ずこのツールで行う

---

## 9. `get_icon(name?)` — 同梱アイコンの symbol と参照方法

**入力**: `name`（アイコン名。`lucide-` 接頭辞は省略可。省略すると同梱 53 種の一覧）

**何ができる**: Lucide スプライト（dist/icons.svg）に同梱されたアイコンの `<symbol>` markup と、2 通りの参照方法を返す。

- A: スプライトを参照できる環境（npm 導入済み・HTTP 配信）→ `<use href="…/icons.svg#lucide-名前">`
- B: 外部スプライトを参照できない環境（単一 HTML ファイル・file:// 表示・メール等）→ 返された `<symbol>` を文書内に一度定義し `<use href="#lucide-名前">`

**なぜ要るか**: 以前はアイコン仕様がスプライト前提の書き方しか示さず、単一 HTML を書くエージェントは dist/icons.svg を grep して symbol を掘り出すか、SVG パスを自作していた（evals 2026-09-03: settings-nav / faq-accordion が Bash 6〜7 回）。B の markup を MCP が返すことで、どの環境でも同じ Lucide アイコンを同じクラス（`icon icon-md`）で使える。

`search` にアイコン名を渡した場合も候補を示して get_icon へ誘導する。

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

- **エンドポイント**: `https://relay-design-system-mcp.relaytown.workers.dev/mcp`
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

- **接続時の常駐ガイダンス（instructions）**: 旧プロトコル（〜2025-11-25）では `initialize`、新プロトコル（2026-07-28〜）では `server/discover` の結果として配布（リモートサーバーは両対応）。接続時に「まず get_setup → get_design_principles / list_components で全体把握 → 使うコンポーネントを get_component、機能/使用法の NG を必ず確認、ハードコード禁止」というルールがシステムコンテキストとして渡され、セッション中ずっと効く。一度ツールを呼んだあとハードコードに drift する失敗を防ぐ狙い。get_setup のレスポンス末尾にも同じ次ステップ（get_design_principles / list_components → get_component → get_tokens）を明記し、セットアップ確認直後のツール選択を誘導している。
- **事前知識で答えないルール（instructions 内）**: 実装を伴わない質問・レビュー・相談でも、relay の仕様に関する回答は必ずツールで確認してから行うことを instructions で強制。AI が記憶で答えて古い・存在しないクラスを案内するハルシネーションを防ぐ（SmartHR Design System の SKILL.md 方式）。
- **バージョンずれ対策**: instructions・get_setup・get_component の 3 箇所で「この知識は v〇〇 基準。利用プロジェクトの導入バージョンが異なる場合は node_modules 内の実 CSS を正とする」を明示。MCP の知識と実 CSS のバージョン差で「クラスが効かない → ハードコードに逃げる」事故を防ぐ。
- **resources**: ツールとは別に、一部データをリソースとしても公開（`resources/list` / `resources/read`）。DESIGN.md（`relay://design-constitution`）と各コンポーネント仕様（`relay://component/<name>`）。
- **prompts**: 現在は空（スプリント開発キットの解体〈2026-08〉に伴い `sprint` プロンプトを廃止。トランスポートとの API 互換のため機構自体は残す）。

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
- [examples/pages/mcp.html](../examples/pages/mcp.html) — カタログ内の MCP 紹介ページ
- [docs/DECISIONS.md](DECISIONS.md) — MCP の設計判断・ヘッダ正本ルール
