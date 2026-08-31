#!/usr/bin/env node

import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  APP_VERSION,
  calculateAssetScore,
  classifyLicense,
  inferCategory,
  normalizeGithubItem,
} from "../src/pipeline.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INVENTORY_SCHEMA = "1.0.0";
const INVENTORY_ENDPOINT = "https://api.github.com/repositories";
const INVENTORY_OFFICIAL_URL = "https://docs.github.com/en/rest/repos/repos#list-public-repositories";
const DEFAULTS = {
  batchSize: 100,
  deepLimit: 8,
  state: "data/inventory-state.json",
  shardDir: "data/inventory/shards",
  interesting: "data/inventory/interesting.json",
};

const INTEREST_PATTERNS = [
  ["document", /ocr|pdf|document|word|excel|office|invoice|receipt|table extraction/],
  ["data", /csv|json|dataset|open data|statistics|etl|data quality|data cleaning/],
  ["monitoring", /rss|feed|monitor|alert|watch|change detection|diff/],
  ["parsing", /parser|parse|scrap|extract|crawler|html|markdown/],
  ["automation", /browser|workflow|automat|robot|task runner|rpa/],
  ["ai", /speech|transcri|translation|embedding|llm|machine learning|deep learning|vision|nlp/],
  ["search", /search|index|retriev|vector|knowledge base/],
  ["compliance", /license|compliance|audit|accessib|security|policy/],
];

const COST_PATTERNS = {
  api: /api[ -]?(key|token)|oauth|credential|secret|paid api|commercial api|credits? required|requires? (?:an? )?api/,
  gpu: /requires? gpu|cuda|gpu accelerated|large model|vram/,
  cloud: /aws|gcp|azure|cloud-only|kubernetes|vps|server required|managed service/,
  local: /local|offline|self-hosted|standalone|cli|static|on-premise/,
};

function text(value) {
  return value == null ? "" : String(value);
}

function lower(value) {
  return text(value).toLowerCase();
}

