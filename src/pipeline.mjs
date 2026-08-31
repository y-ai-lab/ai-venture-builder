export const APP_VERSION = "0.2.0";

export const SOURCE_DEFINITIONS = [
  {
    id: "github",
    name: "GitHub repositories",
    mode: "browser-and-cli",
    url: "https://api.github.com/search/repositories",
    official: "https://docs.github.com/en/rest/search/search#search-repositories",
    note: "ブラウザから直接取得できる公開Repository。",
  },
  {
    id: "gitlab",
    name: "GitLab public projects",
    mode: "cli-and-actions",
    url: "https://gitlab.com/api/v4/projects",
    official: "https://docs.gitlab.com/api/projects/",
    note: "公開API経由。静的サイトのブラウザCORSを避けるためCLI/Actionsで取得。",
  },
  {
    id: "hf-models",
    name: "Hugging Face Models",
    mode: "cli-and-actions",
    url: "https://huggingface.co/api/models",
    official: "https://huggingface.co/docs/hub/api",
    note: "モデルの公開メタデータ。推論課金はこのMVPでは使用しない。",
  },
  {
    id: "hf-datasets",
    name: "Hugging Face Datasets",
    mode: "cli-and-actions",
    url: "https://huggingface.co/api/datasets",
    official: "https://huggingface.co/docs/hub/api",
    note: "公開データセットのメタデータ。ライセンスを個別確認する。",
  },
  {
    id: "egov",
    name: "e-Gov Data Catalog",
    mode: "cli-and-actions",
    url: "https://data.e-gov.go.jp/data/api/action/package_search",
    official: "https://data.e-gov.go.jp/data/api_guide",
    note: "日本政府データカタログのメタデータ。個別データの利用条件を確認する。",
  },
];

export const DISCOVERY_CONFIG = {
  github: [
    { q: "ocr document automation", category: "document" },
    { q: "pdf parser extractor", category: "document" },
    { q: "rss feed aggregator", category: "monitoring" },
    { q: "open data dashboard", category: "data" },
    { q: "data pipeline csv json", category: "data" },
    { q: "web scraping parser", category: "parsing" },
    { q: "browser automation", category: "automation" },
    { q: "workflow automation", category: "automation" },
    { q: "speech to text", category: "ai" },
    { q: "translation local", category: "ai" },
    { q: "image processing metadata", category: "media" },
    { q: "search engine local", category: "search" },
    { q: "knowledge base markdown", category: "knowledge" },
    { q: "license compliance scanner", category: "compliance" },
    { q: "job data parser", category: "data" },
    { q: "data cleaning csv quality", category: "data" },
    { q: "transcription quality assurance", category: "ai" },
    { q: "transcript proofreading", category: "document" },
    { q: "website accessibility audit", category: "compliance" },
    { q: "japanese speech recognition offline", category: "ai" },
  ],
  gitlab: [
    { q: "ocr", category: "document" },
    { q: "open data", category: "data" },
    { q: "rss", category: "monitoring" },
    { q: "automation", category: "automation" },
    { q: "pdf", category: "document" },
  ],
  "hf-models": [
    { q: "ocr", category: "ai" },
    { q: "text-classification", category: "ai" },
    { q: "automatic-speech-recognition", category: "ai" },
    { q: "translation", category: "ai" },
    { q: "document-question-answering", category: "document" },
  ],
  "hf-datasets": [
    { q: "japanese", category: "data" },
    { q: "open data", category: "data" },
    { q: "document", category: "document" },
    { q: "speech", category: "ai" },
  ],
  egov: [
    { q: "人口", category: "data" },
    { q: "観光", category: "data" },
    { q: "中小企業", category: "data" },
    { q: "雇用", category: "data" },
    { q: "防災", category: "data" },
    { q: "統計", category: "data" },
  ],
};

const PASS_LICENSES = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "Unlicense",
  "CC0-1.0",
  "CC-BY-4.0",
]);

const REVIEW_LICENSE_PATTERNS = [
  "GPL",
  "LGPL",
  "AGPL",
  "SSPL",
  "BSL",
  "BUSL",
  "MPL",
  "ODbL",
  "CC-BY-SA",
  "CUSTOM",
  "SOURCE-AVAILABLE",
];

const EXCLUDE_LICENSE_PATTERNS = [
  "NON-COMMERCIAL",
  "NO LICENSE",
  "NO-LICENSE",
  "UNLICENSED",
  "PROPRIETARY",
  "ALL RIGHTS RESERVED",
];

const STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "that", "this", "tool", "open", "source",
  "app", "project", "using", "based", "local", "free", "data", "api", "ai",
]);

function text(value) {
  return value == null ? "" : String(value);
}

function lower(value) {
  return text(value).toLowerCase();
}

