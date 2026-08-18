# review-log — LLM 審査員の監査記録

eval の合否は LLM 審査員（rubric 判定）に依存している。**審査員自体が信頼できるか**を
人が抜き取りで確かめ、ここに記録する（審査員の定期健康診断。eval が生成の健康診断であるのと対）。

## 運用

- **いつ**: 週次フル実行のあと、月 1 回を目安に数件を抜き取り監査する。
  審査の判定が直感と合わないとき・お題やルーブリックを変えたときは随時
- **やり方**: `evals/results/` の該当 JSON の rubric 判定（pass/reason）と、その実行で採点された
  HTML のアーカイブ（JSON の `output` が指す `evals/results/outputs/<実行スタンプ>/<id>.html`）を
  突き合わせ、判定が妥当だったかを人が見る。
  ※ アーカイブは 2026-08-18 の実行から。それ以前の判定は生成物が上書きで失われており、
  各お題の最新生成分（`evals/output/`）しか突き合わせられない — 7 月分の判定は監査不能
- **記録**: 下の表に 1 行追加する。「誤判定」が出たらルーブリックの文言か審査員プロンプト
  （run.mjs の judgePrompt）を直し、その PR にこのログの行を根拠として書く
- 判定不能（`error:judge`）は審査員の故障であり監査対象外（status.mjs の分類を参照）

判定の凡例: **妥当** = 審査どおり / **誤判定(偽陽性)** = 合格すべきものを落とした /
**誤判定(偽陰性)** = 違反を見逃した / **基準側の問題** = 審査は正しいがルーブリックの文言が悪い

## 監査記録

| 日付 | お題 | 審査員の判定 | 人の判定 | メモ |
|---|---|---|---|---|
| 2026-08-17 | listing-filter | FAIL（change で即時絞り込み・実行ボタンなし / checkbox でなく filter-chip で代用） | 妥当 | 生成物と突き合わせて確認。ただし根因は基準側にもあり: checkbox ヘッダが絞り込み用途を filter-chip へ誘導していた + お題が送信シナリオであることを明示していなかった → 境界明文化とお題修正で対応 |
| 2026-08-17 | settings-nav | FAIL（menu / menu-item 不使用・aria-current なし） | 妥当 | 生成物は tab で実装（選定コメントつき）。審査は正しい。根因は menu/tab の境界が形状ベースだったこと → ヘッダ修正で対応 |
| 2026-08-17 | settings-nav | PASS（境界明文化後の再実行・rubric 3/3） | 妥当 | 生成物に nav.menu + menu-item + aria-current="page" を確認 |
| 2026-08-18 | delete-confirmation | PASS（8/5 判定） | 妥当※ | 遡り監査。dialog / btn-negative / キャンセル導線を生成物で確認 |
| 2026-08-18 | invite-form | PASS（8/5 判定） | 妥当※ | 遡り監査。label-badge-required/optional・btn-primary が 1 つだけ・typo-small 逃げなしを確認 |
| 2026-08-18 | status-table | PASS（8/3 判定） | 妥当※ | 遡り監査。data-table・badge-soft-success/danger の使い分けを確認 |
| 2026-08-18 | empty-state | PASS（8/3 判定） | 妥当※ | 遡り監査。btn-primary・typo-*・fg-* ロール使用、neutral-* 直指定なしを確認 |
| 2026-08-18 | faq-accordion | PASS（8/17 判定） | 妥当※ | 遡り監査。details + accordion-trigger/icon、独自 is-open なしを確認 |
| 2026-08-18 | article-links | PASS（8/17 判定） | 妥当※ | 遡り監査。link・typo-article + text-fg-high、下線消しなしを確認 |

※ 2026-08-18 の 6 件は主要根拠の機械突き合わせによる遡り監査（Claude Code 実施・目視の再確認歓迎）。
これで現存する生成物に対する判定はすべて監査済み。7 月分の判定（5/5 連発期）は生成物が
失われており監査不能 — この穴を塞ぐのが上記のアーカイブ（8/18 導入）。