function now() {
  return new Date().toISOString();
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function argValue(args, name, fallback = null) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function resolveOption(value) {
  return resolve(ROOT, value || "");
}

function dateAgeDays(value) {
  if (!value) return 9999;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return 9999;
  return Math.max(0, (Date.now() - time) / 86400000);
}

function jsonLicense(item) {
  const license = item?.license;
  if (typeof license === "string" && license.trim()) return license.trim();
  return license?.spdx_id || license?.key || license?.name || item?.license_spdx_id || null;
}

function licenseForCatalog(item) {
  const raw = jsonLicense(item);
  if (raw) return classifyLicense(raw);
  return {
    decision: "REVIEW",
    label: "LICENSE_REVIEW_REQUIRED",
    commercialUsability: "unknown",
    reason: "一覧APIだけではライセンスを確認できないため深掘り対象",
  };
}

function interestMatches(record) {
  const haystack = lower([
    record.fullName,
    record.name,
    record.description,
    ...(record.topics || []),
    record.language,
  ].join(" "));
  return INTEREST_PATTERNS.filter(([, pattern]) => pattern.test(haystack)).map(([category]) => category);
}

function requirementSignals(record) {
  const haystack = lower([
    record.fullName,
    record.name,
    record.description,
    ...(record.topics || []),
  ].join(" "));
  const signals = {
    apiRequired: COST_PATTERNS.api.test(haystack),
    gpuRequired: COST_PATTERNS.gpu.test(haystack),
    cloudRequired: COST_PATTERNS.cloud.test(haystack),
    localHint: COST_PATTERNS.local.test(haystack),
  };
  let freeScore = 15;
  if (signals.apiRequired) freeScore -= 5;
  if (signals.gpuRequired) freeScore -= 6;
  if (signals.cloudRequired) freeScore -= 5;
  if (signals.localHint) freeScore += 2;
  return { ...signals, freeScore: Math.max(0, Math.min(20, freeScore)) };
}

function candidateReasons(record, matches = interestMatches(record)) {
  const reasons = [];
  if (matches.length) reasons.push(`${matches.slice(0, 3).join(" / ")}用途に接続しやすい`);
  if (record.stars >= 1000) reasons.push("利用者・関心のシグナルがある");
  if (record.description) reasons.push("用途説明を確認できる");
  if (dateAgeDays(record.pushedAt) < 365) reasons.push("最近も更新されている");
  if (record.licenseDecision === "PASS") reasons.push("一覧時点で明確なライセンス候補");
  if (!reasons.length) reasons.push("公開資産としてカタログ化し、後続の深掘りで判定");
  return reasons;
}

function buildDirections(record) {
  const category = lower(`${record.category} ${record.description} ${record.name}`);
  if (/document|ocr|pdf|word|excel/.test(category)) return ["公開文書の項目抽出レポート", "納品前の文書品質チェック"];
  if (/data|csv|json|dataset|statistics/.test(category)) return ["公開データの比較・差分便", "CSV取込前の品質プレフライト"];
  if (/monitor|rss|feed|alert|watch/.test(category)) return ["業界別の変更アラート", "制度・募集の締切ウォッチ"];
  if (/parser|parse|scrap|extract|crawler|html/.test(category)) return ["公開情報の業務別一覧", "求人・価格・制度の差分抽出"];
  if (/automat|workflow|browser|robot|task/.test(category)) return ["小規模事業者向け自動化診断", "定型作業の無料ワークフロー化"];
  if (/speech|transcri|translation|embedding|llm|vision|nlp|ai/.test(category)) return ["AI納品物の品質チェック", "日本語データの分類・要約パック"];
  if (/search|index|retriev|knowledge/.test(category)) return ["社内・公開情報の検索パック", "調査結果の根拠付きブリーフ"];
  if (/license|compliance|audit|accessib|security/.test(category)) return ["OSS商用利用前レポート", "公開サイトの一次監査"];
  return ["公開情報の実務ブリーフ", "特定業務の確認・整理ツール"];
}

export function normalizeInventoryRepo(item, fetchedAt = now()) {
  const fullName = item?.full_name || item?.name || `repository-${item?.id || "unknown"}`;
  const description = text(item?.description).trim();
  const category = inferCategory("other", [fullName, description, ...(item?.topics || [])].join(" "));
  const license = licenseForCatalog(item);
  const record = {
    inventoryId: `github:${item?.id || fullName}`,
    repositoryId: Number(item?.id || 0),
    fullName,
    name: item?.name || fullName.split("/").pop() || fullName,
    url: item?.html_url || `https://github.com/${fullName}`,
    description,
    category,
    topics: Array.isArray(item?.topics) ? item.topics : [],
    language: item?.language || null,
    stars: Number(item?.stargazers_count || 0),
    forks: Number(item?.forks_count || 0),
    openIssues: Number(item?.open_issues_count || 0),
    size: Number(item?.size || 0),
    createdAt: item?.created_at || null,
    updatedAt: item?.updated_at || null,
    pushedAt: item?.pushed_at || null,
    defaultBranch: item?.default_branch || null,
    archived: Boolean(item?.archived),
    fork: Boolean(item?.fork),
    hasIssues: Boolean(item?.has_issues),
    hasWiki: Boolean(item?.has_wiki),
    license: jsonLicense(item),
    licenseDecision: license.decision,
    licenseLabel: license.label,
    commercialUsability: license.commercialUsability,
    licenseReason: license.reason,
    licenseStage: jsonLicense(item) ? "catalog-hint" : "not-inspected",
    contributors: 0,
    releaseFrequency: "UNKNOWN",
    starsGrowth: null,
    fetchedAt,
    deepInspected: false,
    deepInspectedAt: null,
    deepScore: null,
    primaryDecision: "PENDING",
    primaryScore: 0,
    primaryReasons: [],
    buildDirections: [],
    requirements: {},
  };
  const requirements = requirementSignals(record);
  record.requirements = requirements;
  record.primaryReasons = candidateReasons(record);
  record.buildDirections = buildDirections(record);
  record.primaryScore = scorePrimary(record);
  record.primaryDecision = primaryDecision(record);
  return record;
}

export function scorePrimary(record) {
  if (record.archived) return 0;
  const matches = interestMatches(record);
  const freshness = dateAgeDays(record.pushedAt) < 180 ? 18 : dateAgeDays(record.pushedAt) < 365 ? 14 : dateAgeDays(record.pushedAt) < 900 ? 8 : 2;
  const traction = Math.min(24, Math.log10(1 + Math.max(record.stars, record.forks * 3)) * 5);
  const topicSignal = Math.min(8, (record.topics || []).length * 2);
  const descriptionSignal = record.description ? 6 : 0;
  const useSignal = Math.min(18, matches.length * 6);
  const licenseSignal = record.licenseDecision === "PASS" ? 10 : record.licenseDecision === "REVIEW" ? 4 : 0;
  const localSignal = record.requirements?.localHint ? 5 : 0;
  const costPenalty = (record.requirements?.apiRequired ? 4 : 0)
    + (record.requirements?.gpuRequired ? 6 : 0)
    + (record.requirements?.cloudRequired ? 5 : 0)
    + (record.fork ? 8 : 0);
  return Math.max(0, Math.min(100, Math.round((freshness + traction + topicSignal + descriptionSignal + useSignal + licenseSignal + localSignal - costPenalty) * 10) / 10));
}

export function primaryDecision(record) {
  if (record.archived) return "EXCLUDE_ARCHIVED";
  if (record.fork && record.stars < 100) return "CATALOG_ONLY_FORK";
  if (!record.description && record.stars < 50) return "CATALOG_ONLY_LOW_SIGNAL";
  return record.primaryScore >= 32 ? "DEEP_CANDIDATE" : "CATALOG_ONLY";
}

function decodeReadme(body) {
  if (!body) return "";
  if (typeof body.content === "string") {
    try {
      return Buffer.from(body.content.replace(/\n/g, ""), body.encoding === "base64" ? "base64" : "utf8").toString("utf8");
    } catch {
      return "";
    }
  }
  return text(body);
}

export function analyzeReadme(readmeText = "") {
  const value = lower(readmeText);
  const signals = [];
  if (/install|installation|getting started|quick start/.test(value)) signals.push("installation");
  if (/docker|docker compose/.test(value)) signals.push("docker");
  if (/api key|api token|oauth|credential|secret/.test(value)) signals.push("credential");
  if (/cuda|gpu|nvidia|vram/.test(value)) signals.push("gpu");
  if (/aws|gcp|azure|kubernetes|vps/.test(value)) signals.push("cloud");
  if (/local|offline|self-hosted|standalone/.test(value)) signals.push("local");
  return {
    found: Boolean(readmeText),
    length: readmeText.length,
    signals,
    hasInstallation: signals.includes("installation"),
    apiRequired: signals.includes("credential"),
    gpuRequired: signals.includes("gpu"),
    cloudRequired: signals.includes("cloud"),
    localHint: signals.includes("local"),
  };
}

export function summarizeReleases(releases = []) {
  const dates = releases
    .map((release) => Date.parse(release?.published_at || release?.created_at || ""))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);
  if (dates.length < 2) return dates.length === 1 ? "RECENT_RELEASE" : "NO_RELEASE_DATA";
  const intervals = [];
  for (let index = 1; index < dates.length; index += 1) intervals.push((dates[index - 1] - dates[index]) / 86400000);
  const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (average <= 45) return "FREQUENT";
  if (average <= 180) return "REGULAR";
  return "OCCASIONAL";
}

