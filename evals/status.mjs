/*
 * evals/status.mjs — eval 結果の失敗分類（run.mjs / report.mjs 共用）
 *
 *   PASS/FAIL の 2 値では「品質の失敗」と「測定側の故障」が同じ ✗ に潰れ、
 *   スコアの劣化が本物かどうか判別できない（2026-08 の 2/5 で実際に起きた:
 *   5 件中 2 件は生成自体の失敗、1 件は審査員の応答解析失敗が混ざっていた）。
 *   結果 1 件を次の 4 区分に分類する:
 *
 *   pass             — 採点して合格
 *   fail             — 採点して不合格（品質の問題。DS 側の改善対象）
 *   error:generation — 生成自体が失敗（claude CLI / ハーネスの問題。品質シグナルではない）
 *   error:judge      — 機械チェックは通ったが LLM 審査員の応答を解析できず判定不能。
 *                      機械チェックが落ちていれば品質 fail が確定しているので fail 扱い
 *
 *   run.mjs は新規結果に status を書き込む。status を持たない過去の結果 JSON も
 *   classifyResult が同じ規則で遡及分類するため、履歴表示は遡って正しくなる。
 */

export const STATUS_SYMBOL = {
  pass: "✓",
  fail: "✗",
  "error:generation": "G",
  "error:judge": "J",
};

export function classifyResult(r) {
  if (r.status) return r.status;
  // 旧形式（status なし）の遡及分類
  if (r.generated === false) return "error:generation";
  const machineFail = [r.hardcode, r.classes, r.patterns].some((c) => c && c.pass === false);
  if (r.rubric?.error && !machineFail) return "error:judge";
  return r.pass ? "pass" : "fail";
}

/** error:* は測定不能（品質シグナルではない）。集計から除外する判定に使う */
export function isError(status) {
  return status.startsWith("error:");
}