export function slug(value) {
  return lower(value)
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

export function inferCategory(rawCategory = "other", rawText = "") {
  const value = lower(`${rawCategory} ${rawText}`);
  if (/ocr|pdf|document|word|excel/.test(value)) return "document";
  if (/rss|feed|monitor|alert|watch/.test(value)) return "monitoring";
  if (/csv|json|dataset|open data|database|statistics|job data/.test(value)) return "data";
  if (/parser|parse|scrap|extract|crawler|html/.test(value)) return "parsing";
  if (/browser|workflow|automat|robot|task/.test(value)) return "automation";
  if (/speech|translation|model|nlp|vision|ai/.test(value)) return "ai";
  if (/image|video|audio|media|metadata/.test(value)) return "media";
  if (/search|index|retriev|vector/.test(value)) return "search";
  if (/knowledge|markdown|wiki|note/.test(value)) return "knowledge";
  if (/license|compliance|audit|accessib|security/.test(value)) return "compliance";
  return rawCategory || "other";
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function extractLicense(item) {
  const direct = [
    item?.license,
    item?.license_spdx_id,
    item?.license_name,
    item?.license_key,
    item?.license?.spdx_id,
    item?.license?.key,
    item?.license?.name,
  ].find((value) => typeof value === "string" && value.trim());
  if (direct) return direct.trim();

  const tags = Array.isArray(item?.tags) ? item.tags : [];
  const tag = tags.find((value) => lower(value).startsWith("license:"));
  return tag ? tag.slice("license:".length).trim() : null;
}

function normalizeLicenseLabel(rawLicense) {
  const value = text(rawLicense).trim();
  const upper = value.toUpperCase();
  const aliases = {
    MIT: "MIT",
    "APACHE-2.0": "Apache-2.0",
    APACHE2: "Apache-2.0",
    "BSD-2-CLAUSE": "BSD-2-Clause",
    "BSD-3-CLAUSE": "BSD-3-Clause",
    ISC: "ISC",
    UNLICENSE: "Unlicense",
    "CC0-1.0": "CC0-1.0",
    "CC-BY-4.0": "CC-BY-4.0",
  };
  return aliases[upper] || value;
}

export function classifyLicense(rawLicense) {
  if (!rawLicense) {
    return {
      decision: "EXCLUDE",
      label: "NO_LICENSE",
      commercialUsability: "unknown",
      reason: "ライセンスを確認できないため除外",
    };
  }

  const normalized = normalizeLicenseLabel(rawLicense);
  const upper = normalized.toUpperCase();
  if (PASS_LICENSES.has(normalized)) {
    return {
      decision: "PASS",
      label: normalized,
      commercialUsability: "clear",
      reason: "商用利用条件が比較的明確",
    };
  }
  if (EXCLUDE_LICENSE_PATTERNS.some((pattern) => upper.includes(pattern))) {
    return {
      decision: "EXCLUDE",
      label: normalized,
      commercialUsability: "prohibited-or-unclear",
      reason: "商用利用不可または権利条件が不明確",
    };
  }
  if (REVIEW_LICENSE_PATTERNS.some((pattern) => upper.includes(pattern))) {
    return {
      decision: "REVIEW",
      label: normalized,
      commercialUsability: "review",
      reason: "ライセンス義務を個別確認する必要あり",
    };
  }
  return {
    decision: "REVIEW",
    label: normalized,
    commercialUsability: "review",
    reason: "商用利用条件を個別確認する必要あり",
  };
}

function inferRequirements(item) {
  const haystack = lower([
    item?.description,
    item?.name,
    item?.full_name,
    item?.id,
    ...(Array.isArray(item?.topics) ? item.topics : []),
    ...(Array.isArray(item?.tags) ? item.tags : []),
  ].join(" "));

  const apiRequired = /api[ -]?(key|token)|oauth|credential|secret|paid api|commercial api|credits? required|requires? (?:an? )?api/.test(haystack)
    || /landing-ai\/ade-cli|ade-cli/.test(haystack);
  const gpuRequired = /requires? gpu|cuda|gpu accelerated|large model/.test(haystack);
  const cloudRequired = /aws|gcp|azure|cloud-only|kubernetes|vps|server required/.test(haystack);
  const browserOnly = /browser extension|chrome extension|firefox extension/.test(haystack);
  const localHint = /local|offline|self-hosted|standalone|cli|static/.test(haystack);

  let freeScore = 15;
  if (apiRequired) freeScore -= 5;
  if (/landing-ai\/ade-cli|ade-cli/.test(haystack)) freeScore -= 5;
  if (gpuRequired) freeScore -= 6;
  if (cloudRequired) freeScore -= 5;
  if (localHint) freeScore += 2;
  freeScore = Math.max(0, Math.min(20, freeScore));

  return {
    apiRequired,
    gpuRequired,
    cloudRequired,
    browserOnly,
    localHint,
    freeScore,
    installationRequirements: browserOnly ? "ブラウザ拡張またはブラウザ環境" : localHint ? "ローカル実行の可能性" : "要確認",
    dependencies: gpuRequired ? "GPU/CUDAの可能性" : "詳細はREADME確認",
    externalApiRequirements: apiRequired ? "API key / OAuthの可能性" : "公開API依存は未検出",
    hostingRequirements: cloudRequired ? "クラウド/VPSの可能性" : localHint ? "ローカルまたは静的ホスティングの可能性" : "要確認",
  };
}

export function inferProblem(category, rawText = "") {
  const value = lower(`${category} ${rawText}`);
  if (/ocr|pdf|document/.test(value)) return "文書情報の抽出・確認に時間がかかる";
  if (/rss|monitor|feed/.test(value)) return "新着情報が分散し、重要な変化を見落とす";
  if (/data|csv|json|dataset/.test(value)) return "公開データが加工されておらず、意思決定に使いづらい";
  if (/automation|workflow|browser/.test(value)) return "定型作業が繰り返し発生し、手作業が残る";
  if (/search|knowledge/.test(value)) return "必要な情報を探すまでに時間がかかる";
  if (/license|compliance/.test(value)) return "公開資産の利用条件確認に手間がかかる";
  if (/speech|translation|ai/.test(value)) return "言語・音声データの整理や変換に手間がかかる";
  if (/media|image|video/.test(value)) return "大量のメディアを分類・再利用しづらい";
  return "公開資産を実務で使える形へ変換する手間が大きい";
}

function commonAsset({ source, name, url, description, category, raw, id, stats = {} }) {
  const license = extractLicense(raw || {});
  const licenseInfo = classifyLicense(license);
  const requirements = inferRequirements({ ...(raw || {}), name, description, category });
  const now = new Date().toISOString();
  const safeUrl = url || "";
  const combinedText = `${name} ${description || ""} ${category || ""}`;

  return {
    id: id || `${source}:${slug(name)}`,
    source,
    name: text(name).trim() || "Unnamed asset",
    url: safeUrl,
    canonicalUrl: safeUrl,
    category: category || "other",
    description: text(description).trim() || "説明なし。READMEと利用条件を確認する。",
    problem: inferProblem(category, combinedText),
    stars: Number(stats.stars || 0),
    downloads: Number(stats.downloads || 0),
    likes: Number(stats.likes || 0),
    forks: Number(stats.forks || 0),
    updatedAt: stats.updatedAt || null,
    lastActivityAt: stats.lastActivityAt || stats.updatedAt || null,
    contributors: Number(stats.contributors || 0),
    releaseFrequency: "UNKNOWN",
    language: stats.language || null,
    topics: Array.isArray(stats.topics) ? stats.topics : [],
    license,
    licenseDecision: licenseInfo.decision,
    licenseLabel: licenseInfo.label,
    commercialUsability: licenseInfo.commercialUsability,
    licenseReason: licenseInfo.reason,
    installationRequirements: requirements.installationRequirements,
    dependencies: requirements.dependencies,
    externalApiRequirements: requirements.externalApiRequirements,
    hostingRequirements: requirements.hostingRequirements,
    apiRequired: requirements.apiRequired,
    gpuRequired: requirements.gpuRequired,
    cloudRequired: requirements.cloudRequired,
    localHint: requirements.localHint,
    freeScore: requirements.freeScore,
    targetUser: "公開資産を実務へ組み込みたい個人・小規模事業者",
    searchQueries: [],
    fetchedAt: now,
    assetScore: 0,
  };
}

export function normalizeGithubItem(item, query = null, fetchedAt = new Date().toISOString()) {
  const category = inferCategory(query?.category || "other", `${item?.name || ""} ${item?.description || ""}`);
  const asset = commonAsset({
    source: "GitHub",
    name: item?.full_name || item?.name,
    url: item?.html_url,
    description: item?.description,
    category,
    raw: item,
    id: `github:${item?.full_name || item?.id || slug(item?.name)}`,
    stats: {
      stars: item?.stargazers_count,
      forks: item?.forks_count,
      updatedAt: item?.updated_at,
      lastActivityAt: item?.pushed_at,
      language: item?.language,
      topics: item?.topics,
    },
  });
  asset.searchQueries = query?.q ? [query.q] : [];
  asset.fetchedAt = fetchedAt;
  asset.archived = Boolean(item?.archived);
  asset.openIssues = Number(item?.open_issues_count || 0);
  asset.defaultBranch = item?.default_branch || null;
  asset.assetScore = calculateAssetScore(asset);
  return asset;
}

export function normalizeGitlabItem(item, query = null, fetchedAt = new Date().toISOString()) {
  const name = item?.path_with_namespace || item?.name;
  const asset = commonAsset({
    source: "GitLab",
    name,
    url: item?.web_url,
    description: item?.description,
    category: query?.category || "other",
    raw: item,
    id: `gitlab:${item?.id || slug(name)}`,
    stats: {
      stars: item?.star_count,
      forks: item?.forks_count,
      updatedAt: item?.last_activity_at || item?.updated_at,
      language: item?.programming_language,
      topics: item?.topics,
    },
  });
  asset.searchQueries = query?.q ? [query.q] : [];
  asset.fetchedAt = fetchedAt;
  asset.archived = Boolean(item?.archived);
  asset.assetScore = calculateAssetScore(asset);
  return asset;
}

export function normalizeHfItem(item, kind = "model", query = null, fetchedAt = new Date().toISOString()) {
  const id = item?.id || item?._id || "unknown";
  const base = kind === "dataset" ? "https://huggingface.co/datasets/" : "https://huggingface.co/";
  const asset = commonAsset({
    source: kind === "dataset" ? "Hugging Face Datasets" : "Hugging Face Models",
    name: id,
    url: `${base}${id}`,
    description: `${item?.pipeline_tag || kind} / ${item?.library_name || "Hub item"}`,
    category: query?.category || "ai",
    raw: item,
    id: `hf:${kind}:${id}`,
    stats: {
      likes: item?.likes,
      downloads: item?.downloads,
      updatedAt: item?.lastModified,
      language: item?.library_name,
      topics: item?.tags,
    },
  });
  asset.searchQueries = query?.q ? [query.q] : [];
  asset.fetchedAt = fetchedAt;
  asset.pipelineTag = item?.pipeline_tag || null;
  asset.assetScore = calculateAssetScore(asset);
  return asset;
}

export function normalizeEgovItem(item, query = null, fetchedAt = new Date().toISOString()) {
  const datasetId = item?.name || item?.id || slug(item?.title);
  const asset = commonAsset({
    source: "e-Gov Data Catalog",
    name: item?.title || datasetId,
    url: item?.landingPage || item?.url || `https://data.e-gov.go.jp/data/dataset/${datasetId}`,
    description: item?.notes || `${item?.organization?.title || item?.publisher || "政府機関"}が公開するデータセット`,
    category: query?.category || "data",
    raw: item,
    id: `egov:${datasetId}`,
    stats: {
      updatedAt: item?.metadata_modified,
      topics: Array.isArray(item?.tags) ? item.tags.map((tag) => tag?.name || tag) : [],
    },
  });
  asset.searchQueries = query?.q ? [query.q] : [];
  asset.fetchedAt = fetchedAt;
  asset.publisher = item?.organization?.title || item?.publisher || null;
  asset.resourceCount = Number(item?.num_resources || item?.resources?.length || 0);
  // The catalogue is public, but a public catalogue entry is not itself a
  // commercial-use grant. Keep every missing dataset license in review.
  asset.licenseDecision = "REVIEW";
  asset.licenseLabel = "LICENSE_REVIEW_REQUIRED";
  asset.commercialUsability = "review";
  asset.licenseReason = "データセット個別の利用条件を確認する必要あり";
  asset.assetScore = calculateAssetScore(asset);
  return asset;
}

function dateAgeDays(value) {
  if (!value) return 9999;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return 9999;
  return Math.max(0, (Date.now() - time) / 86400000);
}

export function calculateAssetScore(asset) {
  const traction = Math.min(20, Math.log10(1 + Math.max(asset.stars || 0, asset.downloads || 0, asset.likes || 0)) * 5);
  const forks = Math.min(10, Math.log10(1 + (asset.forks || 0)) * 3.5);
  const freshness = asset.archived ? 0 : dateAgeDays(asset.lastActivityAt || asset.updatedAt) < 365 ? 12 : dateAgeDays(asset.lastActivityAt || asset.updatedAt) < 900 ? 7 : 2;
  const license = asset.licenseDecision === "PASS" ? 25 : asset.licenseDecision === "REVIEW" ? 10 : 0;
  const free = Math.min(20, Math.max(0, Number(asset.freeScore || 0)));
  const completeness = asset.description && asset.url ? 3 : 0;
  return round(Math.min(100, traction + forks + freshness + license + free + completeness), 1);
}

export function dedupeAssets(assets = []) {
  const byKey = new Map();
  for (const asset of assets) {
    const key = `${asset.source}:${asset.canonicalUrl || asset.url || asset.id}`.toLowerCase();
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...asset, searchQueries: [...(asset.searchQueries || [])] });
      continue;
    }
    const queries = new Set([...(existing.searchQueries || []), ...(asset.searchQueries || [])]);
    existing.searchQueries = [...queries];
    if ((asset.assetScore || 0) > (existing.assetScore || 0)) byKey.set(key, { ...existing, ...asset, searchQueries: [...queries] });
  }
  return [...byKey.values()].sort((a, b) => (b.assetScore || 0) - (a.assetScore || 0));
}

