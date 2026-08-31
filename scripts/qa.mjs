#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  APP_VERSION,
  calculateAutonomy,
  calculateHypothesisScore,
  classifyLicense,
  composeHypotheses,
  createBuildBrief,
  createMarkdownReport,
  filterAssets,
  makeDryRunAssets,
  normalizeGithubItem,
  normalizeEgovItem,
  rankHypotheses,
} from "../src/pipeline.mjs";
import {
  analyzeReadme,
  enrichDeepCandidate,
  normalizeInventoryRepo,
} from "./full-inventory.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (relative) => readFileSync(join(ROOT, relative), "utf8");

function check(condition, message) {
  assert.equal(Boolean(condition), true, message);
}

function runSyntaxCheck(relative) {
  const result = spawnSync(process.execPath, ["--check", join(ROOT, relative)], { encoding: "utf8" });
  assert.equal(result.status, 0, `${relative} syntax error: ${result.stderr}`);
}

const pass = classifyLicense("mit");
assert.equal(pass.decision, "PASS");
assert.equal(classifyLicense("GPL-3.0").decision, "REVIEW");
assert.equal(classifyLicense(null).decision, "EXCLUDE");

const fixtureAssets = makeDryRunAssets();
assert.equal(fixtureAssets.length, 10);
check(fixtureAssets.every((asset) => asset.licenseDecision === "PASS"), "dry fixtures must be commercial-license pass assets");
check(fixtureAssets.every((asset) => asset.assetScore > 0), "asset score must be computed");

const sample = normalizeGithubItem({
  full_name: "qa/sample",
  html_url: "https://github.com/qa/sample",
  description: "A local RSS parser",
  stargazers_count: 100,
  forks_count: 10,
  updated_at: new Date().toISOString(),
  pushed_at: new Date().toISOString(),
  license: { spdx_id: "Apache-2.0" },
}, { q: "rss", category: "monitoring" });
assert.equal(sample.licenseDecision, "PASS");
assert.equal(sample.category, "monitoring");
assert.equal(sample.source, "GitHub");

const egov = normalizeEgovItem({
  name: "sample-dataset",
  title: "サンプル公開データ",
  notes: "公開データのテスト",
  metadata_modified: new Date().toISOString(),
  organization: { title: "テスト省" },
  resources: [{ format: "CSV" }],
}, { q: "統計", category: "data" });
assert.equal(egov.source, "e-Gov Data Catalog");
assert.equal(egov.licenseDecision, "REVIEW");
assert.equal(egov.licenseLabel, "LICENSE_REVIEW_REQUIRED");

const inventoryRepo = normalizeInventoryRepo({
  id: 91,
  full_name: "qa/inventory-repo",
  name: "inventory-repo",
  html_url: "https://github.com/qa/inventory-repo",
  description: "Local RSS monitor with an MIT license",
  stargazers_count: 1200,
  forks_count: 120,
  updated_at: new Date().toISOString(),
  pushed_at: new Date().toISOString(),
  license: { spdx_id: "MIT" },
  topics: ["rss", "monitoring", "local"],
});
assert.equal(inventoryRepo.licenseDecision, "PASS");
assert.equal(inventoryRepo.primaryDecision, "DEEP_CANDIDATE");
check(inventoryRepo.primaryScore > 0, "inventory primary score must be computed");
check(analyzeReadme("## Installation\nRun locally offline.").hasInstallation, "README installation signal must be detected");
const deepInventoryRepo = enrichDeepCandidate(inventoryRepo, {
  ...inventoryRepo,
  id: 91,
  full_name: inventoryRepo.fullName,
  html_url: inventoryRepo.url,
  license: { spdx_id: "MIT" },
}, { readme: "## Installation\nRun locally offline.", contributors: 2 });
assert.equal(deepInventoryRepo.deepInspected, true);
assert.equal(deepInventoryRepo.deepDecision, "KEEP");

const reviewAsset = { ...fixtureAssets[0], id: "review", url: "https://example.invalid/review", canonicalUrl: "https://example.invalid/review", license: "GPL-3.0", licenseLabel: "GPL-3.0", licenseDecision: "REVIEW" };
const excludedAsset = { ...fixtureAssets[1], id: "excluded", url: "https://example.invalid/excluded", canonicalUrl: "https://example.invalid/excluded", license: null, licenseLabel: "NO_LICENSE", licenseDecision: "EXCLUDE" };
const archivedAsset = { ...fixtureAssets[2], id: "archived", url: "https://example.invalid/archived", canonicalUrl: "https://example.invalid/archived", archived: true };
const filtered = filterAssets([...fixtureAssets, reviewAsset, excludedAsset, archivedAsset]);
assert.equal(filtered.accepted.length, 10);
assert.equal(filtered.review.length, 1);
assert.equal(filtered.excluded.length, 2);

