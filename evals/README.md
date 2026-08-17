# evals — エージェントが relay のルールに従うかを測る回帰スイート

デザインシステム側（MCP・DESIGN.md・ヘッダ）やモデルの変化で、AI エージェントの生成品質が
静かに劣化していないかを定点観測する仕組み。固定のお題をエージェントに解かせ、生成物を採点する。

- お題の正本: [cases.mjs](cases.mjs)（意図レベルのプロンプト + 必須クラス + ルーブリック）
- ランナー: [run.mjs](run.mjs)（仕組み・オプションは冒頭コメント参照）
- 履歴ビュー: [report.mjs](report.mjs)

## 実行

```sh
npm run eval                     # 全お題（生成 + 機械チェック + LLM 審査 = サブスク枠を消費）
npm run eval -- --case invite-form   # 1 お題のみ
npm run eval -- --skip-generate      # 既存の生成物を再採点（LLM 審査のみ消費）
npm run eval -- --skip-judge         # 機械チェックのみ（LLM 不使用・無料）
npm run eval -- --votes 3            # 審査 3 回の多数決（判定のブレ対策）
npm run eval:report                  # 実行履歴の推移表（無料）
```

生成物は `evals/output/*.html`（ブラウザで目視可）、結果は `evals/results/*.json`（いずれも gitignored）。

## いつ回すか（定点観測の運用）

- **週 1 回** フル実行（`npm run eval`）— モデル更新によるドリフト検知。実行後に `npm run eval:report` で推移を確認
- **MCP（`src/mcp/`）・DESIGN.md・コンポーネントヘッダを変更した PR の前後** — 変更の効果測定。
  実行のたびに直前の結果との差分（✓→✗ / ✗→✓）が自動表示される
- FAIL したら: `evals/results/` の該当 JSON に項目別の理由が入っている。生成物（output/*.html）と
  見比べ、「DS 側の知識の問題」か「お題・ルーブリックの問題」かを切り分けてから直す

## 採点

| チェック | 内容 | 判定元 | コスト |
|---|---|---|---|
| hardcode | 生 hex / px / 独自状態クラス等 | `.claude/hooks/relay-hardcode-gate.mjs`（配布中のゲートと同一判定） | 無料 |
| classes | 必須クラスの使用 / 捏造 variant（例: `btn-outline`）の検知 | `dist/mcp-index.json` | 無料 |
| patterns | `aria-current` 等の必須マークアップ + 全お題共通の a11y チェック（`lang` / img `alt` / svg の a11y 属性） | cases.mjs の `mustPatterns` + `COMMON_PATTERNS` | 無料 |
| rubric | コンポーネント選定の適切さ等、機械で測れない判断 | cases.mjs の `rubric` を LLM 審査員が判定 | LLM 1〜votes 回/お題 |

LLM 審査員の設計（機械で測れるものは機械に寄せ、LLM には判断だけを残す）:

- ツールなし・単発の claude CLI 呼び出しに HTML とルーブリックを渡し、項目別の JSON 判定を返させる
- **迷ったら不合格に倒す**指示（甘い審査で違反が素通りするより、疑陽性を人間が確認する方が安全）
- 全項目 must 扱いで 1 つでも NO ならそのお題は不合格。`--votes 3` で多数決にでき、判定のブレを吸収
- 審査員の判定自体を疑うとき: `evals/results/` の reason を生成物と突き合わせて検証する

## ロードマップ

- ~~Phase 1: 機械チェック~~（済）
- ~~Phase 2: LLM 審査員~~（済）
- ~~Phase 3: 前回比較 + 履歴レポート~~（済。週次実行は手動運用）
- **Phase 4**: ルール変更 PR に限定した CI ゲート化 — スコアが数週間安定してから判断