export function filterAssets(assets = []) {
  const accepted = [];
  const review = [];
  const excluded = [];
  for (const asset of dedupeAssets(assets)) {
    if (asset.archived) {
      excluded.push({ ...asset, exclusionReason: "アーカイブ済み" });
    } else if (asset.licenseDecision === "EXCLUDE") {
      excluded.push({ ...asset, exclusionReason: asset.licenseReason });
    } else if (asset.freeScore < 4 || asset.apiRequired && asset.cloudRequired && asset.freeScore < 8) {
      excluded.push({ ...asset, exclusionReason: "0円構築可能性が低い" });
    } else if (asset.licenseDecision === "REVIEW") {
      review.push({ ...asset, reviewReason: "LICENSE_REVIEW_REQUIRED" });
    } else {
      accepted.push(asset);
    }
  }
  return {
    accepted: accepted.sort((a, b) => b.assetScore - a.assetScore),
    review: review.sort((a, b) => b.assetScore - a.assetScore),
    excluded,
    counts: { total: assets.length, accepted: accepted.length, review: review.length, excluded: excluded.length },
  };
}

const STEP_AUTO = "完全自動";
const STEP_SEMI = "半自動";
const STEP_HUMAN = "人間必須";

const COMMON_AUTONOMY = {
  discovery: STEP_AUTO,
  data: STEP_AUTO,
  analysis: STEP_SEMI,
  product: STEP_AUTO,
  publish: STEP_HUMAN,
  acquisition: STEP_SEMI,
  sales: STEP_SEMI,
  delivery: STEP_AUTO,
  support: STEP_HUMAN,
  improvement: STEP_SEMI,
};

