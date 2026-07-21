# evals — エージェントが relay のルールに従うかを測る回帰スイート

デザインシステム側（MCP・DESIGN.md・ヘッダ）やモデルの変化で、AI エージェントの生成品質が
静かに劣化していないかを定点観測する仕組み。固定のお題をエージェントに解かせ、生成物を採点する。

- お題の正本: [cases.mjs](cases.mjs)（意図レベルのプロンプト + 必須クラス + ルーブリック）
- ランナー: [run.mjs](run.mjs)（仕組み・オプションは冒頭コメント参照）

## 実行

```sh
npm run eval                     # 全お題（お題数ぶんエージェント生成が走る = サブスク枠を消費）
npm run eval -- --case invite-form   # 1 お題のみ
npm run eval -- --skip-generate      # 既存の生成物を再採点のみ（LLM 不使用・無料）
```

生成物は `evals/output/*.html`（ブラウザで目視可）、結果は `evals/results/*.json`（いずれも gitignored）。

## いつ回すか

- MCP（`src/mcp/`）・DESIGN.md・コンポーネントヘッダを変更した PR の前後（効果測定）
- 週 1 回の定点観測（モデル更新によるドリフト検知）

## 採点（Phase 1 = 機械チェックのみ）

| チェック | 内容 | 判定元 |
|---|---|---|
| hardcode | 生 hex / px / 独自状態クラス等 | `.claude/hooks/relay-hardcode-gate.mjs`（配布中のゲートと同一判定） |
| classes | 必須クラスの使用 / 捏造 variant（例: `btn-outline`）の検知 | `dist/mcp-index.json` |
| patterns | `aria-current` 等の必須マークアップ | cases.mjs の `mustPatterns` |

## ロードマップ

- **Phase 2**: cases.mjs の `rubric`（定義済み・未使用）を LLM 審査員（evaluator agent 流用）で採点
- **Phase 3**: results/ の履歴比較による定点観測の運用化
- **Phase 4**: ルール変更 PR に限定した CI ゲート化（スコアが安定してから）