const hypotheses = composeHypotheses(fixtureAssets, 20);
assert.equal(hypotheses.length, 20);
check(hypotheses.every((item) => item.assets.length >= 1), "every hypothesis needs an asset");
check(hypotheses.every((item) => item.autonomyPercent >= 0 && item.autonomyPercent <= 100), "autonomy must be a percentage");
const baseline = hypotheses[0];
const baselineScore = calculateHypothesisScore(baseline, []);
const paidScore = calculateHypothesisScore(baseline, [{ type: "payment", url: "https://example.com/proof", note: "paid listing" }]);
assert.equal(baselineScore.scoreBreakdown.demand, 0);
assert.equal(paidScore.scoreBreakdown.demand, 20);
check(paidScore.score > baselineScore.score, "payment evidence must improve score");
assert.equal(calculateAutonomy(baseline.autonomySteps), baseline.autonomyPercent);

const ranked = rankHypotheses(hypotheses, { [baseline.id]: [{ type: "payment", note: "proof" }] });
assert.equal(ranked[0].rank, 1);
check(ranked.some((item) => item.id === baseline.id && item.demandEvidenceCount === 1), "evidence must be attached during ranking");
check(createBuildBrief(ranked[0]).includes("## 受け入れ条件"), "build brief must contain acceptance criteria");
check(createMarkdownReport({ assets: fixtureAssets, hypotheses, stats: filtered.counts, evidenceByHypothesis: {} }).includes("TOP3"), "report must contain top three");

for (const file of ["app.js", "src/pipeline.mjs", "scripts/scout.mjs", "scripts/full-inventory.mjs", "scripts/qa.mjs"]) runSyntaxCheck(file);
const html = read("index.html");
for (const id of ["runButton", "loadSnapshotButton", "loadInventoryButton", "inventoryHighlights", "assetList", "hypothesisList", "buildPanel", "evidenceDialog"]) check(html.includes(`id="${id}"`), `missing DOM id: ${id}`);
check(!read(".github/workflows/scout.yml").includes("schedule:"), "scout workflow must remain manual only");
const inventoryWorkflow = read(".github/workflows/full-inventory.yml");
check(inventoryWorkflow.includes("workflow_dispatch:"), "full inventory workflow must be manual only");
check(!inventoryWorkflow.includes("schedule:"), "full inventory workflow must not have a schedule");
check(html.includes("name=\"viewport\""), "mobile viewport metadata is required");
check(read("styles.css").includes("@media (max-width: 700px)"), "mobile CSS breakpoint is required");
check(!html.includes("onclick="), "inline event handlers should not be used");
const allSource = ["index.html", "styles.css", "app.js", "src/pipeline.mjs", "scripts/scout.mjs", "scripts/full-inventory.mjs", "README.md", ".github/workflows/full-inventory.yml"].map(read).join("\n");
check(!/(sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/.test(allSource), "possible secret found in source");

const tempDir = mkdtempSync(join(tmpdir(), "avb-qa-"));
try {
  const output = join(tempDir, "snapshot.json");
  execFileSync(process.execPath, [join(ROOT, "scripts/scout.mjs"), "--dry-run", "--out", output], { encoding: "utf8" });
  const snapshot = JSON.parse(readFileSync(output, "utf8"));
  assert.equal(snapshot.schemaVersion, APP_VERSION);
  assert.equal(snapshot.mode, "dry-run");
  assert.equal(snapshot.uniqueAssets, 10);
  assert.equal(snapshot.filterCounts.accepted, 10);

  const inventoryStatePath = join(tempDir, "inventory-state.json");
  const inventoryShardDir = join(tempDir, "inventory-shards");
  const inventoryHighlightsPath = join(tempDir, "interesting.json");
  execFileSync(process.execPath, [join(ROOT, "scripts/full-inventory.mjs"), "--dry-run", "--state", inventoryStatePath, "--shard-dir", inventoryShardDir, "--interesting", inventoryHighlightsPath, "--batch-size", "3", "--deep-limit", "2"], { encoding: "utf8" });
  const inventorySnapshot = JSON.parse(readFileSync(inventoryStatePath, "utf8"));
  const inventoryHighlights = JSON.parse(readFileSync(inventoryHighlightsPath, "utf8"));
  assert.equal(inventorySnapshot.status, "dry-run");
  assert.equal(inventorySnapshot.coverage.cataloged, 3);
  assert.equal(inventorySnapshot.coverage.primaryScanned, 3);
  assert.equal(inventorySnapshot.coverage.deepScanned, 2);
  assert.equal(inventorySnapshot.coverage.deepPending, 1);
  assert.equal(inventoryHighlights.candidates.length, 2);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log("QA PASS: pipeline, static contract, secret scan, and dry-run scout");