export const HYPOTHESIS_TEMPLATES = [
  {
    id: "venture-01", title: "日本の公開データ差分レポート", customer: "中小企業・個人事業主", problem: "制度・統計・自治体データの変化を追えず、判断が遅れる", model: "有料レポート / Paid Alerts", channel: "Gumroad", roles: ["data", "parsing", "monitoring"], speed: 8, advantage: 8, difficulty: 4, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, publish: STEP_HUMAN }, risk: "データ提供元の利用条件と更新差分の確認", kill: "7日で10人に提示して、有料予約が0件なら停止または対象業界を変更" },
  {
    id: "venture-02", title: "公開PDFの実務チェックパック", customer: "有料note・PDFを初めて販売する個人", problem: "公開前の抜け漏れや読みにくさを自分で判断できない", model: "One-time digital product / Service + Automation", channel: "ココナラ", roles: ["document", "parsing", "knowledge"], speed: 9, advantage: 7, difficulty: 3, support: 4, scale: 4, autonomy: { ...COMMON_AUTONOMY, support: STEP_HUMAN }, risk: "無料のAI校正との差別化が弱くなりやすい", kill: "10件の無料診断で有料化率10%未満なら対象と成果物を変更" },
  {
    id: "venture-03", title: "自治体・公共案件の新着要約便", customer: "地域の小規模事業者・フリーランサー", problem: "自分に関係する公募・入札情報を探す時間がない", model: "Paid Alerts / Lead Generation", channel: "note", roles: ["data", "monitoring", "parsing"], speed: 7, advantage: 9, difficulty: 5, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, acquisition: STEP_SEMI }, risk: "情報の網羅性と公的サイトの利用規約", kill: "対象地域の登録者20人未満、または有料転換0件なら停止" },
  {
    id: "venture-04", title: "OSSライセンス利用可否レポート", customer: "小規模チーム・ノーコード制作者", problem: "公開コードを使いたいが、商用利用条件の確認に時間がかかる", model: "One-time report / B2B Tool", channel: "Gumroad", roles: ["compliance", "search", "knowledge"], speed: 8, advantage: 8, difficulty: 4, support: 3, scale: 5, autonomy: { ...COMMON_AUTONOMY, analysis: STEP_SEMI }, risk: "法的助言と誤認される表現、ライセンス更新", kill: "20件の利用意向確認で支払い意思がなければ停止" },
  {
    id: "venture-05", title: "業界別RSS変化レーダー", customer: "営業担当・採用担当・個人投資家以外の情報収集担当", problem: "ニュースや更新情報の確認が分散し、見落としが起きる", model: "Paid Alerts / Subscription", channel: "note", roles: ["monitoring", "search", "knowledge"], speed: 7, advantage: 7, difficulty: 3, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, data: STEP_AUTO }, risk: "無料RSSリーダーとの差別化と通知頻度", kill: "7日で登録者30人未満ならニッチを再設定" },
  {
    id: "venture-06", title: "日本語求人スキル変化ダイジェスト", customer: "学習者・転職準備者・小規模研修事業者", problem: "求人に現れるスキルの変化を定量的に追えない", model: "Data Product / One-time report", channel: "Gumroad", roles: ["data", "parsing", "ai"], speed: 7, advantage: 8, difficulty: 5, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, data: STEP_SEMI }, risk: "求人データの取得規約、個人情報の混入", kill: "50人への提示で有料購入0件なら停止" },
  {
    id: "venture-07", title: "オープンデータをCSVに整える代行キット", customer: "調査・営業・地域活動をする個人", problem: "公開データの形式がばらばらで再利用できない", model: "Service + Automation / Template", channel: "ココナラ", roles: ["data", "parsing", "automation"], speed: 9, advantage: 7, difficulty: 3, support: 5, scale: 4, autonomy: { ...COMMON_AUTONOMY, delivery: STEP_SEMI }, risk: "案件ごとの個別作業が増え、自動化率が下がる", kill: "5件の相談で標準化できなければ商品を作らない" },
  {
    id: "venture-08", title: "小規模事業者向け文書OCR整理ツール", customer: "紙・PDF資料が残る小規模事業者", problem: "必要な数字や項目を転記する作業が残っている", model: "B2B Tool / Service + Automation", channel: "ココナラ", roles: ["document", "ai", "data"], speed: 6, advantage: 7, difficulty: 5, support: 5, scale: 4, autonomy: { ...COMMON_AUTONOMY, product: STEP_SEMI, support: STEP_HUMAN }, risk: "OCR精度、機密書類、個人情報", kill: "匿名サンプル10件で実用精度が出なければ停止" },
  {
    id: "venture-09", title: "公開研究の日本語実務ブリーフ", customer: "専門外の事業担当者・個人制作者", problem: "論文を読めても、実務に使える示唆へ変換しにくい", model: "Paid Brief / One-time product", channel: "note", roles: ["search", "knowledge", "ai"], speed: 8, advantage: 6, difficulty: 4, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, analysis: STEP_SEMI }, risk: "要約の正確性と引用・著作権", kill: "試読者20人で有料予約0件ならテーマ変更" },
  {
    id: "venture-10", title: "アクセシビリティ改善の一次診断", customer: "小規模サイト運営者", problem: "改善点はありそうだが優先順位がわからない", model: "B2B Tool / Service", channel: "ココナラ", roles: ["parsing", "compliance", "automation"], speed: 8, advantage: 7, difficulty: 4, support: 5, scale: 4, autonomy: { ...COMMON_AUTONOMY, analysis: STEP_SEMI }, risk: "診断結果を法的保証と誤認されること", kill: "10件のヒアリングで具体的な支払意思がなければ停止" },
  {
    id: "venture-11", title: "ローカル事業者向け補助金検索シート", customer: "個人事業主・小規模法人", problem: "自分に関係する制度を探せず、募集期間を逃す", model: "Data Product / Paid Alerts", channel: "Gumroad", roles: ["data", "search", "monitoring"], speed: 8, advantage: 8, difficulty: 4, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, acquisition: STEP_SEMI }, risk: "制度情報の更新と対象要件の誤解", kill: "7日で予約5件未満なら対象地域を絞るか停止" },
  {
    id: "venture-12", title: "AI導入前のデータ棚卸しシート", customer: "AI導入を検討する小規模チーム", problem: "何のデータをどう整えるべきか決められない", model: "Template / B2B Tool", channel: "Gumroad", roles: ["knowledge", "compliance", "data"], speed: 9, advantage: 6, difficulty: 2, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, product: STEP_AUTO }, risk: "汎用テンプレート化して価格競争になること", kill: "対象者30人への提示で予約0件なら作らない" },
  {
    id: "venture-13", title: "公開データの鮮度チェッカー", customer: "レポート・分析資料を作る個人", problem: "参照したデータが古くなっていることに気づけない", model: "Freemium / Paid Alerts", channel: "Gumroad", roles: ["data", "monitoring", "automation"], speed: 7, advantage: 8, difficulty: 4, support: 3, scale: 5, autonomy: { ...COMMON_AUTONOMY, data: STEP_AUTO }, risk: "データ源ごとの仕様変更と無料自作との差", kill: "50人の試用で有料化0件なら停止" },
  {
    id: "venture-14", title: "日本語音声の議事メモ整形パック", customer: "少人数チーム・個人講師", problem: "音声から必要な決定事項を抜き出すのに時間がかかる", model: "Service + Automation / One-time", channel: "ココナラ", roles: ["ai", "knowledge", "document"], speed: 8, advantage: 6, difficulty: 4, support: 5, scale: 4, autonomy: { ...COMMON_AUTONOMY, support: STEP_HUMAN }, risk: "音声の個人情報、誤認、保存先", kill: "匿名音声5件で品質と支払意思を確認できなければ停止" },
  {
    id: "venture-15", title: "公開テンプレートの導入手順パック", customer: "技術に詳しくない個人・小規模事業者", problem: "公開ツールを見つけても導入と使い分けで止まる", model: "One-time digital product", channel: "Gumroad", roles: ["knowledge", "automation", "search"], speed: 9, advantage: 6, difficulty: 3, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, analysis: STEP_SEMI }, risk: "単なる翻訳・README再販になりやすい", kill: "購入前相談10件で具体的な作業削減が説明できなければ停止" },
  {
    id: "venture-16", title: "中小事業者向け公開情報の競合比較表", customer: "地域サービス・小規模事業者", problem: "競合の公開情報を手作業で比較するのが面倒", model: "B2B Tool / Data Product", channel: "ココナラ", roles: ["search", "data", "parsing"], speed: 7, advantage: 7, difficulty: 4, support: 5, scale: 4, autonomy: { ...COMMON_AUTONOMY, acquisition: STEP_SEMI }, risk: "取得規約、情報の正確性、営業依存", kill: "有料相談5件未満なら一般商品化しない" },
  {
    id: "venture-17", title: "公開画像メタデータ整理レポート", customer: "素材管理をする個人・小規模チーム", problem: "画像が増えるほど検索と権利確認が難しくなる", model: "One-time tool / Service", channel: "Gumroad", roles: ["media", "compliance", "automation"], speed: 7, advantage: 6, difficulty: 4, support: 4, scale: 4, autonomy: { ...COMMON_AUTONOMY, product: STEP_SEMI }, risk: "画像権利の確認を自動判定できない", kill: "匿名サンプル20件で支払意思がなければ停止" },
  {
    id: "venture-18", title: "小規模チーム向けローカル検索導入キット", customer: "社内資料が散らばる小規模チーム", problem: "外部SaaSへ資料を置けず、検索性も低い", model: "B2B Tool / Setup service", channel: "ココナラ", roles: ["search", "knowledge", "document"], speed: 6, advantage: 8, difficulty: 5, support: 5, scale: 4, autonomy: { ...COMMON_AUTONOMY, product: STEP_SEMI, support: STEP_HUMAN }, risk: "端末環境差、機密情報、導入支援負担", kill: "3社の有料相談が取れなければ開発しない" },
  {
    id: "venture-19", title: "公開ニュースの業務影響スコア", customer: "特定業界の営業・企画担当", problem: "ニュースを読んでも自分の業務への影響がわからない", model: "Paid Brief / Alerts", channel: "note", roles: ["monitoring", "ai", "knowledge"], speed: 7, advantage: 7, difficulty: 5, support: 4, scale: 5, autonomy: { ...COMMON_AUTONOMY, analysis: STEP_SEMI }, risk: "ニュースの利用規約、誤った影響判断", kill: "読者30人で有料予約0件なら停止" },
  {
    id: "venture-20", title: "公開資産から作る業務自動化診断", customer: "AI導入前の個人事業主", problem: "自分の作業に使える公開ツールの選び方がわからない", model: "Service + Automation / Lead Generation", channel: "ココナラ", roles: ["automation", "search", "compliance"], speed: 9, advantage: 8, difficulty: 3, support: 5, scale: 4, autonomy: { ...COMMON_AUTONOMY, publish: STEP_HUMAN }, risk: "診断結果が一般論になりやすく、相談対応が増える", kill: "相談10件で有料化2件未満なら停止" },
];

