/*
 * evals/report.mjs — eval 実行履歴の定点観測ビュー
 *
 *   evals/results/*.json を時系列に並べ、お題ごとの PASS/FAIL 推移を表で出す。
 *   「どの実行から、どのお題が落ち始めたか」を一目で追うためのもの。
 *   LLM は使わない（読み取りのみ・無料）。
 *
 * 実行:
 *   npm run eval:report            # 全履歴（新しい順に最大 20 件）
 *   npm run eval:report -- --all   # 全件
 *
 * 凡例: ✓ PASS / ✗ FAIL（品質） / G 生成失敗 / J 審査不能 / － そのお題を含まない実行
 *       G / J は測定側の故障（品質シグナルではない）。計には数えず !n で件数を示す。
 *       行末の * は機械チェックのみ（--skip-judge）の実行
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CASES, kindOf } from "./cases.mjs";
import { STATUS_SYMBOL, classifyResult, isError } from "./status.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const resultsDir = path.join(__dirname, "results");
const showAll = process.argv.includes("--all");

if (!fs.existsSync(resultsDir)) {
  console.log("履歴がありません。まず npm run eval を実行してください。");
  process.exit(0);
}

const runs = fs
  .readdirSync(resultsDir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => {
    try {
      return { file: f, ...JSON.parse(fs.readFileSync(path.join(resultsDir, f), "utf8")) };
    } catch {
      return null;
    }
  })
  .filter(Boolean);

if (!runs.length) {
  console.log("履歴がありません。まず npm run eval を実行してください。");
  process.exit(0);
}

const shown = showAll ? runs : runs.slice(-20);
const ids = CASES.map((c) => c.id);
// 過去の実行にしか無いお題（rename・削除済み）も列に含める
for (const run of shown) for (const r of run.results ?? []) if (!ids.includes(r.id)) ids.push(r.id);

const col = (s, w) => String(s).padEnd(w);
const idW = Math.max(...ids.map((i) => i.length)) + 2;

// kind の解決: 結果に記録があればそれ、無ければ現行 CASES から補完（過去の結果 JSON は kind を持たない）
const kindById = new Map(CASES.map((c) => [c.id, kindOf(c)]));
const kindOfResult = (r) => r.kind ?? kindById.get(r.id) ?? "regression";
// capability お題が 1 つも無い間は従来表示のまま
const hasCapability = CASES.some((c) => kindOf(c) === "capability") ||
  shown.some((run) => (run.results ?? []).some((r) => r.kind === "capability"));

console.log(`relay agent eval — 実行履歴（${shown.length}/${runs.length} 件${showAll ? "" : "。全件は --all"}）\n`);
console.log(col("実行日時", 18) + col("v", 9) + ids.map((i) => col(i, idW)).join("") + "計");
for (const run of shown) {
  const byId = new Map((run.results ?? []).map((r) => [r.id, r]));
  const cells = ids.map((i) => {
    const r = byId.get(i);
    return col(r ? STATUS_SYMBOL[classifyResult(r)] : "－", idW);
  });
  const date = (run.ranAt ?? run.file).slice(0, 16).replace("T", " ");
  const flag = run.skipJudge ? " *" : "";
  const rs = run.results ?? [];
  const statuses = rs.map(classifyResult);
  const errN = statuses.filter(isError).length;
  const passN = statuses.filter((s) => s === "pass").length;
  let tally = `${passN}/${statuses.length - errN}${errN ? ` !${errN}` : ""}`;
  if (hasCapability) {
    // R = regression（守り・100% 前提）/ C = capability（改善メーター）で分けて表示
    const part = (kind) => {
      const sub = rs.filter((r) => kindOfResult(r) === kind).map(classifyResult);
      const err = sub.filter(isError).length;
      return `${sub.filter((s) => s === "pass").length}/${sub.length - err}`;
    };
    tally = `R ${part("regression")} C ${part("capability")}${errN ? ` !${errN}` : ""}`;
  }
  console.log(col(date, 18) + col(run.dsVersion ?? "?", 9) + cells.join("") + `${tally}${flag}`);
}
console.log("\n凡例: ✓ PASS / ✗ FAIL（品質） / G 生成失敗（ハーネス） / J 審査不能（審査員の故障） / － 対象外の実行");
console.log("      G / J は品質シグナルではない。計は PASS/測定数（!n = 測定不能 n 件）。* は機械チェックのみ（--skip-judge）");
if (hasCapability) {
  console.log("      R = regression（守り・100% 維持が前提）/ C = capability（改善メーター・100% が前提ではない）");
}

// 直近 2 回のフル実行（全お題）の差分を要約
const full = shown.filter((r) => (r.results ?? []).length === CASES.length);
if (full.length >= 2) {
  const [prev, last] = full.slice(-2);
  const prevById = new Map(prev.results.map((r) => [r.id, r]));
  const changes = last.results.filter((r) => {
    const p = prevById.get(r.id);
    return p && classifyResult(p) !== classifyResult(r);
  });
  if (changes.length) {
    console.log("\n直近のフル実行間の変化:");
    for (const r of changes) {
      console.log(`  ${STATUS_SYMBOL[classifyResult(prevById.get(r.id))]}→${STATUS_SYMBOL[classifyResult(r)]} ${r.id}`);
    }
  }
}
