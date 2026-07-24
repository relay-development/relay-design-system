# relay Design System へようこそ

relay プロダクトの UI を、誰が作っても **同じ見た目・同じ操作感** になるようにまとめた共通部品集です。
ボタン・入力欄・カード・アラートなど **25 種類のコンポーネント** と、色・余白・文字サイズなどの **デザイントークン** が入っています。

> 「relay っぽい UI を、毎回ゼロから考えずに済む」状態を目指しています。

---

## 🗺️ 4 つの入り口

このデザインシステムは 4 つの場所に存在します。役割によって主に見る場所が変わります。

### 🎨 1. Figma — デザイン探求の場

- **主に使う人**: デザイナー
- **ここで何をする**: 新しいコンポーネント・画面のデザインを探求・検討する（固まったデザインはコードに取り込み、以後はコードが正式版）

### 💻 2. GitHub — デザインシステムの "正本"

- **URL**: https://github.com/relay-development/relay-design-system
- **主に使う人**: エンジニア
- **ここで何をする**: コードを読む / バグ報告・要望を Issue で送る / 変更の履歴を追う

### 🌐 3. プレビューサイト — 見た目のカタログ

- **URL**: https://relay-development.github.io/relay-design-system
- **主に使う人**: 👥 全員（特にデザイナー・PM）
- **ここで何をする**: コンポーネントごとのページで状態（通常 / hover / disabled / エラーなど）を確認。トップページのカードプレビュー、または左サイドナビから各ページへ移動できます

> GitHub のコードが更新されると、このプレビューサイトは **自動で最新版に差し替わります**。常に最新です。

### 📦 4. npm パッケージ — プロダクト導入用

- **パッケージ名**: `@light-right/design-system`
- **URL**: https://www.npmjs.com/package/@light-right/design-system
- **主に使う人**: エンジニア
- **ここで何をする**: 自社プロダクトに `npm install` してデザインシステムを取り込む

---

## 👥 役割別ガイド

### まず最初にやること（全員）

👉 https://relay-development.github.io/relay-design-system を開いて、どんなコンポーネントがあるかザッと眺めてください。トップページにコンポーネントごとのプレビューカードが並んでいるので、気になるものをクリックすると専用ページに移動できます（左サイドナビからも移動可）。

### 🎨 デザイナーの方へ

1. 新しいデザインの探求・検討は Figma ファイルで自由に行ってください
2. デザインが固まったら、エンジニアに「これコードに取り込んで」と一言伝えてください（コードに入った時点で正式版になります）
3. 軽い修正提案は Figma 内コメントでも OK

### 💻 エンジニアの方へ

プロダクトで使うのは 2 ステップです:

**1. インストール**
```bash
npm install @light-right/design-system
```

**2. アプリのエントリ（`main.ts` / `_app.tsx` / `app/layout.tsx` など）に 1 行追加**
```ts
import "@light-right/design-system/css";
```

これで HTML / JSX で以下のようにクラスを書くだけで relay 風のスタイルになります:

```tsx
<button className="btn btn-md btn-primary">保存</button>
```

> 詳しい使い方・全コンポーネントのクラス一覧は GitHub の [README](https://github.com/relay-development/relay-design-system#readme) を参照。

### 📋 PM / プロダクトオーナーの方へ

- 仕様議論で「この保存ボタンってどのスタイル？」となったら、プレビューサイトを指差してください
- 「ここに新しいフィルター UI が欲しい」のような要望は **GitHub Issue にスクショ + 使い道を書いて** いただけると、デザイナー・エンジニアが拾えます

---

## 💬 質問・要望はどこへ

| 内容 | 出し先 |
|---|---|
| バグ報告・新規コンポーネント要望 | [GitHub Issues](https://github.com/relay-development/relay-design-system/issues) |
| デザイン仕様の議論 | Figma 内コメント |
| 緊急・ちょっとした相談 | Slack（もし `#design-system` チャンネルがあればそこ） |

---

## ✨ 現状

- **最新バージョン**: [npm のパッケージページ](https://www.npmjs.com/package/@light-right/design-system)を参照（リリースごとにここを書き換えない）
- **入っているもの**: Button / Icon Button / Label Control / Input / Search Input / Selector / Textarea / Checkbox / Radio / Filter Chip / Tab / Table / Simple Table / Card / Badge / Alert / Link / Breadcrumb / Side Nav / Pagination / Stepper / Modal / Tooltip / Toggle Switch
- **ライセンス**: MIT
- **更新**: コード側の変更を随時 npm に publish（Figma で探求したデザインは、コードに取り込んだ時点で正式版）
- **リリース通知**: 新バージョンを publish すると Slack `#dev_information` に自動でアナウンスが流れます 📣

---

## 🤖 AI で書く人へ — MCP サーバー

Cursor や Claude Code などの AI コーディングツールに「relay のデザインシステムをまるごと理解させる」ための
**MCP（Model Context Protocol）サーバー**を npm パッケージに同梱しています。これを使うと:

- 「relay のスタイルでログイン画面作って」と頼むだけで、デザインシステムに準拠した UI が生成される
- どのコンポーネントにどんな props / クラスがあるかを AI が自動で把握する
- ハードコード値や規約違反（`text-sm` 直書き等）を避けやすくなる

### 登録方法（Claude Code の例）

`.mcp.json` に以下を追加すれば使えます（Cursor / Windsurf も各ツールの MCP 設定に同じコマンドを登録）:

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

登録すると `get_setup` / `list_components` / `get_component` / `get_tokens` / `get_design_principles` / `list_assets` / `search` / `get_sprint_kit` の
8 つのツールが AI から使えるようになります。詳細は GitHub の [README](https://github.com/relay-development/relay-design-system#readme) を参照。

参考事例: [社内デザインシステムをMCPサーバー化したらUI実装が爆速になった (Ubie Dev)](https://zenn.dev/ubie_dev/articles/f927aaff02d618) — 「テキスト指示だけで UI が約 1 分で完成」と報告されています。

---

何かわからないことがあれば、お気軽に聞いてください 🙌