function autonomyValue(status) {
  if (status === STEP_AUTO) return 1;
  if (status === STEP_SEMI) return 0.5;
  return 0;
}

export function calculateAutonomy(steps = COMMON_AUTONOMY) {
  const values = Object.values(steps).map(autonomyValue);
  return round(values.reduce((sum, value) => sum + value, 0) / values.length * 100);
}

function hasRole(asset, role) {
  const haystack = lower(`${asset.category} ${asset.name} ${asset.description} ${(asset.topics || []).join(" ")}`);
  const roleMap = {
    document: /document|ocr|pdf|word|excel|text/.test(haystack),
    data: /data|csv|json|dataset|database|statistics|job/.test(haystack),
    parsing: /parser|parse|scrap|extract|crawler|html/.test(haystack),
    monitoring: /rss|feed|monitor|alert|watch|notification/.test(haystack),
    automation: /automat|workflow|browser|robot|task/.test(haystack),
    ai: /ai|model|ocr|speech|translation|machine|nlp|vision/.test(haystack),
    media: /image|video|audio|media|metadata/.test(haystack),
    search: /search|index|retriev|elastic|vector|knowledge/.test(haystack),
    knowledge: /knowledge|markdown|wiki|document|note|search/.test(haystack),
    compliance: /license|compliance|audit|accessib|security/.test(haystack),
  };
  return Boolean(roleMap[role]);
}

