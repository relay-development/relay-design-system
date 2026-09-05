import { classifyResult, isError } from "./status.mjs";

/** 古い順の履歴から、お題ごとの直近の測定可能な結果と実行情報を返す。 */
export function previousMeasurements(runs) {
  const byId = new Map();
  for (const run of runs) {
    for (const result of run.results ?? []) {
      if (!isError(classifyResult(result))) byId.set(result.id, { run, result });
    }
  }
  return byId;
}
