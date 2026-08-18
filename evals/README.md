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
  実行のたびに直前の結果との差分（✓→✗ / ✗→✓ 等）が自動表示される
- FAIL したら: まず該当 JSON の `status` を見て品質の失敗（fail）か測定の故障（error:*）かを確認する。
  fail なら項目別の reason と生成物（output/*.html）を見比べ、「DS 側の知識の問題」か
  「お題・ルーブリックの問題」かを切り分けてから直す。error:* は DS でなくハーネス側を直す

## 結果の 4 区分（品質の失敗と測定の故障を混同しない）

結果 JSON の各お題には `status` が記録される（分類規則の正本: [status.mjs](status.mjs)。
`status` を持たない過去の結果も同じ規則で遡及分類されるため、`eval:report` の履歴表示は遡って正しい）:

| status | 意味 | 対処 |
|---|---|---|
| `pass` / `fail` | 採点できた上での合否。**fail だけが品質シグナル** | DS 側（MCP・DESIGN.md 等）を直す |
| `error:generation` | 生成自体が失敗（claude CLI / ハーネスの問題） | ハーネス側を直す。品質劣化と読まない |
| `error:judge` | 機械チェックは通ったが審査員の応答を解析できず判定不能 | 再実行 or 審査員まわりを直す |

機械チェックが落ちている場合は審査員が判定不能でも品質 fail が確定しているので `fail` になる。
`eval:report` では G（生成失敗）/ J（審査不能）で表示され、計にも数えない（`!n` 表記）。

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
- 応答の解析失敗（審査員側の故障）は 1 回だけ自動再試行。それでも全 votes 失敗なら
  `error:judge`（判定不能）として品質 fail と区別する
- 全項目 must 扱いで 1 つでも NO ならそのお題は不合格。`--votes 3` で多数決にでき、判定のブレを吸収
- 審査員の判定自体を疑うとき: `evals/results/` の reason を生成物と突き合わせて検証し、
  結果を [review-log.md](review-log.md) に記録する（月 1 回目安の抜き取り監査。誤判定が出たら
  ルーブリックか審査員プロンプトを直す）

## 人のレビューの記録先（2 つ）

| ファイル | 何を書くか | 扱い |
|---|---|---|
| `evals/BACKLOG.md` | 実装中に「AI の出力が期待と違った」瞬間の 3 行メモ → 切り分けてお題化する入口 | **ローカル専用・コミットしない**（内部情報を含むため。`.git/info/exclude` 登録） |
| [review-log.md](review-log.md) | LLM 審査員の判定を人が抜き取り監査した記録（審査員の信頼性の定点） | コミットする |

## ロードマップ

- ~~Phase 1: 機械チェック~~（済）
- ~~Phase 2: LLM 審査員~~（済）
- ~~Phase 3: 前回比較 + 履歴レポート~~（済。週次実行は手動運用）
- **Phase 4**: ルール変更 PR に限定した CI ゲート化 — スコアが数週間安定してから判断