function chooseAsset(pool, role, used) {
  return pool.find((asset) => !used.has(asset.id) && hasRole(asset, role))
    || pool.find((asset) => !used.has(asset.id))
    || pool.find((asset) => hasRole(asset, role))
    || pool[0]
    || null;
}

export function composeHypotheses(assets = [], count = 20) {
  const pool = dedupeAssets(assets).filter((asset) => asset.licenseDecision === "PASS");
  if (!pool.length) return [];
  return HYPOTHESIS_TEMPLATES.slice(0, count).map((template, index) => {
    const used = new Set();
    const selected = template.roles.map((role) => {
      const asset = chooseAsset(pool, role, used);
      if (asset) used.add(asset.id);
      return asset;
    }).filter(Boolean);
    const autonomy = calculateAutonomy(template.autonomy);
    const hypothesis = {
      id: template.id,
      title: template.title,
      customer: template.customer,
      problem: template.problem,
      model: template.model,
      channel: template.channel,
      assets: selected,
      assetIds: selected.map((asset) => asset.id),
      assetNames: selected.map((asset) => asset.name),
      risk: template.risk,
      killCriteria: template.kill,
      autonomySteps: template.autonomy,
      autonomyPercent: autonomy,
      speedScore: template.speed,
      advantageScore: template.advantage,
      difficultyScore: template.difficulty,
      supportScore: template.support,
      scaleScore: template.scale,
      monetizationScore: 15,
      validationStatus: "NOT_VALIDATED",
      evidence: [],
      validationQuestions: [
        `「${template.problem}」で直近に時間・お金を失った人がいるか`,
        `この成果物に${template.channel === "ココナラ" ? "980〜2,980円" : "500〜1,500円"}を払う人がいるか`,
        "無料代替では解消できない部分は何か",
      ],
      order: index + 1,
    };
    return { ...hypothesis, ...calculateHypothesisScore(hypothesis, []) };
  });
}

