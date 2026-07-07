export const meta = {
  name: 'sprint',
  description: 'Generator⇄Evaluator スプリント自動往復。1機能を generator が実装→evaluator が品質ゲート判定。FAIL ならフィードバックを渡して generator が修正、PASS まで反復。確認漏れ対策として最低 minRounds（既定3）回は回し、早期 PASS 後はスクリプトが割り当てる別観点の再点検ラウンドに切り替える。同じ指摘が2ラウンド続けば停滞として早期終了する。',
  whenToUse: '1機能を「実装→評価→修正」を自動で回して仕上げたいとき。args に { task, minRounds, maxRounds } を渡す。',
  phases: [
    { title: 'Implement', detail: 'generator が1機能を DS準拠で実装＋セルフチェック', model: 'opus' },
    { title: 'Evaluate',  detail: 'evaluator が軸A/B/C/D を実測し PASS/FAIL 判定', model: 'opus' },
  ],
};

// generator の構造化レポート（停滞検知とevaluator への正確な引き渡しに使う）
const REPORT = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'changedFiles', 'selfCheck', 'notes'],
  properties: {
    summary:      { type: 'string', description: '実装内容・使用した DS 部品/トークンの要約' },
    changedFiles: { type: 'array', items: { type: 'string' }, description: 'このラウンドで変更したファイル（変更なしなら空配列）' },
    noChange:     { type: 'boolean', description: '再点検で見落としがなくファイルを変更しなかった場合 true' },
    selfCheck:    { type: 'string', description: 'セルフチェックの実数（生色/font-size生値/祝福外spacing/独自状態クラス/外部スプライト/横溢れ4幅/consoleエラー等）' },
    notes:        { type: 'string', description: '既知の限界・申し送り（なければ「なし」）' },
  },
};

// evaluator の構造化判定（PASS/FAIL で分岐する）
const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['result', 'feedback'],
  properties: {
    result: { type: 'string', enum: ['PASS', 'FAIL'] },
    axisA_hardcoding: { type: 'string' },
    axisB_ds:         { type: 'string' },
    axisC_slop:       { type: 'string' },
    axisD_runtime:    { type: 'string' },
    feedback: {
      type: 'array',
      description: 'FAIL 項目を優先度順に。generator が単独で潰せる粒度で。',
      items: {
        type: 'object', additionalProperties: false,
        required: ['axis', 'severity', 'location', 'issue', 'fix'],
        properties: {
          axis:     { type: 'string' },
          severity: { type: 'string', enum: ['blocker', 'major', 'minor', 'nit'] },
          location: { type: 'string', description: 'file:line' },
          issue:    { type: 'string' },
          fix:      { type: 'string', description: '期待する修正（トークン名/クラス名/手順）' },
        },
      },
    },
  },
};

// 再点検ラウンドの検証観点。モデル任せにすると観点が重複しうるため、
// スクリプト側がラウンドごとにローテーション割り当てしてカバレッジを保証する。
const RECHECK_LENSES = [
  'キーボード操作とフォーカス順（Tab 移動・focus-visible リング・操作到達性）',
  'レスポンシブ幅（1440/1024/768/390 での横溢れ・コンテナはみ出し・折り返し）',
  '空・長文・エラー系のエッジケース入力（データ0件/極端に長いテキスト/バリデーション表示）',
  'コンポーネント選定の妥当性と必須内部構造（専用部品の見落とし・子クラス欠落・使用法 OK/NG）',
];

// 予算残がこれを下回ったら再点検ラウンドを切り上げて PASS を受理する
const RECHECK_BUDGET_FLOOR = 80_000;

const task = (typeof args === 'string') ? args : (args && args.task) || '(タスク未指定)';
// 1ラウンドの評価では確認漏れが多発するため、PASS でも最低 MIN 回は回す。
// 早期 PASS 後の残りラウンドは「再点検」に切り替え、evaluator に別観点の監査をさせる。
const MIN  = Math.max(1, (args && Number(args.minRounds)) || 3);
const MAX  = Math.max(MIN, (args && Number(args.maxRounds)) || 4);
if (task === '(タスク未指定)') log('⚠ args.task が未指定。例: Workflow({ name:"sprint", args:{ task:"…", minRounds:3, maxRounds:4 } })');

const feedbackKeys = (fb) => JSON.stringify((fb || []).map((f) => `${f.axis}|${f.location}`).sort());

let feedback = null, verdict = null, report = null;
let round = 0, recheckCount = 0, prevFailKeys = null, stalled = false;

