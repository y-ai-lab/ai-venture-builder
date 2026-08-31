import { dedupeAssets, slug } from "./pipeline.mjs";

export const ENGINE_VERSION = "0.2.0";

export const STEP_AUTO = "完全自動";
export const STEP_SEMI = "半自動";
export const STEP_HUMAN = "人間必須";

const ROLE_PATTERNS = {
  document: /\b(document|ocr|pdf|word|excel|text|markdown)\b/,
  data: /\bdata\b|csv|json|dataset|database|statistics|job|open data/,
  parsing: /\b(parser|parse|scrap|extract|crawler|html|etl)\b/,
  monitoring: /\b(rss|feed|monitor|alert|watch|notification|change)\b/,
  automation: /\b(automat|workflow|browser|robot|task|agent)\w*/,
  ai: /\b(ai|model|ocr|speech|translation|machine|nlp|vision|embedding)\b/,
  transcription: /\b(transcri|speech|speaker|diariz|subtitle|caption|voice|audio)\w*/,
  media: /\b(image|video|audio|media|metadata)\b/,
  search: /\b(search|index|retriev|elastic|vector|knowledge base)\w*/,
  knowledge: /\b(knowledge|markdown|wiki|document|note|search|report)\w*/,
  license: /\blicense\b|spdx|sbom|compliance|policy/,
  compliance: /\b(audit|security|policy|accessibility|wcag)\w*/,
  accessibility: /\b(accessib|a11y|wcag)\w*/,
};