const EVIDENCE_WEIGHTS = {
  payment: 20,
  contract: 18,
  job: 15,
  review: 10,
  complaint: 7,
  price: 3,
  competitor: 2,
};

export function calculateDemandScore(evidence = []) {
  const uniqueTypes = new Set();
  let score = 0;
  for (const item of evidence) {
    const type = item?.type || "price";
    if (!uniqueTypes.has(type)) {
      score += EVIDENCE_WEIGHTS[type] || 0;
      uniqueTypes.add(type);
    } else {
      score += Math.min(3, EVIDENCE_WEIGHTS[type] || 0);
    }
  }
  return Math.min(20, score);
}

export function calculateHypothesisScore(hypothesis, evidence = []) {
  const selectedAssets = hypothesis.assets || [];
  const free = selectedAssets.length
    ? round(selectedAssets.reduce((sum, asset) => sum + Number(asset.freeScore || 0), 0) / selectedAssets.length / 20 * 15, 1)
    : 0;
  const demand = calculateDemandScore(evidence);
  const breakdown = {
    demand,
    free,
    autonomy: round(Number(hypothesis.autonomyPercent || 0) / 100 * 15, 1),
    monetization: Number(hypothesis.monetizationScore || 0),
    speed: Number(hypothesis.speedScore || 0),
    advantage: Number(hypothesis.advantageScore || 0),
    difficulty: Math.max(0, 5 - Number(hypothesis.difficultyScore || 5)),
    support: Math.max(0, 5 - Number(hypothesis.supportScore || 5)),
    scale: Number(hypothesis.scaleScore || 0),
  };
  const total = round(Object.values(breakdown).reduce((sum, value) => sum + value, 0), 1);
  return {
    score: total,
    scoreLabel: demand >= 10 ? "市場検証反映済み" : "市場検証待ち",
    scoreBreakdown: breakdown,
    demandEvidenceCount: evidence.length,
    validationStatus: demand >= 15 ? "VALIDATED_SIGNAL" : demand > 0 ? "PARTIAL_SIGNAL" : "NOT_VALIDATED",
  };
}

