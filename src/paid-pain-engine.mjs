export const VERSION = "0.4.0";

const PAID_TYPES = new Set(["sale", "contract", "paid_review"]);
const STRONG_SUPPORT_TYPES = new Set(["sale", "contract", "paid_review", "job", "complaint"]);
const SUPPORT_TYPES = new Set(["job", "complaint", "price_displayed", "competitor_only", "sale", "contract", "paid_review"]);
const PASS_LICENSES = new Set(["mit", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "isc", "unlicense", "cc0-1.0"]);
const REVIEW_LICENSES = new Set(["gpl-2.0", "gpl-3.0", "lgpl-2.1", "lgpl-3.0", "agpl-3.0", "mpl-2.0", "epl-2.0"]);

function text(value) {
  return value == null ? "" : String(value).trim();
}

function safeWebUrl(value) {
  try {
    const url = new URL(text(value));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function slug(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

export function normalizeEvidence(input = {}) {
  const type = text(input.type || "job");
  return {
    id: text(input.id || `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    type: SUPPORT_TYPES.has(type) ? type : "job",
    source: text(input.source),
    url: safeWebUrl(input.url),
    note: text(input.note),
    amount: Number(input.amount || 0),
    observedAt: text(input.observedAt || new Date().toISOString()),
  };
}

export function evidenceSummary(evidence = []) {
  const normalized = evidence.map(normalizeEvidence).filter((item) => item.url || item.note);
  const paid = normalized.filter((item) => PAID_TYPES.has(item.type));
  const strongSupport = normalized.filter((item) => STRONG_SUPPORT_TYPES.has(item.type));
  const jobs = normalized.filter((item) => item.type === "job");
  return {
    total: normalized.length,
    paidCount: paid.length,
    strongSupportCount: strongSupport.length,
    supportCount: normalized.length,
    jobCount: jobs.length,
    paidAmountTotal: paid.reduce((sum, item) => sum + Math.max(0, item.amount || 0), 0),
    items: normalized,
  };
}

export function evaluatePainGate(pain = {}) {
  const blockers = [];
  const evidence = evidenceSummary(pain.evidence || []);
  const price = Number(pain.price || 0);
  const autonomy = Number(pain.autonomyPercent || 0);

  if (!text(pain.customer)) blockers.push("顧客が定義されていない");
  if (!text(pain.problem)) blockers.push("顧客の悩みが定義されていない");
  if (!text(pain.offer)) blockers.push("最初に売る成果物が定義されていない");
  if (evidence.paidCount < 1) blockers.push("実際の支払い・契約・有料購入証拠が最低1件必要");
  if (evidence.strongSupportCount < 3) blockers.push("実支払・求人・具体的困りごと等の強い需要証拠を合計3件以上必要");
  if (!text(pain.channel)) blockers.push("最初の販売チャネルが未決定");
  if (price <= 0) blockers.push("販売価格が未決定");
  if (!text(pain.firstCustomerRoute)) blockers.push("最初の顧客への到達方法が未決定");
  if (!text(pain.killCriteria)) blockers.push("Kill Criteriaが未設定");
  if (!pain.zeroCost) blockers.push("追加費用0円で構築できる確認がない");
  if (!pain.oneDayMvp) blockers.push("1日以内のMVPに切れていない");
  if (autonomy < 70) blockers.push("AI自律稼働率が70%未満");

  return {
    passed: blockers.length === 0,
    blockers,
    evidence,
    nextAction: blockers[0] || "公開資産探索へ進む",
  };
}

function extractTokens(value) {
  const stop = new Set(["する", "した", "できる", "できない", "ため", "こと", "もの", "いる", "ない", "から", "まで", "作業", "業務", "問題"]);
  return text(value)
    .normalize("NFKC")
    .toLowerCase()
    .split(/[\s、。・／/,:;()（）\[\]「」]+/)
    .map((item) => item.replace(/[^a-z0-9ぁ-んァ-ヶ一-龠+#.-]/g, ""))
    .filter((item) => item.length >= 2 && !stop.has(item));
}

const JP_TO_EN = [
  [/csv|excel|スプレッドシート|表計算/i, "csv excel spreadsheet"],
  [/文字起こし|音声|字幕/i, "transcription speech subtitle"],
  [/pdf|文書|書類/i, "pdf document parser"],
  [/求人|採用/i, "jobs recruitment"],
  [/価格|値段|料金/i, "price monitoring"],
  [/監視|通知|更新/i, "monitor alert change detection"],
  [/集計|分析|データ/i, "data analytics"],
  [/画像|写真/i, "image processing"],
  [/動画/i, "video processing"],
  [/検索/i, "search index"],
  [/自動化|転記|定型/i, "automation workflow"],
  [/ライセンス|商用利用/i, "license compliance"],
  [/ec|商品登録|在庫/i, "ecommerce product feed"],
];

export function generateAssetSearchQueries(pain = {}) {
  const source = `${text(pain.customer)} ${text(pain.problem)} ${text(pain.solutionHint)}`;
  const queries = [];
  for (const [pattern, translated] of JP_TO_EN) {
    if (pattern.test(source)) queries.push(`${translated} stars:>5 archived:false`);
  }
  const ascii = extractTokens(source).filter((token) => /^[a-z0-9+#.-]+$/i.test(token)).slice(0, 5);
  if (ascii.length) queries.push(`${ascii.join(" ")} stars:>5 archived:false`);
  if (!queries.length) queries.push("automation tool stars:>20 archived:false", "data processing stars:>20 archived:false");
  return [...new Set(queries)].slice(0, 6);
}

export function licenseDecision(spdx) {
  const value = text(spdx).toLowerCase();
  if (!value || value === "other" || value === "noassertion") return "EXCLUDE";
  if (PASS_LICENSES.has(value)) return "PASS";
  if (REVIEW_LICENSES.has(value) || value.includes("gpl") || value.includes("mpl") || value.includes("epl")) return "REVIEW";
  return "REVIEW";
}

export function normalizeGithubAsset(repo = {}, query = "") {
  const license = repo.license?.spdx_id || "NO_LICENSE";
  const decision = licenseDecision(license);
  const updatedAt = repo.pushed_at || repo.updated_at || null;
  const ageDays = updatedAt ? Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 86400000) : 9999;
  const score = Math.round(
    (decision === "PASS" ? 35 : decision === "REVIEW" ? 8 : 0) +
      Math.min(25, Math.log10(Math.max(1, Number(repo.stargazers_count || 0))) * 8) +
      (ageDays <= 90 ? 20 : ageDays <= 365 ? 10 : 0) +
      (repo.archived ? -30 : 10) +
      (repo.fork ? -10 : 5),
  );
  return {
    id: String(repo.id || repo.full_name),
    name: repo.full_name || repo.name,
    description: repo.description || "",
    url: safeWebUrl(repo.html_url),
    homepage: safeWebUrl(repo.homepage),
    stars: Number(repo.stargazers_count || 0),
    forks: Number(repo.forks_count || 0),
    language: repo.language || "",
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    license,
    licenseDecision: decision,
    archived: Boolean(repo.archived),
    updatedAt,
    query,
    assetScore: Math.max(0, Math.min(100, score)),
  };
}

export function rankAssets(assets = []) {
  const seen = new Map();
  for (const asset of assets) {
    const current = seen.get(asset.id);
    if (!current || Number(asset.assetScore || 0) > Number(current.assetScore || 0)) seen.set(asset.id, asset);
  }
  return [...seen.values()].sort((a, b) => b.assetScore - a.assetScore || b.stars - a.stars);
}

export function evaluateBuildGate({ pain = {}, selectedAssets = [] } = {}) {
  const painGate = evaluatePainGate(pain);
  const blockers = [...painGate.blockers];
  if (!selectedAssets.length) blockers.push("MVPに使う公開資産が未選択");
  if (selectedAssets.some((asset) => asset.licenseDecision !== "PASS")) blockers.push("PASSライセンス以外の公開資産が含まれている");
  const decision = blockers.length ? "NO BUILD" : "GO";
  return {
    decision,
    buildAllowed: blockers.length === 0,
    blockers,
    nextAction: blockers[0] || "MVP Build Briefを作成する",
  };
}

export function makeBuildBrief({ pain = {}, selectedAssets = [] } = {}) {
  const gate = evaluateBuildGate({ pain, selectedAssets });
  const evidence = evidenceSummary(pain.evidence || []);
  const assetLines = selectedAssets.length
    ? selectedAssets.map((asset) => `- ${asset.name} | ${asset.license} | ${asset.url}`).join("\n")
    : "- 未選択";
  const evidenceLines = evidence.items.length
    ? evidence.items.map((item) => `- ${item.type} | ${item.source || "source"} | ${item.amount ? `${item.amount}円` : "金額不明"} | ${item.note || item.url}`).join("\n")
    : "- 未登録";

  return `# AI VENTURE BUILDER v0.3 — Demand-first Build Brief\n\n## 判定\n${gate.decision}\n\n## 顧客\n${text(pain.customer)}\n\n## お金が動いている悩み\n${text(pain.problem)}\n\n## 需要証拠\n${evidenceLines}\n\n## 最初に売るもの\n${text(pain.offer)}\n\n## 価格\n${Number(pain.price || 0).toLocaleString("ja-JP")}円\n\n## 販売チャネル\n${text(pain.channel)}\n\n## 最初の顧客への到達\n${text(pain.firstCustomerRoute)}\n\n## 使用する無料公開資産\n${assetLines}\n\n## MVP制約\n- 追加費用: 0円\n- 1日以内MVP: ${pain.oneDayMvp ? "YES" : "NO"}\n- AI自律稼働率: ${Number(pain.autonomyPercent || 0)}%\n\n## Kill Criteria\n${text(pain.killCriteria)}\n\n## Blockers\n${gate.blockers.length ? gate.blockers.map((item) => `- ${item}`).join("\n") : "- なし。MVP構築へ進める。"}\n`;
}

export function painId(pain = {}) {
  return `pain-${slug(pain.customer)}-${slug(pain.problem).slice(0, 36)}`;
}
