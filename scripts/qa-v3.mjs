import assert from "node:assert/strict";
import {
  VERSION,
  evaluatePainGate,
  generateAssetSearchQueries,
  licenseDecision,
  normalizeGithubAsset,
  evaluateBuildGate,
  makeBuildBrief,
} from "../src/paid-pain-engine.mjs";

assert.equal(VERSION, "0.4.0");

const weakPain = {
  customer: "EC運営者",
  problem: "商品CSVの登録前エラー確認に時間がかかる",
  offer: "CSVプレフライト",
  price: 2980,
  channel: "ココナラ",
  firstCustomerRoute: "該当案件へ応募",
  killCriteria: "20応募で返信0なら停止",
  autonomyPercent: 80,
  zeroCost: true,
  oneDayMvp: true,
  evidence: [{ type: "job", note: "予算付き案件" }],
};
assert.equal(evaluatePainGate(weakPain).passed, false, "支払証拠不足ではGateを通さない");

const strongPain = {
  ...weakPain,
  evidence: [
    { type: "contract", note: "契約済み案件", amount: 10000 },
    { type: "job", note: "予算付き案件A", amount: 5000 },
    { type: "complaint", note: "具体的な困りごと" },
  ],
};
assert.equal(evaluatePainGate(strongPain).passed, true, "実支払1件＋合計3証拠ならGate通過");

const queries = generateAssetSearchQueries(strongPain);
assert.ok(queries.length > 0, "悩みからGitHub検索語を作る");
assert.ok(queries.some((q) => /csv|excel|spreadsheet/i.test(q)), "CSV系の検索語が含まれる");

assert.equal(licenseDecision("MIT"), "PASS");
assert.equal(licenseDecision("Apache-2.0"), "PASS");
assert.notEqual(licenseDecision("AGPL-3.0"), "PASS");
assert.equal(licenseDecision(null), "EXCLUDE");

const asset = normalizeGithubAsset({
  id: 1,
  full_name: "example/csv-validator",
  description: "CSV validation tool",
  html_url: "https://github.com/example/csv-validator",
  stargazers_count: 500,
  forks_count: 20,
  language: "JavaScript",
  archived: false,
  fork: false,
  pushed_at: new Date().toISOString(),
  license: { spdx_id: "MIT" },
}, "csv validator");
assert.equal(asset.licenseDecision, "PASS");

const noAssetGate = evaluateBuildGate({ pain: strongPain, selectedAssets: [] });
assert.equal(noAssetGate.buildAllowed, false, "資産未選択ではBuild禁止");

const passGate = evaluateBuildGate({ pain: strongPain, selectedAssets: [asset] });
assert.equal(passGate.buildAllowed, true, "需要Gate＋PASS資産でBuild許可");

const brief = makeBuildBrief({ pain: strongPain, selectedAssets: [asset] });
assert.match(brief, /Demand-first Build Brief/);
assert.match(brief, /EC運営者/);
assert.match(brief, /example\/csv-validator/);

console.log("AI VENTURE BUILDER demand-first QA: PASS");