export function rankHypotheses(hypotheses = [], evidenceByHypothesis = {}) {
  return hypotheses
    .map((hypothesis) => {
      const evidence = evidenceByHypothesis[hypothesis.id] || hypothesis.evidence || [];
      return { ...hypothesis, evidence, ...calculateHypothesisScore(hypothesis, evidence) };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((hypothesis, index) => ({ ...hypothesis, rank: index + 1 }));
}

export function createBuildBrief(hypothesis, scoutMeta = {}) {
  if (!hypothesis) return "採用候補がありません。市場検証後にBuild Gateを通してください。";
  const assets = (hypothesis.assets || []).map((asset) => `- ${asset.name} (${asset.licenseLabel || "LICENSE_REVIEW_REQUIRED"})\n  ${asset.url}`).join("\n");
  const evidence = (hypothesis.evidence || []).map((item) => `- ${item.type}: ${item.note || "記録あり"}${item.url ? ` — ${item.url}` : ""}`).join("\n") || "- 未登録。支払い・発注・求人・レビュー等を1件以上確認する。";
  return `# ${hypothesis.title} — MVP Build Brief\n\n判定: ${hypothesis.scoreLabel}\n仮スコア: ${hypothesis.score}/100\n作成日時: ${new Date().toISOString()}\n\n## 顧客\n${hypothesis.customer}\n\n## 解決する問題\n${hypothesis.problem}\n\n## 最初の収益化\n${hypothesis.model}\n販売チャネル: ${hypothesis.channel}\n初回価格仮説: 500〜2,980円（市場検証で確定）\n\n## 使用する公開資産\n${assets || "- なし"}\n\n## 市場証拠\n${evidence}\n\n## MVPの範囲\n1. 顧客が入力または選択する項目を3つ以内にする。\n2. 公開資産を使った成果物を1種類だけ返す。\n3. 無料代替との差分を画面上で説明する。\n4. 個人情報を保存しない。\n5. 支払い前にサンプルを見せる。\n\n## 受け入れ条件\n- スマートフォンで3分以内に試せる。\n- 成果物が1回の操作でダウンロードまたは受け取れる。\n- 使用資産・ライセンス・更新日時が確認できる。\n- 外部APIキーや有料サービスがなくてもデモできる。\n- 失敗時に原因と代替手段が表示される。\n\n## 自律稼働率\n${hypothesis.autonomyPercent}%\n\n## 最大リスク\n${hypothesis.risk}\n\n## Kill Criteria\n${hypothesis.killCriteria}\n\n## 次の検証\n${(hypothesis.validationQuestions || []).map((question, i) => `${i + 1}. ${question}`).join("\n")}\n\n## 探索メタデータ\n確認資産: ${scoutMeta.totalAssets || 0}件 / 採用可能: ${scoutMeta.acceptedAssets || 0}件 / 要確認: ${scoutMeta.reviewAssets || 0}件\n`;
}

export function createMarkdownReport(state = {}) {
  const ranked = rankHypotheses(state.hypotheses || [], state.evidenceByHypothesis || {});
  const top = ranked.slice(0, 3);
  const lines = [
    "# AI VENTURE BUILDER v0.2 — 探索レポート",
    "",
    `実行日時: ${state.run?.finishedAt || new Date().toISOString()}`,
    `実行モード: ${state.run?.mode || "manual"}`,
    "追加運用費: 0円（候補判定上）",
    "",
    "## 探索",
    `確認した公開資産: ${state.stats?.total || state.assets?.length || 0}件`,
    `採用可能: ${state.stats?.accepted || 0}件`,
    `ライセンス要確認: ${state.stats?.review || 0}件`,
    `除外: ${state.stats?.excluded || 0}件`,
    "",
    "## ビジネス仮説",
    `生成: ${ranked.length}件`,
    `市場証拠登録済み: ${ranked.filter((item) => item.demandEvidenceCount > 0).length}件`,
    "",
    "## TOP3",
  ];
  for (const item of top) {
    lines.push(
      `### ${item.rank}位: ${item.title}`,
      `- Score: ${item.score}/100（${item.scoreLabel}）`,
      `- 顧客: ${item.customer}`,
      `- 収益方法: ${item.model}`,
      `- チャネル: ${item.channel}`,
      `- AI自律稼働率: ${item.autonomyPercent}%`,
      `- 最大リスク: ${item.risk}`,
      `- 使用資産: ${item.assetNames.join(" / ")}`,
      "",
    );
  }
  const selected = ranked.find((item) => item.id === state.selectedHypothesisId) || top[0];
  lines.push("## 採用事業 / Build Brief", "", createBuildBrief(selected, {
    totalAssets: state.stats?.total || state.assets?.length || 0,
    acceptedAssets: state.stats?.accepted || 0,
    reviewAssets: state.stats?.review || 0,
  }));
  return lines.join("\n");
}

export function makeEmptyScoutSnapshot() {
  return {
    schemaVersion: APP_VERSION,
    fetchedAt: null,
    mode: "not-run",
    sources: SOURCE_DEFINITIONS,
    sourceCounts: {},
    diagnostics: [],
    assets: [],
  };
}

export function makeDryRunAssets() {
  const fixtures = [
    ["local/ocr-kit", "MIT", "OCR document extraction CLI", "document", 4200],
    ["local/rss-watch", "Apache-2.0", "RSS feed monitor and change detector", "monitoring", 1800],
    ["local/csv-tools", "BSD-3-Clause", "CSV and JSON data cleaning utilities", "data", 2300],
    ["local/workflow", "MIT", "Local workflow automation runner", "automation", 3200],
    ["local/search-index", "Apache-2.0", "Local full text search index", "search", 2800],
    ["local/license-check", "MIT", "Open source license compliance scanner", "compliance", 1200],
    ["local/speech", "MIT", "Offline speech recognition wrapper", "ai", 1500],
    ["local/markdown-kb", "MIT", "Markdown knowledge base", "knowledge", 2600],
    ["local/image-meta", "ISC", "Image metadata processing library", "media", 900],
    ["local/pdf-parser", "MIT", "PDF text and table parser", "parsing", 3900],
  ];
  const now = new Date().toISOString();
  return fixtures.map(([name, license, description, category, stars]) => normalizeGithubItem({
    full_name: name,
    html_url: `https://example.invalid/${name}`,
    description,
    stargazers_count: stars,
    forks_count: Math.round(stars / 10),
    updated_at: now,
    pushed_at: now,
    license: { spdx_id: license },
    language: "JavaScript",
    topics: [category],
  }, { q: category, category }, now));
}