function parseContributorCount(response, body) {
  const link = response?.headers?.get("link") || "";
  const match = link.match(/[?&]page=(\d+)>; rel="last"/);
  if (match) return Number(match[1]);
  return Array.isArray(body) ? body.length : 0;
}

export function enrichDeepCandidate(base, detail, { readme = "", releases = [], contributors = 0, fetchedAt = now() } = {}) {
  const normalized = normalizeGithubItem(detail || {}, { q: "FULL INVENTORY / DEEP SCOUT", category: base.category }, fetchedAt);
  const readmeSignals = analyzeReadme(readme);
  const requirements = {
    ...(base.requirements || {}),
    apiRequired: Boolean(base.requirements?.apiRequired || readmeSignals.apiRequired || normalized.apiRequired),
    gpuRequired: Boolean(base.requirements?.gpuRequired || readmeSignals.gpuRequired || normalized.gpuRequired),
    cloudRequired: Boolean(base.requirements?.cloudRequired || readmeSignals.cloudRequired || normalized.cloudRequired),
    localHint: Boolean(base.requirements?.localHint || readmeSignals.localHint || normalized.localHint),
  };
  let freeScore = 15;
  if (requirements.apiRequired) freeScore -= 5;
  if (requirements.gpuRequired) freeScore -= 6;
  if (requirements.cloudRequired) freeScore -= 5;
  if (requirements.localHint) freeScore += 2;
  const deep = {
    ...base,
    ...normalized,
    inventoryId: base.inventoryId,
    repositoryId: base.repositoryId || Number(detail?.id || 0),
    fullName: detail?.full_name || base.fullName,
    primaryScore: base.primaryScore,
    primaryDecision: base.primaryDecision,
    primaryReasons: base.primaryReasons,
    buildDirections: base.buildDirections,
    licenseStage: "deep",
    deepInspected: true,
    deepInspectedAt: fetchedAt,
    contributors: Number(contributors || 0),
    releaseFrequency: summarizeReleases(releases),
    readmeSignals,
    requirements,
    apiRequired: requirements.apiRequired,
    gpuRequired: requirements.gpuRequired,
    cloudRequired: requirements.cloudRequired,
    localHint: requirements.localHint,
    freeScore: Math.max(0, Math.min(20, freeScore)),
    externalApiRequirements: requirements.apiRequired ? "READMEまたはメタデータにAPI/OAuth要件あり" : normalized.externalApiRequirements,
    hostingRequirements: requirements.cloudRequired ? "クラウド/VPS要件の可能性あり" : normalized.hostingRequirements,
    deepScore: 0,
  };
  deep.assetScore = calculateAssetScore(deep);
  const deepBonus = deep.licenseDecision === "PASS" ? 22 : deep.licenseDecision === "REVIEW" ? 6 : 0;
  const documentationBonus = readmeSignals.hasInstallation ? 8 : 0;
  const maintenanceBonus = ["FREQUENT", "REGULAR", "RECENT_RELEASE"].includes(deep.releaseFrequency) ? 5 : 0;
  const costPenalty = (requirements.apiRequired ? 5 : 0) + (requirements.gpuRequired ? 7 : 0) + (requirements.cloudRequired ? 5 : 0);
  deep.deepScore = Math.max(0, Math.min(100, Math.round((deep.primaryScore * 0.55 + deep.assetScore * 0.25 + deepBonus + documentationBonus + maintenanceBonus - costPenalty) * 10) / 10));
  deep.deepDecision = deep.licenseDecision === "EXCLUDE"
    ? "EXCLUDE"
    : deep.licenseDecision === "REVIEW"
      ? "LICENSE_REVIEW_REQUIRED"
      : deep.deepScore >= 42 && deep.freeScore >= 4
        ? "KEEP"
        : "LOW_FREE_SCORE";
  deep.primaryReasons = [...new Set([
    ...base.primaryReasons,
    ...(readmeSignals.hasInstallation ? ["READMEに導入手順がある"] : []),
    ...(deep.licenseDecision === "PASS" ? ["深掘りで商用利用候補を確認"] : ["ライセンスを個別確認する必要あり"]),
  ])];
  return deep;
}