while (round < MAX) {
  // 前ラウンドが PASS なのにループ継続 = MIN 未到達の再点検ラウンド
  const isRecheck = !!(verdict && verdict.result === 'PASS');

  // 予算ガード: 合格済みで残額が少なければ再点検を切り上げる（実装/修正ラウンドは削らない）
  if (isRecheck && budget.total && budget.remaining() < RECHECK_BUDGET_FLOOR) {
    log(`予算残 ${Math.round(budget.remaining() / 1000)}k < ${RECHECK_BUDGET_FLOOR / 1000}k のため再点検を切り上げ、PASS を受理`);
    break;
  }

  round++;
  const lens = isRecheck ? RECHECK_LENSES[recheckCount % RECHECK_LENSES.length] : null;
  if (isRecheck) recheckCount++;

  // agentType で .claude/agents/*.md がシステムプロンプトになるため、ルールの再掲は不要
  const genPrompt = (round === 1)
    ? `スプリント実装タスク（1機能のみ）: ${task}\n\n実装後、セルフチェックを実コマンドで実行し、実数・変更ファイル一覧つきでレポートを返すこと。`
    : isRecheck
      ? `前ラウンドは evaluator が PASS 判定だが、確認漏れ防止のため最低 ${MIN} ラウンドは回す運用の再点検ラウンド。対象タスク: ${task}\n今回の重点観点: ${lens}\nこの観点を中心にセルフチェック一式を実コマンドで再実行し、見落としや改善余地があれば修正すること。問題が無ければファイルは変更せず noChange: true とし、再計測した実数を返すこと。`
      : `前回スプリントは evaluator により FAIL。対象タスク: ${task}\n以下のフィードバックを1件ずつすべて修正せよ（修正後に再計測した実数を示すこと）:\n${JSON.stringify(feedback, null, 2)}\n\n修正後、セルフチェックを再実行し、更新後のレポートを返すこと。`;

  // 実装・修正ラウンドは深い推論（xhigh）、変更なし確認が主の再点検は medium に落とす
  report = await agent(genPrompt, {
    phase: 'Implement', label: `gen r${round}`, agentType: 'generator',
    effort: isRecheck ? 'medium' : 'xhigh', schema: REPORT,
  });

  const evalPrompt = [
    `直近スプリントの成果物を品質ゲートとして評価せよ。対象タスク: ${task}`,
    '',
    'Generator のスプリントレポート:',
    '------', report ? JSON.stringify(report, null, 2) : '(レポートなし — generator が結果を返せなかった。成果物の現状を自力で特定して評価すること)', '------',
    report && report.changedFiles && report.changedFiles.length
      ? `変更ファイル（この一覧を必ず自分で静的計測すること）: ${report.changedFiles.join(', ')}`
      : '',
    'レポートを鵜呑みにせず、静的計測と Playwright MCP での実機操作で軸A/B/C/D とタスク意図の充足を判定すること。notes（申し送り）の弱点は必ず再検証する。',
    isRecheck
      ? `このラウンドは再点検（${round} ラウンド目）。前ラウンドの PASS を鵜呑みにせず、次の観点を必ず実機で検証し、確認漏れを積極的に探すこと: ${lens}`
      : '',
    'result(PASS/FAIL) と、FAIL の場合は generator が単独で潰せる粒度の feedback を返すこと。',
  ].filter(Boolean).join('\n');

  verdict = await agent(evalPrompt, {
    phase: 'Evaluate', label: `eval r${round}`, agentType: 'evaluator',
    effort: 'high', schema: VERDICT,
  });

  // 判定ガード: PASS なのに blocker/major が残る矛盾出力は FAIL として扱う
  if (verdict && verdict.result === 'PASS' && (verdict.feedback || []).some((f) => f.severity === 'blocker' || f.severity === 'major')) {
    log(`⚠ evaluator が PASS と blocker/major 指摘を同時に返したため FAIL に降格`);
    verdict = { ...verdict, result: 'FAIL' };
  }

  log(`Round ${round}/${MAX}${isRecheck ? `（再点検: ${lens.split('（')[0]}）` : ''}: ${verdict?.result || 'NO_VERDICT'}`
    + (verdict?.feedback?.length ? ` / 指摘 ${verdict.feedback.length} 件` : '')
    + (budget.total ? ` / 消費 ${Math.round(budget.spent() / 1000)}k tok` : ''));

  // PASS でも MIN 到達までは終了しない（次ラウンドが再点検になる）
  if (verdict && verdict.result === 'PASS' && round >= MIN) break;
  if (!verdict || verdict.result !== 'PASS') {
    feedback = verdict ? verdict.feedback : [{ axis: 'system', severity: 'blocker', location: '-', issue: 'evaluator から判定が得られなかった', fix: '再評価' }];

    // 停滞検知: 同一の指摘（axis+location）が2ラウンド連続なら generator は詰まっている。
    // maxRounds まで回してもコストを燃やすだけなので早期終了して人間に返す。
    const keys = feedbackKeys(feedback);
    if (prevFailKeys !== null && keys === prevFailKeys) {
      stalled = true;
      log(`⛔ 停滞検知: 前ラウンドと同一の指摘が解消されていないため早期終了（人間の介入が必要）`);
      break;
    }
    prevFailKeys = keys;
  }
}

const passed = !stalled && verdict && verdict.result === 'PASS';
const result = passed ? 'PASS' : stalled ? 'STALLED' : 'FAIL';
log(passed
  ? `✅ スプリント合格（${round} ラウンド、最低 ${MIN} ラウンド実施）`
  : stalled
    ? `⛔ 停滞により中断（${round} ラウンド）。同じ指摘が解消できていません。最後のフィードバックを確認してください。`
    : `⛔ ${MAX} ラウンド内に合格せず。最後のフィードバックを確認してください。`);

return { task, rounds: round, minRounds: MIN, result, finalVerdict: verdict, lastReport: report };
