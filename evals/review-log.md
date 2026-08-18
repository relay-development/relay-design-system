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
- **画面のスナップショット**: 監査した HTML をアーカイブから [audited/](audited/) へ
  `<監査日>-<お題>.html` の名前でコピーし、行の「画面」列からリンクする
  （公開されるため、実在の人名等は架空値に置換 — 手順は audited/README.md）
- 判定不能（`error:judge`）は審査員の故障であり監査対象外（status.mjs の分類を参照）

判定の凡例: **妥当** = 審査どおり / **誤判定(偽陽性)** = 合格すべきものを落とした /
**誤判定(偽陰性)** = 違反を見逃した / **基準側の問題** = 審査は正しいがルーブリックの文言が悪い

## 監査記録

審査員の判定は PASS / FAIL のみ。FAIL のときだけ理由を `<br>・` 区切りの箇条書きで続ける
（この書式はカタログの監査ログページが箇条書きとして描画する）。

| 日付 | お題 | 審査員の判定 | 人の判定 | 画面 | メモ |
|---|---|---|---|---|---|
| 2026-08-17 | listing-filter | FAIL<br>・select の change で即時絞り込み（実行ボタンなし）<br>・checkbox でなく filter-chip で代用 | 妥当 | [再現を開く](audited/2026-08-17-listing-filter-fail-repro.html) | 生成物と突き合わせて確認。ただし根因は基準側にもあり: checkbox ヘッダが絞り込み用途を filter-chip へ誘導していた + お題が送信シナリオであることを明示していなかった → 境界明文化とお題修正で対応 |
| 2026-08-17 | settings-nav | FAIL<br>・menu / menu-item 不使用<br>・現在地の aria-current なし | 妥当 | —（消失。8/18 に改めて検査 → 下の行） | 生成物は tab で実装（選定コメントつき）。審査は正しい。根因は menu/tab の境界が形状ベースだったこと → ヘッダ修正で対応 |
| 2026-08-17 | settings-nav | PASS | 妥当 | [開く](audited/2026-08-17-settings-nav.html) | 境界明文化後の再実行（rubric 3/3）。生成物に nav.menu + menu-item + aria-current="page" を確認 |
| 2026-08-18 | delete-confirmation | PASS | 妥当※ | [開く](audited/2026-08-18-delete-confirmation.html) | 8/5 の判定を遡り監査。dialog / btn-negative / キャンセル導線を生成物で確認 |
| 2026-08-18 | invite-form | PASS | 妥当※ | [開く](audited/2026-08-18-invite-form.html) | 8/5 の判定を遡り監査。label-badge-required/optional・btn-primary が 1 つだけ・typo-small 逃げなしを確認 |
| 2026-08-18 | status-table | PASS | 妥当※ | [開く](audited/2026-08-18-status-table.html) | 8/3 の判定を遡り監査。data-table・badge-soft-success/danger の使い分けを確認 |
| 2026-08-18 | empty-state | PASS | 妥当※ | [開く](audited/2026-08-18-empty-state.html) | 8/3 の判定を遡り監査。btn-primary・typo-*・fg-* ロール使用、neutral-* 直指定なしを確認 |
| 2026-08-18 | faq-accordion | PASS | 妥当※ | [開く](audited/2026-08-18-faq-accordion.html) | 8/17 の判定を遡り監査。details + accordion-trigger/icon、独自 is-open なしを確認 |
| 2026-08-18 | article-links | PASS | 妥当※ | [開く](audited/2026-08-18-article-links.html) | 8/17 の判定を遡り監査。link・typo-article + text-fg-high、下線消しなしを確認 |
| 2026-08-18 | settings-nav | PASS | 妥当※ | [開く](audited/2026-08-18-settings-nav.html) | 消失した FAIL 版の再現を試みたが、境界明文化「前」の知識でも 2 回とも menu を正しく選んだため、改めて全チェックで検査（審査 3/3）。nav.menu + aria-current を確認。旧知識でも常に失敗するわけではない（揺らぎ）ことの記録 |

※ 2026-08-18 の 6 件は主要根拠の機械突き合わせによる遡り監査（Claude Code 実施・目視の再確認歓迎）。
※ 「再現」は原本がアーカイブ導入（8/18）前に上書きで失われたため、当時と同じ DS 知識・お題文言で再生成した再現品（同型の失敗を確認済み）。監査証跡の原本ではない。
これで現存する生成物に対する判定はすべて監査済み。7 月分の判定（5/5 連発期）は生成物が
失われており監査不能 — この穴を塞ぐのが上記のアーカイブ（8/18 導入）。