export function createInventoryState(existing = {}) {
  const coverage = existing.coverage || {};
  const cursor = existing.cursor || {};
  return {
    schemaVersion: INVENTORY_SCHEMA,
    appVersion: APP_VERSION,
    source: "GitHub public repositories",
    sourceUrl: INVENTORY_ENDPOINT,
    officialUrl: INVENTORY_OFFICIAL_URL,
    mode: "manual-workflow",
    status: existing.status || "not-run",
    cursor: {
      since: Number(cursor.since || 0),
      lastId: Number(cursor.lastId || cursor.since || 0),
      exhaustedAt: cursor.exhaustedAt || null,
    },
    coverage: {
      batches: Number(coverage.batches || 0),
      cataloged: Number(coverage.cataloged || 0),
      primaryScanned: Number(coverage.primaryScanned || 0),
      deepScanned: Number(coverage.deepScanned || 0),
      deepPending: Number(coverage.deepPending || 0),
      deepFailed: Number(coverage.deepFailed || 0),
      licensePass: Number(coverage.licensePass || 0),
      licenseReview: Number(coverage.licenseReview || 0),
      licenseExclude: Number(coverage.licenseExclude || 0),
    },
    lastRun: existing.lastRun || null,
    diagnostics: Array.isArray(existing.diagnostics) ? existing.diagnostics.slice(-80) : [],
    deepQueue: Array.isArray(existing.deepQueue) ? existing.deepQueue : [],
    failedDeep: Array.isArray(existing.failedDeep) ? existing.failedDeep.slice(-100) : [],
    topCandidates: Array.isArray(existing.topCandidates) ? existing.topCandidates.slice(0, 60) : [],
    lastShard: existing.lastShard || null,
  };
}