const AUTONOMY_DEFAULT = {
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

export const VENTURE_ARCHETYPES = [
  {
    id: "transcript-qa",
    title: "日本語文字起こし納品QA",
    customer: "文字起こしを販売する個人・小規模制作会社",
    problem: "AI文字起こしの誤変換・話者・ケバ・不明箇所を納品前に確認する負担",
    output: "原稿の確認箇所、納品前チェックリスト、Markdown/JSONレポート",
    model: "One-time digital product / B2B Tool",
    channel: "ココナラ",
    roles: ["transcription", "transcription", "transcription"],
    monetization: 13,
    speed: 9,
    advantage: 8,
    difficulty: 2,
    support: 2,
    scale: 4,
    risk: "音声との一致・専門用語・法的品質を自動保証できない",
    kill: "7日で訪問50件に対して問い合わせ0件、または30日で有料注文0件なら停止",
    reason: "ローカル音声認識・話者分離・納品前の日本語QAを別工程として組み合わせる",
  },
  {
    id: "csv-quality-preflight",
    title: "CSVデータ品質プレフライト",
    customer: "小規模チーム・データ担当者",
    problem: "CSV/Excelの欠損・重複・型崩れを納品や取込前に見落とす",
    output: "端末内の品質チェック、問題一覧、再現可能な修正手順",
    model: "Freemium / One-time report",
    channel: "ココナラ",
    roles: ["data", "parsing", "data"],
    monetization: 12,
    speed: 9,
    advantage: 6,
    difficulty: 2,
    support: 2,
    scale: 4,
    risk: "Excel・Power Query等の無料代替が強く、差別化が弱い",
    kill: "7日で訪問50件に対して問い合わせ0件、または有料注文0件なら停止",
    reason: "データ清掃・形式変換・見える化を、取込前の短い品質レポートへ変換する",
  },
  {
    id: "public-data-brief",
    title: "公開データ実務ブリーフ",
    customer: "中小企業・個人事業主",
    problem: "公開データが加工されておらず、判断に使いづらい",
    output: "更新差分と実務上の意味を整理した短いレポート",
    model: "One-time digital product / Paid Brief",
    channel: "Gumroad",
    roles: ["data", "knowledge"],
    monetization: 13,
    speed: 8,
    advantage: 7,
    difficulty: 3,
    support: 3,
    scale: 5,
    risk: "データごとの利用条件と更新頻度が異なる",
    kill: "10人への提示で有料予約が0件なら対象業界を変更または停止",
    reason: "公開データを収集する資産と、読み手向けに整理する資産を組み合わせる",
  },
  {
    id: "change-alert",
    title: "業界別公開情報の変更アラート",
    customer: "営業・採用・企画担当者",
    problem: "複数サイトの更新を追えず、重要な変化を見落とす",
    output: "対象を絞った新着・変更の通知一覧",
    model: "Paid Alerts / Subscription",
    channel: "note",
    roles: ["monitoring", "parsing", "knowledge"],
    monetization: 12,
    speed: 7,
    advantage: 8,
    difficulty: 4,
    support: 4,
    scale: 5,
    risk: "取得元の規約と通知のノイズ",
    kill: "7日で登録者20人未満、または有料予約0件なら対象を変更",
    reason: "更新検出・差分抽出・要約を別々の公開資産で分担する",
  },
  {
    id: "grant-shortlist",
    title: "地域事業者向け制度・補助金ショートリスト",
    customer: "個人事業主・小規模法人",
    problem: "自分に関係する制度を探せず、募集期間を逃す",
    output: "地域・業種・締切で絞った制度一覧",
    model: "Data Product / Paid Alerts",
    channel: "Gumroad",
    roles: ["data", "search", "monitoring"],
    monetization: 12,
    speed: 8,
    advantage: 8,
    difficulty: 4,
    support: 4,
    scale: 5,
    risk: "対象要件の誤読と情報更新の遅れ",
    kill: "対象者30人への提示で有料予約が2件未満なら地域または業種を絞る",
    reason: "政府データと検索・更新検知を組み合わせ、探す作業を短縮する",
  },
  {
    id: "oss-compliance",
    title: "OSS商用利用前チェックレポート",
    customer: "個人開発者・小規模チーム",
    problem: "公開コードの商用利用条件を確認するのに時間がかかる",
    output: "ライセンス根拠・依存ファイル・要確認点の一次レポート",
    model: "One-time report / B2B Tool",
    channel: "Gumroad",
    roles: ["license", "search", "knowledge"],
    monetization: 14,
    speed: 8,
    advantage: 8,
    difficulty: 3,
    support: 3,
    scale: 5,
    risk: "法律相談や利用保証と誤認される表現",
    kill: "20人の利用意向確認で支払意思が0件なら停止",
    reason: "Repository情報、ライセンス分類、確認漏れのレポート化を一つにまとめる",
  },
  {
    id: "document-cleanup",
    title: "公開PDF・文書の実務整理パック",
    customer: "調査担当・個人制作者・小規模チーム",
    problem: "長い公開文書から必要な項目を抜き出すのに時間がかかる",
    output: "項目別に整理した要点・表・確認リンク",
    model: "Service + Automation / One-time",
    channel: "ココナラ",
    roles: ["document", "parsing", "knowledge"],
    monetization: 12,
    speed: 8,
    advantage: 7,
    difficulty: 4,
    support: 5,
    scale: 4,
    risk: "資料ごとの例外処理と引用範囲",
    kill: "匿名サンプル5件で標準化できなければ作らない",
    reason: "文書抽出資産と整理・納品フォーマットを組み合わせる",
  },
  {
    id: "data-freshness",
    title: "公開データ鮮度チェッカー",
    customer: "レポート・分析資料を作る個人",
    problem: "参照したデータが古くなっていることに気づきにくい",
    output: "参照元の更新日時と差分の一覧",
    model: "Freemium / Paid Alerts",
    channel: "Gumroad",
    roles: ["data", "monitoring", "automation"],
    monetization: 11,
    speed: 7,
    advantage: 8,
    difficulty: 4,
    support: 3,
    scale: 5,
    risk: "データ源ごとの仕様変更",
    kill: "50人の試用で有料化0件なら停止",
    reason: "公開データの取得と更新検知を自動化し、手作業の確認を減らす",
  },
  {
    id: "accessibility-triage",
    title: "小規模サイトのアクセシビリティ一次診断",
    customer: "小規模サイト運営者",
    problem: "改善点はありそうだが、どこから直すか分からない",
    output: "優先順位つきの一次チェックリスト",
    model: "B2B Tool / Service",
    channel: "ココナラ",
    roles: ["accessibility", "parsing", "automation"],
    monetization: 12,
    speed: 8,
    advantage: 7,
    difficulty: 4,
    support: 5,
    scale: 4,
    risk: "法令適合や保証と誤認されること",
    kill: "10件のヒアリングで支払意思がなければ停止",
    reason: "公開ページの検査結果を、非専門家が行動できる順番へ変換する",
  },
  {
    id: "job-skill-digest",
    title: "公開求人のスキル変化ダイジェスト",
    customer: "転職準備者・研修事業者",
    problem: "求人に現れるスキルの変化を追いにくい",
    output: "職種別の頻出スキルと変化の要約",
    model: "Data Product / One-time report",
    channel: "Gumroad",
    roles: ["data", "parsing", "ai"],
    monetization: 10,
    speed: 7,
    advantage: 8,
    difficulty: 5,
    support: 4,
    scale: 5,
    risk: "求人サイトの規約と個人情報の混入",
    kill: "50人への提示で購入0件なら停止",
    reason: "公開求人の集計・分類・要約を組み合わせて変化だけを見せる",
  },
  {
    id: "local-search-kit",
    title: "ローカル検索導入キット",
    customer: "外部SaaSへ資料を置きにくい小規模チーム",
    problem: "社内資料が散らばり、必要な情報を探す時間が長い",
    output: "ローカルで検索できる導入手順と初期設定",
    model: "B2B Tool / Setup service",
    channel: "ココナラ",
    roles: ["search", "knowledge", "document"],
    monetization: 11,
    speed: 6,
    advantage: 8,
    difficulty: 5,
    support: 5,
    scale: 4,
    risk: "端末環境差と導入支援負担",
    kill: "3件の有料相談が取れなければ開発しない",
    reason: "ローカル検索資産とドキュメント整理を組み合わせ、外部送信を避ける",
  },
  {
    id: "media-rights-index",
    title: "公開画像のメタデータ・権利確認インデックス",
    customer: "素材を管理する個人・小規模チーム",
    problem: "画像が増えるほど検索と利用条件の確認が難しくなる",
    output: "メタデータと出典・確認状況の一覧",
    model: "One-time tool / Service",
    channel: "Gumroad",
    roles: ["media", "license", "data"],
    monetization: 10,
    speed: 7,
    advantage: 6,
    difficulty: 4,
    support: 4,
    scale: 4,
    risk: "権利を自動保証できない",
    kill: "匿名サンプル20件で支払意思がなければ停止",
    reason: "画像メタデータと出典情報を、確認作業用の台帳へ変換する",
  },
  {
    id: "automation-audit",
    title: "公開資産を使った業務自動化診断",
    customer: "AI導入前の個人事業主",
    problem: "自分の作業に使えるツールの選び方が分からない",
    output: "作業別の候補資産・導入手順・費用チェック",
    model: "Service + Automation / Lead Generation",
    channel: "ココナラ",
    roles: ["automation", "search", "license"],
    monetization: 13,
    speed: 9,
    advantage: 8,
    difficulty: 3,
    support: 5,
    scale: 4,
    risk: "一般論になりやすく、相談対応が増える",
    kill: "相談10件で有料化2件未満なら停止",
    reason: "自動化資産とライセンス・費用判定を結合し、導入候補を絞る",
  },
];

const EVIDENCE_ALIASES = {
  payment: "sale",
  contract: "contract",
  job: "job",
  review: "paid_review",
  complaint: "complaint",
  price: "price_displayed",
  competitor: "competitor_only",
};

export const EVIDENCE_WEIGHTS = {
  sale: 20,
  contract: 18,
  job: 15,
  paid_review: 10,
  complaint: 7,
  price_displayed: 3,
  competitor_only: 0,
};

function text(value) {
  return value == null ? "" : String(value);
}

function lower(value) {
  return text(value).toLowerCase();
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function safeDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function safeUrl(value) {
  try {
    const url = new URL(text(value).trim());
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function assetText(asset) {
  return lower([
    asset?.category,
    asset?.name,
    asset?.description,
    ...(Array.isArray(asset?.topics) ? asset.topics : []),
  ].join(" "));
}

export function assetHasRole(asset, role) {
  return Boolean(ROLE_PATTERNS[role]?.test(assetText(asset)));
}

export function zeroCostStatus(asset) {
  if (!asset) return { status: "BLOCKED", reason: "資産がありません" };
  const reasons = [];
  if (Number(asset.freeScore || 0) < 8) reasons.push("無料運用性が低い");
  if (asset.gpuRequired) reasons.push("GPU依存の可能性");
  if (asset.cloudRequired) reasons.push("クラウド/VPS依存の可能性");
  if (/api key|oauth|credential|secret|paid api/i.test(text(asset.externalApiRequirements))) reasons.push("有料または認証付きAPI依存");
  if (/landing-ai\/ade-cli|ade-cli/i.test(`${text(asset.id)} ${text(asset.name)} ${text(asset.url)}`)) reasons.push("APIキー・クレジット依存の可能性");
  return reasons.length ? { status: "REVIEW", reason: reasons.join("・") } : { status: "PASS", reason: "追加費用の必須依存を検出していない" };
}

function scoreAssetForRole(asset, role) {
  const roleFit = assetHasRole(asset, role) ? 40 : 0;
  const licenseFit = asset?.licenseDecision === "PASS" ? 25 : 0;
  const freeFit = Math.min(20, Number(asset?.freeScore || 0));
  const activityFit = asset?.archived ? 0 : asset?.lastActivityAt || asset?.updatedAt ? 10 : 2;
  const assetFit = Math.min(5, Number(asset?.assetScore || 0) / 20);
  return roleFit + licenseFit + freeFit + activityFit + assetFit;
}

function chooseCombination(pool, roles, variant = 0) {
  const used = new Set();
  const selected = [];
  for (const role of roles) {
    const candidates = pool
      .filter((asset) => !used.has(asset.id))
      .sort((a, b) => scoreAssetForRole(b, role) - scoreAssetForRole(a, role));
    const exact = candidates.filter((asset) => assetHasRole(asset, role));
    if (!exact.length) return [];
    const asset = exact[variant % exact.length] || null;
    if (asset) {
      used.add(asset.id);
      selected.push({ role, asset });
    }
  }
  return selected;
}

function buildAutonomy(archetype) {
  const steps = { ...AUTONOMY_DEFAULT };
  if (archetype.id === "local-search-kit" || archetype.id === "document-cleanup") steps.product = STEP_SEMI;
  if (archetype.id === "automation-audit" || archetype.id === "accessibility-triage") steps.analysis = STEP_SEMI;
  return steps;
}

function autonomyPercent(steps) {
  const values = Object.values(steps).map((step) => step === STEP_AUTO ? 1 : step === STEP_SEMI ? 0.5 : 0);
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100);
}

function candidateId(archetype, selected, variant) {
  const suffix = selected.map(({ asset }) => slug(asset.id || asset.name)).join("-").slice(0, 70);
  return `v2-${archetype.id}-${variant}-${suffix || "no-assets"}`;
}

export function composeHypothesesV2(assets = [], count = 20) {
  const pool = dedupeAssets(assets).filter((asset) => asset.licenseDecision === "PASS" && zeroCostStatus(asset).status !== "BLOCKED");
  if (!pool.length) return [];
  const hypotheses = [];
  const seen = new Set();
  let variant = 0;

  while (hypotheses.length < count && variant < 5) {
    for (const archetype of VENTURE_ARCHETYPES) {
      if (hypotheses.length >= count) break;
      const selected = chooseCombination(pool, archetype.roles, variant);
      const ids = selected.map(({ asset }) => asset.id).sort();
      const comboKey = `${archetype.id}:${ids.join("|")}`;
      if (!selected.length || seen.has(comboKey)) continue;
      seen.add(comboKey);
      const steps = buildAutonomy(archetype);
      const selectedAssets = selected.map(({ asset }) => asset);
      const hypothesis = {
        id: candidateId(archetype, selected, variant),
        archetypeId: archetype.id,
        title: archetype.title,
        customer: archetype.customer,
        problem: archetype.problem,
        output: archetype.output,
        model: archetype.model,
        channel: archetype.channel,
        assets: selectedAssets,
        assetIds: selectedAssets.map((asset) => asset.id),
        assetNames: selectedAssets.map((asset) => asset.name),
        assetRoles: selected.map(({ role }) => role),
        combinationReason: archetype.reason,
        differentiator: `${selectedAssets.map((asset) => asset.name).join(" + ")}を、${archetype.output}へ変換する` ,
        risk: archetype.risk,
        killCriteria: archetype.kill,
        autonomySteps: steps,
        autonomyPercent: autonomyPercent(steps),
        speedScore: archetype.speed,
        advantageScore: archetype.advantage,
        difficultyScore: archetype.difficulty,
        supportScore: archetype.support,
        scaleScore: archetype.scale,
        monetizationScore: archetype.monetization,
        firstPayment: `${archetype.channel}で${archetype.model.includes("Subscription") ? "初月登録" : "1件の有料注文"}を取る`,
        priceHypothesis: archetype.channel === "ココナラ" ? "980〜2,980円" : "500〜1,500円",
        evidence: [],
        validationStatus: "NOT_VALIDATED",
        validationQuestions: [
          `「${archetype.problem}」で直近に時間またはお金を失った人がいるか`,
          `この成果物に${archetype.channel === "ココナラ" ? "980〜2,980円" : "500〜1,500円"}を払う人がいるか`,
          "無料代替では解消できない部分を一文で説明できるか",
        ],
        order: hypotheses.length + 1,
      };
      hypotheses.push({ ...hypothesis, ...calculateHypothesisScoreV2(hypothesis, []) });
    }
    variant += 1;
  }
  return hypotheses;
}

export function normalizeEvidence(input = {}) {
  const rawType = text(input.type || "price_displayed").trim();
  const type = EVIDENCE_ALIASES[rawType] || rawType;
  const allowed = Object.prototype.hasOwnProperty.call(EVIDENCE_WEIGHTS, type);
  return {
    id: text(input.id || `evidence-${Date.now()}`),
    type: allowed ? type : "price_displayed",
    url: safeUrl(input.url),
    note: text(input.note).trim(),
    source: text(input.source || "").trim(),
    observedAt: safeDate(input.observedAt || input.addedAt) || new Date().toISOString(),
    transactionStatus: text(input.transactionStatus || "").trim(),
  };
}

function evidenceKey(item) {
  return `${item.type}:${item.url || item.note}`.toLowerCase();
}

export function scoreDemandEvidence(evidence = []) {
  const normalized = evidence.map(normalizeEvidence).filter((item) => item.url || item.note);
  const unique = [...new Map(normalized.map((item) => [evidenceKey(item), item])).values()];
  const byType = new Map();
  unique.forEach((item) => {
    const current = byType.get(item.type) || [];
    byType.set(item.type, [...current, item]);
  });
  let score = 0;
  for (const [type, items] of byType.entries()) {
    const weight = EVIDENCE_WEIGHTS[type] || 0;
    if (!weight) continue;
    score += weight;
    if (items.length > 1) score += Math.min(3, items.length - 1);
  }
  return {
    score: Math.min(20, score),
    evidence: unique,
    strongEvidence: unique.filter((item) => ["sale", "contract", "job"].includes(item.type)).length,
    weakOnly: unique.length > 0 && unique.every((item) => ["price_displayed", "competitor_only", "complaint"].includes(item.type)),
  };
}

export function calculateHypothesisScoreV2(hypothesis = {}, evidence = []) {
  const selectedAssets = hypothesis.assets || [];
  const costStatuses = selectedAssets.map(zeroCostStatus);
  const free = selectedAssets.length
    ? round(selectedAssets.reduce((sum, asset) => sum + Math.min(20, Number(asset.freeScore || 0)), 0) / selectedAssets.length / 20 * 15)
    : 0;
  const demand = scoreDemandEvidence(evidence);
  const breakdown = {
    demand: demand.score,
    free,
    autonomy: round(Number(hypothesis.autonomyPercent || 0) / 100 * 15),
    monetization: Math.min(15, Number(hypothesis.monetizationScore || 0)),
    speed: Math.min(10, Number(hypothesis.speedScore || 0)),
    advantage: Math.min(10, Number(hypothesis.advantageScore || 0)),
    difficulty: Math.max(0, 5 - Number(hypothesis.difficultyScore || 5)),
    support: Math.max(0, 5 - Number(hypothesis.supportScore || 5)),
    scale: Math.min(5, Number(hypothesis.scaleScore || 0)),
  };
  const total = round(Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  const costReview = costStatuses.some((item) => item.status !== "PASS");
  return {
    score: total,
    scoreBreakdown: breakdown,
    demandEvidenceCount: demand.evidence.length,
    demandEvidence: demand,
    freeGuardStatus: costReview ? "REVIEW" : "PASS",
    validationStatus: demand.score >= 15 ? "VALIDATED_SIGNAL" : demand.score > 0 ? "PARTIAL_SIGNAL" : "NOT_VALIDATED",
    scoreLabel: demand.score >= 10 ? "市場検証反映済み" : "市場検証待ち",
  };
}

export function evaluateBuildGateV2(hypothesis = {}, evidence = [], falsification = {}) {
  const scored = calculateHypothesisScoreV2(hypothesis, evidence);
  const blockers = [];
  const assets = hypothesis.assets || [];
  if (!assets.length) blockers.push("使用する公開資産がない");
  if (assets.some((asset) => asset.licenseDecision !== "PASS")) blockers.push("ライセンス要確認の資産が含まれている");
  if (assets.some((asset) => zeroCostStatus(asset).status !== "PASS")) blockers.push("0円運用できる構成が確認できていない");
  if (scored.demandEvidence.score < 10) blockers.push("支払い・契約・求人等の需要証拠が不足している");
  if (scored.demandEvidence.weakOnly) blockers.push("価格表示・競合・困りごとだけで、支払いに近い証拠がない");
  if (!hypothesis.customer || !hypothesis.problem || !hypothesis.model || !hypothesis.firstPayment) blockers.push("顧客・問題・収益化・初回支払いが定義されていない");
  if (falsification.status !== "complete") blockers.push("TOP5の強制反証が未完了");
  if (Number(falsification.strongCounterarguments || 0) > 0) blockers.push("強い反証が残っている");

  let decision = "NO-GO";
  if (!blockers.length && scored.score >= 80 && scored.demandEvidence.score >= 15) decision = "STRONG GO";
  else if (!blockers.length && scored.score >= 70 && scored.demandEvidence.score >= 10) decision = "GO";
  else if (!blockers.length && scored.demandEvidence.score >= 10 && assets.every((asset) => asset.licenseDecision === "PASS")) decision = "GO WITH MODIFICATION";

  return {
    decision,
    blockers,
    score: scored.score,
    scoreBreakdown: scored.scoreBreakdown,
    demandScore: scored.demandEvidence.score,
    buildAllowed: ["STRONG GO", "GO", "GO WITH MODIFICATION"].includes(decision) && blockers.length === 0,
    nextAction: blockers[0] || "MVPの受け入れ条件をテストする",
  };
}

export function rankHypothesesV2(hypotheses = [], evidenceByHypothesis = {}, falsificationByHypothesis = {}) {
  return hypotheses
    .map((hypothesis) => {
      const evidence = evidenceByHypothesis[hypothesis.id] || hypothesis.evidence || [];
      const scored = calculateHypothesisScoreV2(hypothesis, evidence);
      const gate = evaluateBuildGateV2(hypothesis, evidence, falsificationByHypothesis[hypothesis.id] || {});
      return { ...hypothesis, evidence: scored.demandEvidence.evidence, ...scored, buildGate: gate };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map((hypothesis, index) => ({ ...hypothesis, rank: index + 1 }));
}

export function createV2BuildBrief(hypothesis, scoutMeta = {}, falsification = {}) {
  if (!hypothesis) return "採用候補がありません。市場証拠と反証を確認してからBuild Gateを通してください。";
  const gate = evaluateBuildGateV2(hypothesis, hypothesis.evidence || [], falsification);
  const assets = (hypothesis.assets || []).map((asset, index) => `- ${hypothesis.assetRoles?.[index] || "component"}: ${asset.name} (${asset.licenseLabel || "LICENSE_REVIEW_REQUIRED"})\n  ${asset.url}`).join("\n");
  const evidence = (hypothesis.evidence || []).map((item) => `- ${item.type}: ${item.note || "記録あり"}${item.url ? ` — ${item.url}` : ""}`).join("\n") || "- 未登録";
  return `# ${hypothesis.title} — MVP Build Brief v0.2\n\n判定: ${gate.decision}\nScore: ${gate.score}/100\n次のアクション: ${gate.nextAction}\n\n## 顧客\n${hypothesis.customer}\n\n## 問題\n${hypothesis.problem}\n\n## MVPの出力\n${hypothesis.output}\n\n## 組み合わせの理由\n${hypothesis.combinationReason}\n\n## 差別化\n${hypothesis.differentiator}\n\n## 収益化\n${hypothesis.model}\n販売チャネル: ${hypothesis.channel}\n価格仮説: ${hypothesis.priceHypothesis}\n最初の1円: ${hypothesis.firstPayment}\n\n## 使用する公開資産\n${assets || "- なし"}\n\n## 市場証拠\n${evidence}\n\n## 強制反証\n状態: ${falsification.status || "未完了"}\n強い反証: ${Number(falsification.strongCounterarguments || 0)}件\nメモ: ${falsification.note || "無料代替・規約・法律・維持負担を確認する"}\n\n## 受け入れ条件\n- スマートフォンで3分以内に試せる\n- 成果物を1回の操作で確認または受け取れる\n- 使用資産・ライセンス・更新日時を確認できる\n- APIキー・有料サービスなしでデモできる\n- 失敗時に原因と代替手段を表示する\n\n## 自律稼働率\n${hypothesis.autonomyPercent}%\n\n## 最大リスク\n${hypothesis.risk}\n\n## Kill Criteria\n${hypothesis.killCriteria}\n\n## 探索メタデータ\n確認資産: ${scoutMeta.totalAssets || 0}件 / 採用可能: ${scoutMeta.acceptedAssets || 0}件 / 要確認: ${scoutMeta.reviewAssets || 0}件\n`;
}

export function createV2MarkdownReport(state = {}) {
  const ranked = rankHypothesesV2(state.hypotheses || [], state.evidenceByHypothesis || {}, state.falsificationByHypothesis || {});
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
    `需要証拠登録済み: ${ranked.filter((item) => item.demandEvidenceCount > 0).length}件`,
    "",
    "## TOP3",
  ];
  ranked.slice(0, 3).forEach((item) => {
    lines.push(
      `### ${item.rank}位: ${item.title}`,
      `- Score: ${item.score}/100`,
      `- Build Gate: ${item.buildGate.decision}`,
      `- 顧客: ${item.customer}`,
      `- 問題: ${item.problem}`,
      `- 収益方法: ${item.model}`,
      `- 最初の1円: ${item.firstPayment}`,
      `- AI自律稼働率: ${item.autonomyPercent}%`,
      `- 最大リスク: ${item.risk}`,
      `- 使用資産: ${item.assetNames.join(" / ")}`,
      `- Blocker: ${item.buildGate.blockers.join(" / ") || "なし"}`,
      "",
    );
  });
  const selected = ranked.find((item) => item.id === state.selectedHypothesisId) || ranked[0];
  lines.push("## 採用事業 / Build Brief", "", createV2BuildBrief(selected, {
    totalAssets: state.stats?.total || state.assets?.length || 0,
    acceptedAssets: state.stats?.accepted || 0,
    reviewAssets: state.stats?.review || 0,
  }, selected ? state.falsificationByHypothesis?.[selected.id] : {}));
  return lines.join("\n");
}
