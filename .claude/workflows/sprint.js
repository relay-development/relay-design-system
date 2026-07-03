export const meta = {
  name: 'sprint',
  description: 'Generator⇄Evaluator スプリント自動往復。1機能を generator が実装→evaluator が品質ゲート判定。FAIL ならフィードバックを渡して generator が修正、PASS まで反復。確認漏れ対策として最低 minRounds（既定3）回は回し、早期 PASS 後は別観点の再点検ラウンドに切り替える。',
  whenToUse: '1機能を「実装→評価→修正」を自動で回して仕上げたいとき。args に { task, minRounds, maxRounds } を渡す。',
  phases: [
    { title: 'Implement', detail: 'generator が1機能を DS準拠で実装＋セルフチェック', model: 'opus' },
    { title: 'Evaluate',  detail: 'evaluator が軸A/B/C/D を実測し PASS/FAIL 判定', model: 'opus' },
  ],
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

const task = (typeof args === 'string') ? args : (args && args.task) || '(タスク未指定)';
// 1ラウンドの評価では確認漏れが多発するため、PASS でも最低 MIN 回は回す。
// 早期 PASS 後の残りラウンドは「再点検」に切り替え、evaluator に別観点の監査をさせる。
const MIN  = Math.max(1, (args && Number(args.minRounds)) || 3);
const MAX  = Math.max(MIN, (args && Number(args.maxRounds)) || 4);
if (task === '(タスク未指定)') log('⚠ args.task が未指定。例: Workflow({ name:"sprint", args:{ task:"…", minRounds:3, maxRounds:4 } })');

let feedback = null, verdict = null, report = null, round = 0;

while (round < MAX) {
  round++;
  // 前ラウンドが PASS なのにここに居る = MIN 未到達の再点検ラウンド
  const isRecheck = !!(verdict && verdict.result === 'PASS');

  // agentType で .claude/agents/*.md がシステムプロンプトになるため、ルールの再掲は不要
  const genPrompt = (round === 1)
    ? `スプリント実装タスク（1機能のみ）: ${task}\n\n実装後、セルフチェックを実コマンドで実行し、所定のスプリントレポート（実数・変更ファイル一覧つき）を返すこと。`
    : isRecheck
      ? `前ラウンドは evaluator が PASS 判定だが、確認漏れ防止のため最低 ${MIN} ラウンドは回す運用の再点検ラウンド。対象タスク: ${task}\nセルフチェック一式を実コマンドで再実行し、見落とし（DS 準拠・a11y・エッジケース・レスポンシブ）や改善余地があれば修正すること。問題が無ければファイルは変更せず「変更なし」と明記し、再計測した実数つきのスプリントレポートを返すこと。`
      : `前回スプリントは evaluator により FAIL。対象タスク: ${task}\n以下のフィードバックを1件ずつすべて修正せよ（修正後に再計測した実数を示すこと）:\n${JSON.stringify(feedback, null, 2)}\n\n修正後、セルフチェックを再実行し、更新後のスプリントレポートを返すこと。`;

  report = await agent(genPrompt, { phase: 'Implement', label: `gen r${round}`, agentType: 'generator' });

  const evalPrompt = [
    `直近スプリントの成果物を品質ゲートとして評価せよ。対象タスク: ${task}`,
    '',
    'Generator のスプリントレポート:',
    '------', report || '(レポートなし)', '------',
    'レポートの変更ファイルを自分で静的計測し、Playwright MCP で実機を操作して軸A/B/C/D とタスク意図の充足を判定すること。自己申告は鵜呑みにしない。',
    isRecheck
      ? `このラウンドは再点検（${round}/${MIN} ラウンド目）。前ラウンドの PASS を鵜呑みにせず、前回と異なる観点（キーボード操作とフォーカス順・レスポンシブ幅・空/長文/エラー系のエッジケース入力・コンポーネント選定の妥当性）を必ず1つ以上実機で検証し、確認漏れを積極的に探すこと。`
      : '',
    'result(PASS/FAIL) と、FAIL の場合は generator が単独で潰せる粒度の feedback を返すこと。',
  ].filter(Boolean).join('\n');

  verdict = await agent(evalPrompt, { phase: 'Evaluate', label: `eval r${round}`, agentType: 'evaluator', schema: VERDICT });

  log(`Round ${round}/${MAX}${isRecheck ? '（再点検）' : ''}: ${verdict?.result || 'NO_VERDICT'}` + (verdict?.feedback?.length ? ` / 指摘 ${verdict.feedback.length} 件` : ''));

  // PASS でも MIN 到達までは終了しない（次ラウンドが再点検になる）
  if (verdict && verdict.result === 'PASS' && round >= MIN) break;
  if (!verdict || verdict.result !== 'PASS') {
    feedback = verdict ? verdict.feedback : [{ axis: 'system', severity: 'blocker', location: '-', issue: 'evaluator から判定が得られなかった', fix: '再評価' }];
  }
}

const passed = verdict && verdict.result === 'PASS';
log(passed ? `✅ スプリント合格（${round} ラウンド、最低 ${MIN} ラウンド実施）` : `⛔ ${MAX} ラウンド内に合格せず。最後のフィードバックを確認してください。`);

return { task, rounds: round, minRounds: MIN, result: passed ? 'PASS' : 'FAIL', finalVerdict: verdict, lastReport: report };