function mergeQueue(queue, candidates) {
  const byId = new Map(queue.map((item) => [item.inventoryId, item]));
  for (const candidate of candidates) {
    if (!byId.has(candidate.inventoryId)) byId.set(candidate.inventoryId, { ...candidate, attempts: 0, queuedAt: now() });
  }
  return [...byId.values()].sort((a, b) => b.primaryScore - a.primaryScore);
}

function mergeInteresting(previous, deepRecords) {
  const byId = new Map((previous || []).map((item) => [item.inventoryId, item]));
  for (const record of deepRecords) {
    if (record.deepDecision === "EXCLUDE") byId.delete(record.inventoryId);
    else byId.set(record.inventoryId, record);
  }
  return [...byId.values()]
    .sort((a, b) => (b.deepScore ?? b.primaryScore ?? 0) - (a.deepScore ?? a.primaryScore ?? 0))
    .slice(0, 60);
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function githubHeaders() {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "ai-venture-builder-full-inventory/0.3",
  };
  const token = process.env.SCOUT_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

function isRateLimitedError(error) {
  return Boolean(error?.rateLimited) || /HTTP_(403|429)|rate limit|secondary rate/i.test(error?.message || "");
}

async function fetchJson(url, headers = githubHeaders()) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    const bodyText = await response.text();
    let body = null;
    try {
      body = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      const error = new Error(`JSON_PARSE_FAILED status=${response.status}`);
      error.rateLimited = response.status === 403 || response.status === 429;
      throw error;
    }
    if (!response.ok) {
      const error = new Error(`HTTP_${response.status}: ${body?.message || body?.error || "GitHub API error"}`);
      error.rateLimited = response.status === 403 || response.status === 429 || /rate limit/i.test(body?.message || "");
      throw error;
    }
    return { body, headers: response.headers };
  } finally {
    clearTimeout(timeout);
  }
}

function inventoryFixtureBatch() {
  const stamp = new Date().toISOString();
  return [
    {
      id: 1001,
      full_name: "fixture/local-document-kit",
      name: "local-document-kit",
      html_url: "https://example.invalid/fixture/local-document-kit",
      description: "Local OCR and PDF document parser for offline workflows",
      stargazers_count: 4200,
      forks_count: 420,
      updated_at: stamp,
      pushed_at: stamp,
      created_at: stamp,
      license: { spdx_id: "MIT" },
      language: "JavaScript",
      topics: ["ocr", "pdf", "local"],
    },
    {
      id: 1002,
      full_name: "fixture/rss-change-watch",
      name: "rss-change-watch",
      html_url: "https://example.invalid/fixture/rss-change-watch",
      description: "RSS feed change detector and monitoring tool",
      stargazers_count: 1800,
      forks_count: 180,
      updated_at: stamp,
      pushed_at: stamp,
      created_at: stamp,
      license: { spdx_id: "Apache-2.0" },
      language: "Python",
      topics: ["rss", "monitoring"],
    },
    {
      id: 1003,
      full_name: "fixture/unclear-license-tool",
      name: "unclear-license-tool",
      html_url: "https://example.invalid/fixture/unclear-license-tool",
      description: "Public data cleaning utility with an unclear license",
      stargazers_count: 900,
      forks_count: 90,
      updated_at: stamp,
      pushed_at: stamp,
      created_at: stamp,
      language: "Go",
      topics: ["csv", "data"],
    },
  ];
}

async function fetchCatalogBatch(state, options) {
  if (options.dryRun) {
    const items = inventoryFixtureBatch().filter((item) => item.id > state.cursor.since);
    return { items, remaining: 999, dryRun: true };
  }
  const url = new URL(INVENTORY_ENDPOINT);
  url.searchParams.set("per_page", String(options.batchSize));
  if (state.cursor.since > 0) url.searchParams.set("since", String(state.cursor.since));
  const result = await fetchJson(url);
  return {
    items: Array.isArray(result.body) ? result.body : [],
    remaining: Number(result.headers.get("x-ratelimit-remaining")),
    dryRun: false,
  };
}

async function fetchDeepCandidate(candidate, options) {
  if (options.dryRun) {
    const detail = {
      id: candidate.repositoryId,
      full_name: candidate.fullName,
      name: candidate.name,
      html_url: candidate.url,
      description: candidate.description,
      stargazers_count: candidate.stars,
      forks_count: candidate.forks,
      updated_at: candidate.updatedAt,
      pushed_at: candidate.pushedAt,
      license: candidate.fullName.includes("unclear") ? undefined : { spdx_id: candidate.licenseLabel },
      language: candidate.language,
      topics: candidate.topics,
    };
    return enrichDeepCandidate(candidate, detail, {
      readme: `# ${candidate.name}\n\n## Installation\nRun locally offline.`,
      releases: [{ published_at: now() }, { published_at: new Date(Date.now() - 30 * 86400000).toISOString() }],
      contributors: 3,
    });
  }
  const baseUrl = `https://api.github.com/repos/${candidate.fullName}`;
  const detailResult = await fetchJson(baseUrl);
  const detail = detailResult.body;
  let readme = "";
  let releases = [];
  let contributors = 0;
  try {
    const result = await fetchJson(`${baseUrl}/readme`, { ...githubHeaders(), accept: "application/vnd.github+json" });
    readme = decodeReadme(result.body);
  } catch (error) {
    if (isRateLimitedError(error)) throw error;
  }
  try {
    const result = await fetchJson(`${baseUrl}/releases?per_page=5`, githubHeaders());
    releases = Array.isArray(result.body) ? result.body : [];
  } catch (error) {
    if (isRateLimitedError(error)) throw error;
  }
  try {
    const result = await fetchJson(`${baseUrl}/contributors?per_page=1&anon=true`, githubHeaders());
    contributors = parseContributorCount(result.headers, result.body);
  } catch (error) {
    if (isRateLimitedError(error)) throw error;
  }
  return enrichDeepCandidate(candidate, detail, { readme, releases, contributors });
}

async function run(options) {
  const startedAt = now();
  const existing = options.reset ? {} : await readJson(options.statePath, {});
  const state = createInventoryState(existing);
  state.status = "running";
  state.lastRun = { startedAt, finishedAt: null, batchSize: options.batchSize, deepLimit: options.deepLimit, dryRun: options.dryRun };
  const diagnostics = [];
  const deepRecords = [];
  let catalog = [];
  let rateLimited = false;
  let fatalError = null;

  try {
    const result = await fetchCatalogBatch(state, options);
    // GitHub normally honors per_page, but keep the local cap as a safety
    // boundary because intermediaries or endpoint changes may return more.
    catalog = result.items.slice(0, options.batchSize).map((item) => normalizeInventoryRepo(item));
    if (result.remaining !== null && Number.isFinite(result.remaining)) {
      diagnostics.push({ at: now(), stage: "catalog", status: "ok", count: catalog.length, rateLimitRemaining: result.remaining });
    } else {
      diagnostics.push({ at: now(), stage: "catalog", status: "ok", count: catalog.length });
    }
    if (catalog.length) {
      const firstId = catalog[0].repositoryId;
      const lastId = catalog[catalog.length - 1].repositoryId;
      if (lastId <= state.cursor.since) throw new Error(`CURSOR_DID_NOT_ADVANCE since=${state.cursor.since} lastId=${lastId}`);
      const shardName = `catalog-${firstId || "unknown"}-${lastId || "unknown"}.json`;
      await writeJson(join(options.shardDir, shardName), {
        schemaVersion: INVENTORY_SCHEMA,
        fetchedAt: now(),
        source: INVENTORY_ENDPOINT,
        since: state.cursor.since,
        firstId,
        lastId,
        records: catalog,
      });
      state.lastShard = `data/inventory/shards/${shardName}`;
      state.cursor.since = lastId > state.cursor.since ? lastId : state.cursor.since;
      state.cursor.lastId = state.cursor.since;
      state.cursor.exhaustedAt = null;
      state.coverage.batches += 1;
      state.coverage.cataloged += catalog.length;
      state.coverage.primaryScanned += catalog.length;
      const candidates = catalog
        .filter((record) => record.primaryDecision === "DEEP_CANDIDATE")
        .sort((a, b) => b.primaryScore - a.primaryScore)
        .slice(0, Math.max(12, options.deepLimit * 3));
      state.deepQueue = mergeQueue(state.deepQueue, candidates);
      diagnostics.push({ at: now(), stage: "primary", status: "ok", count: catalog.length, deepCandidatesQueued: candidates.length });
    } else {
      state.cursor.exhaustedAt = now();
      diagnostics.push({ at: now(), stage: "catalog", status: "exhausted", since: state.cursor.since });
    }
  } catch (error) {
    rateLimited = isRateLimitedError(error);
    fatalError = error;
    diagnostics.push({ at: now(), stage: "catalog", status: rateLimited ? "rate-limited" : "error", error: error.message });
  }

  if (!fatalError || !rateLimited) {
    let attempts = 0;
    while (state.deepQueue.length && attempts < options.deepLimit) {
      const candidate = state.deepQueue.shift();
      attempts += 1;
      try {
        const deep = await fetchDeepCandidate(candidate, options);
        deepRecords.push(deep);
        state.coverage.deepScanned += 1;
        if (deep.licenseDecision === "PASS") state.coverage.licensePass += 1;
        else if (deep.licenseDecision === "REVIEW") state.coverage.licenseReview += 1;
        else state.coverage.licenseExclude += 1;
        diagnostics.push({ at: now(), stage: "deep", status: "ok", repository: candidate.fullName, deepDecision: deep.deepDecision });
      } catch (error) {
        if (isRateLimitedError(error)) {
          state.deepQueue.unshift({ ...candidate, attempts: Number(candidate.attempts || 0) + 1 });
          rateLimited = true;
          diagnostics.push({ at: now(), stage: "deep", status: "rate-limited", repository: candidate.fullName, error: error.message });
          break;
        }
        const attemptsForCandidate = Number(candidate.attempts || 0) + 1;
        if (attemptsForCandidate >= 3) {
          state.failedDeep.push({ ...candidate, attempts: attemptsForCandidate, error: error.message, failedAt: now() });
          state.coverage.deepFailed += 1;
        } else {
          state.deepQueue.push({ ...candidate, attempts: attemptsForCandidate, lastError: error.message });
        }
        diagnostics.push({ at: now(), stage: "deep", status: "error", repository: candidate.fullName, error: error.message, attempts: attemptsForCandidate });
      }
    }
  }

  const previousInteresting = (await readJson(options.interestingPath, {}))?.candidates || [];
  state.topCandidates = mergeInteresting(previousInteresting, deepRecords);
  state.coverage.deepPending = state.deepQueue.length;
  state.diagnostics = [...state.diagnostics, ...diagnostics].slice(-80);
  state.lastRun.finishedAt = now();
  state.lastRun.catalogedThisRun = catalog.length;
  state.lastRun.deepScannedThisRun = deepRecords.length;
  state.lastRun.rateLimitPaused = rateLimited;
  state.status = rateLimited ? "paused-rate-limit" : fatalError ? "error" : state.cursor.exhaustedAt && !state.deepQueue.length ? "complete" : options.dryRun ? "dry-run" : "paused";
  await writeJson(options.statePath, state);
  await writeJson(options.interestingPath, {
    schemaVersion: INVENTORY_SCHEMA,
    updatedAt: now(),
    source: INVENTORY_ENDPOINT,
    candidates: state.topCandidates,
  });

  console.log(JSON.stringify({
    status: state.status,
    state: options.statePath,
    shard: state.lastShard,
    cursor: state.cursor,
    coverage: state.coverage,
    queued: state.deepQueue.length,
    highlights: state.topCandidates.length,
    diagnostics: diagnostics.length,
  }, null, 2));
  return state;
}

export async function main(argv = process.argv.slice(2)) {
  const options = {
    batchSize: clampInteger(argValue(argv, "--batch-size", DEFAULTS.batchSize), 1, 100, DEFAULTS.batchSize),
    deepLimit: clampInteger(argValue(argv, "--deep-limit", DEFAULTS.deepLimit), 0, 25, DEFAULTS.deepLimit),
    statePath: resolveOption(argValue(argv, "--state", DEFAULTS.state)),
    shardDir: resolveOption(argValue(argv, "--shard-dir", DEFAULTS.shardDir)),
    interestingPath: resolveOption(argValue(argv, "--interesting", DEFAULTS.interesting)),
    dryRun: argv.includes("--dry-run"),
    reset: argv.includes("--reset"),
  };
  return run(options);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`[full-inventory] fatal: ${error.message}`);
    process.exitCode = 1;
  });
}
