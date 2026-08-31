import {
  APP_VERSION,
  DISCOVERY_CONFIG,
  SOURCE_DEFINITIONS,
  dedupeAssets,
  filterAssets,
  makeEmptyScoutSnapshot,
  normalizeGithubItem,
} from "./src/pipeline.mjs";
import {
  composeHypothesesV2,
  createV2BuildBrief,
  createV2MarkdownReport,
  evaluateBuildGateV2,
  normalizeEvidence,
  rankHypothesesV2,
} from "./src/venture-engine-v2.mjs";

const STORAGE_KEY = "ai-venture-builder:v0.2:state";
const GITHUB_ENDPOINT = "https://api.github.com/search/repositories";
const INVENTORY_STATE_PATH = "data/inventory-state.json";
const INVENTORY_HIGHLIGHTS_PATH = "data/inventory/interesting.json";
const GITHUB_HEADERS = {
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "ai-venture-builder/0.2",
};
const STAGES = ["scout", "filter", "compose", "validate", "score", "falsify", "build", "qa"];

let state = makeInitialState();
let evidenceTargetId = null;
let running = false;
let spotlightOffset = 0;
let combinationOffset = 0;

function makeInitialState() {
  return {
    schemaVersion: APP_VERSION,
    run: { status: "idle", mode: "manual", startedAt: null, finishedAt: null },
    stages: Object.fromEntries(STAGES.map((stage) => [stage, "pending"])),
    assets: [],
    filtered: { accepted: [], review: [], excluded: [], counts: { total: 0, accepted: 0, review: 0, excluded: 0 } },
    hypotheses: [],
    evidenceByHypothesis: {},
    falsificationByHypothesis: {},
    selectedHypothesisId: null,
    stats: { total: 0, accepted: 0, review: 0, excluded: 0 },
    sourceCounts: {},
    diagnostics: [],
    logs: [],
    inventory: makeEmptyInventoryState(),
  };
}

function makeEmptyInventoryState() {
  return {
    schemaVersion: "1.0.0",
    mode: "manual-workflow",
    status: "not-run",
    cursor: { since: 0, lastId: 0, exhaustedAt: null },
    coverage: {
      batches: 0,
      cataloged: 0,
      primaryScanned: 0,
      deepScanned: 0,
      deepPending: 0,
      deepFailed: 0,
      licensePass: 0,
      licenseReview: 0,
      licenseExclude: 0,
    },
    lastRun: null,
    diagnostics: [],
    topCandidates: [],
  };
}

function mergeInventoryState(inventory) {
  const base = makeEmptyInventoryState();
  return {
    ...base,
    ...(inventory || {}),
    cursor: { ...base.cursor, ...(inventory?.cursor || {}) },
    coverage: { ...base.coverage, ...(inventory?.coverage || {}) },
    topCandidates: Array.isArray(inventory?.topCandidates) ? inventory.topCandidates : [],
  };
}

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeHref(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function formatNumber(value) {
  return new Intl.NumberFormat("ja-JP").format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "未取得";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未取得";
  return date.toLocaleDateString("ja-JP", { year: "numeric", month: "short", day: "numeric" });
}

function statusLabel(status) {
  return {
    pending: "待機",
    active: "実行中",
    done: "完了",
    warning: "要確認",
    error: "エラー",
  }[status] || status;
}

function log(message, tone = "info") {
  state.logs = [{ at: new Date().toISOString(), message, tone }, ...state.logs].slice(0, 60);
  renderLogs();
  saveState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local storage is optional. The run remains usable in private browsing.
  }
}

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved?.schemaVersion === APP_VERSION && Array.isArray(saved.assets)) {
      state = { ...makeInitialState(), ...saved, run: { ...makeInitialState().run, ...(saved.run || {}) }, inventory: mergeInventoryState(saved.inventory) };
      state.falsificationByHypothesis = saved.falsificationByHypothesis || {};
      state.filtered = filterAssets(state.assets);
      state.hypotheses = rankHypothesesV2(state.hypotheses || [], state.evidenceByHypothesis || {}, state.falsificationByHypothesis);
      if (!state.selectedHypothesisId) state.selectedHypothesisId = state.hypotheses[0]?.id || null;
      return true;
    }
  } catch {
    // Corrupt or unavailable local state is ignored.
  }
  return false;
}

function setStage(stage, status) {
  state.stages[stage] = status;
  renderStages();
}

function syncGateStages() {
  const item = state.hypotheses.length ? selectedHypothesis() : null;
  const falsification = item ? state.falsificationByHypothesis[item.id] : null;
  state.stages.falsify = falsification?.status === "complete" ? "done" : "warning";
  state.stages.build = item?.buildGate?.buildAllowed ? "done" : "warning";
}

function recomputeFromAssets({ mode = "manual", finished = true } = {}) {
  state.assets = dedupeAssets(state.assets);
  state.filtered = filterAssets(state.assets);
  state.stats = state.filtered.counts;
  state.hypotheses = rankHypothesesV2(
    composeHypothesesV2(state.filtered.accepted, 20),
    state.evidenceByHypothesis,
    state.falsificationByHypothesis,
  );
  state.sourceCounts = state.assets.reduce((counts, asset) => {
    counts[asset.source] = (counts[asset.source] || 0) + 1;
    return counts;
  }, {});
  if (!state.selectedHypothesisId || !state.hypotheses.some((item) => item.id === state.selectedHypothesisId)) {
    state.selectedHypothesisId = state.hypotheses[0]?.id || null;
  }
  state.run.mode = mode;
  if (finished) state.run.finishedAt = new Date().toISOString();
  renderAll();
  saveState();
}

async function runBrowserScout() {
  if (running) return;
  running = true;
  const button = $("#runButton");
  button.disabled = true;
  const inventory = state.inventory;
  state = makeInitialState();
  state.inventory = inventory;
  state.run.status = "running";
  state.run.mode = "browser-github";
  state.run.startedAt = new Date().toISOString();
  setStage("scout", "active");
  renderAll();
  log("SCOUTを開始。ブラウザ安全なGitHub公開APIだけを使用します。");
  log("GitLab / Hugging FaceはCLIまたはworkflow_dispatchで追加できます。", "warning");

  const rawAssets = [];
  let errors = 0;
  for (let index = 0; index < DISCOVERY_CONFIG.github.length; index += 1) {
    const query = DISCOVERY_CONFIG.github[index];
    const url = new URL(GITHUB_ENDPOINT);
    url.searchParams.set("q", query.q);
    url.searchParams.set("sort", "stars");
    url.searchParams.set("order", "desc");
    url.searchParams.set("per_page", "10");
    try {
      const response = await fetch(url, { headers: GITHUB_HEADERS });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.message || `HTTP ${response.status}`);
      const items = Array.isArray(body.items) ? body.items : [];
      rawAssets.push(...items.map((item) => normalizeGithubItem(item, query)));
      log(`GitHub ${index + 1}/${DISCOVERY_CONFIG.github.length}: ${query.q} → ${items.length}件`);
      renderRunCounter(rawAssets.length);
    } catch (error) {
      errors += 1;
      log(`GitHub ${query.q} を取得できませんでした: ${error.message}`, "error");
    }
  }

  state.assets = rawAssets;
  setStage("scout", "done");
  setStage("filter", "active");
  log(`SCOUT完了。取得 ${formatNumber(rawAssets.length)}件。`);
  state.run.status = errors ? "completed-with-warnings" : "completed";
  state.diagnostics = errors ? [{ status: "error", count: errors }] : [];
  state.stats.total = rawAssets.length;
  renderAll();

  setStage("filter", "done");
  setStage("compose", "active");
  recomputeFromAssets({ mode: "browser-github", finished: false });
  setStage("compose", "done");
  setStage("validate", "warning");
  setStage("score", "done");
  setStage("falsify", "warning");
  setStage("build", "warning");
  setStage("qa", "pending");
  state.run.finishedAt = new Date().toISOString();
  renderAll();
  saveState();
  log(state.hypotheses.length ? "仮説を生成しました。市場証拠と強制反証が終わるまでBuildしません。" : "採用可能なライセンス済み資産が不足しています。NO BUILDです。", state.hypotheses.length ? "info" : "warning");
  button.disabled = false;
  running = false;
}

async function loadSnapshot() {
  try {
    const response = await fetch(`data/latest-scout.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const snapshot = await response.json();
    if (!Array.isArray(snapshot.assets)) throw new Error("assetsがありません");
    const inventory = state.inventory;
    state = makeInitialState();
    state.inventory = inventory;
    state.assets = snapshot.assets;
    state.run = {
      status: snapshot.mode === "dry-run" ? "dry-run" : "loaded",
      mode: snapshot.mode || "manual-cli",
      startedAt: snapshot.startedAt || null,
      finishedAt: snapshot.fetchedAt || null,
    };
    state.diagnostics = snapshot.diagnostics || [];
    state.logs = [{ at: new Date().toISOString(), message: `保存済みスナップショットを読み込み: ${formatNumber(state.assets.length)}件`, tone: "info" }];
    state.stages = Object.fromEntries(STAGES.map((stage) => [stage, "done"]));
    state.stages.validate = "warning";
    state.stages.falsify = "warning";
    state.stages.build = "warning";
    state.stages.qa = "pending";
    recomputeFromAssets({ mode: snapshot.mode || "manual-cli" });
    setToast(`保存済みデータ ${formatNumber(state.assets.length)}件を読み込みました。`);
    log("市場検証は自動で捏造せず、証拠登録待ちにしています。");
  } catch (error) {
    setToast("保存済みデータを読み込めませんでした。HTTPサーバー経由で開いてください。", "error");
    log(`スナップショット読み込み失敗: ${error.message}`, "error");
  }
}

async function loadInventorySnapshot({ silent = false } = {}) {
  try {
    const [stateResponse, highlightsResponse] = await Promise.all([
      fetch(`${INVENTORY_STATE_PATH}?ts=${Date.now()}`, { cache: "no-store" }),
      fetch(`${INVENTORY_HIGHLIGHTS_PATH}?ts=${Date.now()}`, { cache: "no-store" }),
    ]);
    if (!stateResponse.ok) throw new Error(`HTTP ${stateResponse.status}`);
    const snapshot = await stateResponse.json();
    let topCandidates = Array.isArray(snapshot.topCandidates) ? snapshot.topCandidates : [];
    if (highlightsResponse.ok) {
      const highlights = await highlightsResponse.json();
      if (Array.isArray(highlights.candidates)) topCandidates = highlights.candidates;
    }
    state.inventory = mergeInventoryState({ ...snapshot, topCandidates });
    renderAll();
    saveState();
    if (!silent) {
      const count = state.inventory.coverage.cataloged || 0;
      setToast(`FULL INVENTORYの進捗を読み込みました。棚卸し ${formatNumber(count)}件。`);
      log("FULL INVENTORYの保存済み進捗を読み込みました。");
    }
  } catch (error) {
    if (!silent) {
      setToast("インベントリを読み込めませんでした。公開PagesまたはHTTPサーバー経由で開いてください。", "error");
      log(`FULL INVENTORY読み込み失敗: ${error.message}`, "error");
    }
  }
}

function addEvidence(hypothesisId, formData) {
  const type = String(formData.get("type") || "price");
  const url = String(formData.get("url") || "").trim();
  const note = String(formData.get("note") || "").trim();
  if (!note && !url) {
    setToast("URLまたはメモを1つ入力してください。", "error");
    return;
  }
  const evidence = normalizeEvidence({
    id: `evidence-${Date.now()}`,
    type,
    url,
    note,
    addedAt: new Date().toISOString(),
  });
  if (url && !evidence.url) {
    setToast("URLはhttpまたはhttpsから始めてください。", "error");
    return;
  }
  const current = state.evidenceByHypothesis[hypothesisId] || [];
  state.evidenceByHypothesis[hypothesisId] = [...current, evidence];
  state.hypotheses = rankHypothesesV2(state.hypotheses, state.evidenceByHypothesis, state.falsificationByHypothesis);
  renderAll();
  saveState();
  setToast("市場証拠を登録しました。スコアを更新しました。");
  log(`証拠を追加: ${hypothesisId} / ${evidence.type}`);
}

function selectedHypothesis() {
  const ranked = rankHypothesesV2(state.hypotheses, state.evidenceByHypothesis, state.falsificationByHypothesis);
  return ranked.find((item) => item.id === state.selectedHypothesisId) || ranked[0] || null;
}

function renderRunCounter(rawCount) {
  const el = $("#liveCounter");
  if (el) el.textContent = `${formatNumber(rawCount)}件取得`;
}

function renderStages() {
  $all("[data-stage]").forEach((element) => {
    const stage = element.dataset.stage;
    const status = state.stages[stage] || "pending";
    element.dataset.status = status;
    const statusElement = element.querySelector(".stage-status");
    if (statusElement) statusElement.textContent = statusLabel(status);
  });
}

function renderStats() {
  const values = {
    assetCount: state.stats.total,
    acceptedCount: state.stats.accepted,
    reviewCount: state.stats.review,
    hypothesisCount: state.hypotheses.length,
    evidenceCount: Object.values(state.evidenceByHypothesis).reduce((sum, list) => sum + list.length, 0),
  };
  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = formatNumber(value);
  });
  const mode = $("#runMode");
  if (mode) mode.textContent = state.run.status === "idle" ? "待機中" : `${state.run.mode} / ${state.run.status}`;
  const lastRun = $("#lastRun");
  if (lastRun) lastRun.textContent = state.run.finishedAt ? formatDate(state.run.finishedAt) : "未実行";
  const sourceList = $("#sourceList");
  if (sourceList) {
    const knownNames = new Set(SOURCE_DEFINITIONS.map((source) => source.name));
    const entries = [...SOURCE_DEFINITIONS.map((source) => [source.name, state.sourceCounts[source.name] || 0]), ...Object.entries(state.sourceCounts).filter(([source]) => !knownNames.has(source))];
    sourceList.innerHTML = entries.map(([source, count]) => `<span class="source-chip"><span>${escapeHtml(source)}</span><b>${count ? formatNumber(count) : "—"}</b></span>`).join("");
  }
}

function discoveryScore(asset) {
  const stars = Number(asset.stars || asset.likes || 0);
  return Number(asset.assetScore || 0) * 2 + Number(asset.freeScore || 0) + Math.min(12, Math.log10(stars + 1) * 2);
}

function getDiscoveryAssets() {
  return state.filtered.accepted
    .slice()
    .sort((a, b) => discoveryScore(b) - discoveryScore(a))
    .slice(0, 12);
}

function assetInterestingReason(asset) {
  const category = lower(`${asset.category} ${asset.description} ${asset.name}`);
  if (/document|ocr|pdf|word|excel/.test(category)) return "読みにくい文書を、検索・抽出・確認できる形へ変えやすい資産です。";
  if (/data|csv|json|dataset|statistics|job/.test(category)) return "公開データを集めるだけでなく、比較・検査・差分化へつなげやすい資産です。";
  if (/monitor|rss|feed|alert|watch/.test(category)) return "更新を待つ作業を、差分検知や通知という継続価値へ変えやすい資産です。";
  if (/scrap|parser|extract|crawler|html/.test(category)) return "ばらばらの公開情報を、特定業務用の一覧やレポートへ変換しやすい資産です。";
  if (/automat|workflow|browser|robot|task/.test(category)) return "人が繰り返す操作を、無料環境で再現可能な手順へ落とし込みやすい資産です。";
  if (/speech|translation|model|nlp|vision|embedding|ai/.test(category)) return "AI機能そのものを売るのではなく、特定作業の前後工程と組み合わせやすい資産です。";
  if (/license|compliance|audit|accessib|security/.test(category)) return "見落としやすい確認作業を、証跡付きの一次チェックに変えやすい資産です。";
  return "単体販売ではなく、公開データや業務フローと組み合わせて用途を作りやすい資産です。";
}

function assetBuildIdeas(asset) {
  const category = lower(`${asset.category} ${asset.description} ${asset.name}`);
  if (/document|ocr|pdf|word|excel/.test(category)) return ["公開PDFの実務項目抽出", "文書納品前の抜け漏れチェック"];
  if (/data|csv|json|dataset|statistics|job/.test(category)) return ["公開データの比較レポート", "CSV取込前の品質プレフライト"];
  if (/monitor|rss|feed|alert|watch/.test(category)) return ["業界別の変更アラート", "募集・制度の締切ウォッチ"];
  if (/scrap|parser|extract|crawler|html/.test(category)) return ["公開情報の業務別ショートリスト", "求人・価格・制度の差分抽出"];
  if (/automat|workflow|browser|robot|task/.test(category)) return ["小規模事業者向け自動化診断", "定型作業の無料ワークフロー化"];
  if (/speech|translation|model|nlp|vision|embedding|ai/.test(category)) return ["AI納品物の品質チェック", "日本語データの分類・要約パック"];
  if (/license|compliance|audit|accessib|security/.test(category)) return ["OSS商用利用前レポート", "小規模サイトの一次監査"];
  return ["公開情報の実務ブリーフ", "特定業務の確認・整理ツール"];
}

function renderDiscoveryLab() {
  const spotlight = $("#spotlightGrid");
  const combinations = $("#combinationGrid");
  if (!spotlight || !combinations) return;
  const assets = getDiscoveryAssets();
  if (!assets.length) {
    spotlight.innerHTML = `<div class="empty-state compact-empty"><span class="empty-mark">✦</span><strong>探索後に注目資産が表示されます</strong><p>「探索を開始」または保存済みデータを読み込んでください。</p></div>`;
    combinations.innerHTML = `<div class="empty-state compact-empty"><p>資産を2つ以上確認すると、組み合わせ案が表示されます。</p></div>`;
    const counter = $("#combinationCounter");
    if (counter) counter.textContent = "—";
    return;
  }
  const visible = [0, 1, 2].map((step) => assets[(spotlightOffset + step) % assets.length]);
  spotlight.innerHTML = visible.map((asset, index) => {
    const ideas = assetBuildIdeas(asset);
    const statusClass = asset.licenseDecision === "PASS" ? "pass" : "review";
    return `<article class="spotlight-card ${index === 0 ? "spotlight-featured" : ""}">
      <div class="spotlight-top"><span class="spotlight-no">0${index + 1}</span><span class="source-label">${escapeHtml(asset.source)}</span><span class="license-pill ${statusClass}">${escapeHtml(asset.licenseLabel || "LICENSE_REVIEW_REQUIRED")}</span></div>
      <h3><a href="${safeHref(asset.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(asset.name)}</a></h3>
      <p class="spotlight-description">${escapeHtml(asset.description || "公開資産")}</p>
      <p class="spotlight-reason"><b>面白い理由</b>${escapeHtml(assetInterestingReason(asset))}</p>
      <div class="idea-chips"><span>作れそう：</span>${ideas.map((idea) => `<em>${escapeHtml(idea)}</em>`).join("")}</div>
      <div class="meta-line"><span>${escapeHtml(asset.category)}</span><span>★ ${formatNumber(asset.stars || asset.likes || 0)}</span><span>free ${Number(asset.freeScore || 0)}/20</span></div>
    </article>`;
  }).join("");

  const pairCandidates = [];
  for (let first = 0; first < assets.length; first += 1) {
    for (let second = first + 1; second < assets.length; second += 1) {
      const left = assets[first];
      const right = assets[second];
      if (lower(left.category) === lower(right.category)) continue;
      const score = discoveryScore(left) + discoveryScore(right);
      pairCandidates.push({ left, right, score });
    }
  }
  pairCandidates.sort((a, b) => b.score - a.score);
  const pair = pairCandidates[combinationOffset % Math.max(pairCandidates.length, 1)];
  const counter = $("#combinationCounter");
  if (!pair) {
    combinations.innerHTML = `<div class="empty-state compact-empty"><p>異なる用途の資産がまだ見つかりません。</p></div>`;
    if (counter) counter.textContent = "0案";
    return;
  }
  if (counter) counter.textContent = `${(combinationOffset % pairCandidates.length) + 1} / ${pairCandidates.length}案`;
  const leftCategory = lower(pair.left.category);
  const rightCategory = lower(pair.right.category);
  let title = "公開情報の確認・整理プレフライト";
  let output = "2つの資産を組み合わせ、特定ユーザー向けの入力→判定→レポートにする";
  if (/data|csv|json|dataset/.test(leftCategory) && /monitor|rss|feed/.test(rightCategory) || /data|csv|json|dataset/.test(rightCategory) && /monitor|rss|feed/.test(leftCategory)) {
    title = "更新差分つき公開データ・アラート";
    output = "公開データの変化だけを抽出し、対象業界向けの短い通知にする";
  } else if (/document|pdf|ocr/.test(leftCategory) || /document|pdf|ocr/.test(rightCategory)) {
    title = "公開文書の実務チェックレポート";
    output = "文書から必要項目を抜き出し、確認漏れと次の行動をレポートにする";
  } else if (/automat|workflow|browser/.test(leftCategory) || /automat|workflow|browser/.test(rightCategory)) {
    title = "小規模事業者向け無料自動化パック";
    output = "繰り返し作業を、導入手順つきの小さなワークフローへ変える";
  }
  combinations.innerHTML = `<article class="combination-card"><div class="combination-assets"><a href="${safeHref(pair.left.url)}" target="_blank" rel="noreferrer noopener"><span>資産A</span><b>${escapeHtml(pair.left.name)}</b><em>${escapeHtml(pair.left.licenseLabel || "LICENSE_REVIEW_REQUIRED")}</em></a><span class="combination-plus">＋</span><a href="${safeHref(pair.right.url)}" target="_blank" rel="noreferrer noopener"><span>資産B</span><b>${escapeHtml(pair.right.name)}</b><em>${escapeHtml(pair.right.licenseLabel || "LICENSE_REVIEW_REQUIRED")}</em></a></div><div class="combination-arrow">↓</div><div class="combination-result"><small>仮説</small><h4>${escapeHtml(title)}</h4><p>${escapeHtml(output)}</p><span>まずは静的な入力・判定・レポートで、支払意欲を検証する</span></div></article>`;
}

function inventoryStatusLabel(status) {
  return {
    "not-run": "未実行",
    running: "実行中",
    paused: "次回へ継続",
    "paused-rate-limit": "レート制限で一時停止",
    complete: "現在地点まで完了",
    "dry-run": "ドライラン",
    error: "エラー（進捗保存済み）",
  }[status] || status || "未実行";
}

function renderInventory() {
  const panel = $("#inventoryPanel");
  if (!panel) return;
  const inventory = mergeInventoryState(state.inventory);
  state.inventory = inventory;
  const coverage = inventory.coverage;
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  setText("inventoryStatus", inventoryStatusLabel(inventory.status));
  setText("inventoryCataloged", formatNumber(coverage.cataloged));
  setText("inventoryPrimary", formatNumber(coverage.primaryScanned));
  setText("inventoryDeep", formatNumber(coverage.deepScanned));
  setText("inventoryPending", formatNumber(coverage.deepPending));
  setText("inventoryCursor", `作成順ID #${formatNumber(inventory.cursor.lastId || inventory.cursor.since || 0)}`);
  setText("inventoryLastRun", inventory.lastRun?.finishedAt ? formatDate(inventory.lastRun.finishedAt) : "未実行");
  setText("inventoryHighlightCount", `${formatNumber(inventory.topCandidates.length)}件`);
  const message = $("#inventoryMessage");
  if (message) {
    if (inventory.status === "not-run") message.textContent = "Actions画面で「Run workflow」を押すと、次のバッチを手動実行できます。";
    else if (inventory.status === "paused-rate-limit") message.textContent = "GitHub APIのレート制限で停止しました。時間を置いて同じworkflowを再実行すると続きから再開します。";
    else if (coverage.deepPending) message.textContent = `一次判定は${formatNumber(coverage.primaryScanned)}件完了。深掘り待ちは${formatNumber(coverage.deepPending)}件です。`;
    else message.textContent = `前回の手動実行: ${formatDate(inventory.lastRun?.finishedAt)}。cursorから続きます。`;
  }
  const list = $("#inventoryHighlights");
  if (!list) return;
  const candidates = inventory.topCandidates.slice(0, 6);
  if (!candidates.length) {
    list.innerHTML = `<div class="empty-state compact-empty"><strong>まだ深掘り候補はありません</strong><p>GitHub ActionsでFULL INVENTORY / DEEP SCOUTを実行すると、ここに表示されます。</p></div>`;
    return;
  }
  list.innerHTML = candidates.map((candidate, index) => {
    const statusClass = candidate.licenseDecision === "PASS" ? "pass" : candidate.licenseDecision === "EXCLUDE" ? "exclude" : "review";
    const reasons = Array.isArray(candidate.primaryReasons) ? candidate.primaryReasons.slice(0, 3) : [];
    const directions = Array.isArray(candidate.buildDirections) ? candidate.buildDirections.slice(0, 2) : [];
    return `<article class="inventory-highlight-card">
      <div class="inventory-highlight-top"><span class="spotlight-no">0${index + 1}</span><span class="source-label">DEEP SCOUT</span><span class="license-pill ${statusClass}">${escapeHtml(candidate.licenseLabel || "LICENSE_REVIEW_REQUIRED")}</span></div>
      <h3><a href="${safeHref(candidate.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(candidate.fullName || candidate.name)}</a></h3>
      <p>${escapeHtml(candidate.description || "説明なし。READMEと利用条件を確認してください。")}</p>
      <div class="meta-line"><span>${escapeHtml(candidate.category || "other")}</span><span>★ ${formatNumber(candidate.stars || 0)}</span><span>deep ${Number(candidate.deepScore ?? candidate.primaryScore ?? 0).toFixed(1)}</span></div>
      <div class="inventory-highlight-copy"><b>注目理由</b><span>${escapeHtml(reasons.join(" / ") || "深掘り済み候補")}</span><b>作れそう</b><span>${escapeHtml(directions.join(" / ") || "用途を組み合わせて検討")}</span></div>
    </article>`;
  }).join("");
}

function renderAssets() {
  const list = $("#assetList");
  if (!list) return;
  const query = String($("#assetSearch")?.value || "").toLowerCase().trim();
  const license = $("#assetLicense")?.value || "all";
  const items = state.assets.filter((asset) => {
    const matchesQuery = !query || lower(`${asset.name} ${asset.description} ${asset.category} ${asset.source}`).includes(query);
    const matchesLicense = license === "all" || asset.licenseDecision === license;
    return matchesQuery && matchesLicense;
  }).slice(0, 80);
  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-mark">◎</span><strong>探索データがありません</strong><p>「探索を開始」または保存済みスナップショットを読み込んでください。</p></div>`;
    return;
  }
  list.innerHTML = items.map((asset) => {
    const statusClass = asset.licenseDecision === "PASS" ? "pass" : asset.licenseDecision === "REVIEW" ? "review" : "exclude";
    return `<article class="asset-row">
      <div class="asset-main">
        <div class="row-top"><span class="source-label">${escapeHtml(asset.source)}</span><span class="license-pill ${statusClass}">${escapeHtml(asset.licenseLabel || "NO_LICENSE")}</span></div>
        <h3><a href="${safeHref(asset.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(asset.name)}</a></h3>
        <p>${escapeHtml(asset.description)}</p>
        <div class="meta-line"><span>${escapeHtml(asset.category)}</span><span>★ ${formatNumber(asset.stars || asset.likes || 0)}</span><span>更新 ${formatDate(asset.lastActivityAt || asset.updatedAt)}</span></div>
      </div>
      <div class="asset-score"><small>asset fit</small><strong>${Number(asset.assetScore || 0).toFixed(1)}</strong><span>free ${Number(asset.freeScore || 0)}/20</span></div>
    </article>`;
  }).join("");
}

function renderHypotheses() {
  const list = $("#hypothesisList");
  if (!list) return;
  const items = rankHypothesesV2(state.hypotheses, state.evidenceByHypothesis, state.falsificationByHypothesis);
  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-mark">△</span><strong>仮説はまだありません</strong><p>商用利用条件が明確な資産が必要です。要確認ライセンスはBuild対象から除外しています。</p></div>`;
    return;
  }
  list.innerHTML = items.map((item) => {
    const selected = item.id === state.selectedHypothesisId;
    const status = item.demandEvidenceCount ? `${item.demandEvidenceCount}件の証拠` : "市場検証待ち";
    const scoreClass = item.score >= 75 ? "high" : item.score >= 60 ? "mid" : "low";
    return `<article class="hypothesis-card ${selected ? "selected" : ""}" data-hypothesis="${escapeHtml(item.id)}">
      <button class="card-select" data-action="select" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title)}を選択">
        <span class="rank-badge">${String(item.rank).padStart(2, "0")}</span>
        <span class="card-headline"><span class="eyebrow">${escapeHtml(item.channel)} · ${escapeHtml(item.scoreLabel)}</span><h3>${escapeHtml(item.title)}</h3></span>
        <span class="score-badge ${scoreClass}"><small>SCORE</small><b>${Number(item.score).toFixed(1)}</b></span>
      </button>
      <div class="hypothesis-body">
        <p class="problem-line">${escapeHtml(item.problem)}</p>
        <div class="card-grid"><div><small>顧客</small><strong>${escapeHtml(item.customer)}</strong></div><div><small>収益</small><strong>${escapeHtml(item.model)}</strong></div><div><small>自律稼働率</small><strong>${item.autonomyPercent}%</strong></div><div><small>証拠</small><strong>${escapeHtml(status)}</strong></div></div>
        <div class="asset-pills">${item.assets.map((asset) => `<a href="${safeHref(asset.url)}" target="_blank" rel="noreferrer noopener">${escapeHtml(asset.name)}</a>`).join("")}</div>
        <div class="card-actions"><button class="text-button" data-action="evidence" data-id="${escapeHtml(item.id)}">＋ 市場証拠を追加</button><button class="text-button" data-action="brief" data-id="${escapeHtml(item.id)}">Build Briefを見る</button></div>
      </div>
    </article>`;
  }).join("");
}

function renderBuildPanel() {
  const panel = $("#buildPanel");
  if (!panel) return;
  const item = selectedHypothesis();
  if (!item) {
    panel.innerHTML = `<div class="build-empty"><span class="build-icon">✦</span><h2>Build Gate</h2><p>市場検証を通過した候補をここに表示します。</p><span class="gate-state">NO BUILD</span></div>`;
    return;
  }
  const gate = item.buildGate || evaluateBuildGateV2(item, item.evidence || [], state.falsificationByHypothesis[item.id] || {});
  const falsification = state.falsificationByHypothesis[item.id] || {};
  const decision = gate.decision;
  const gateText = gate.blockers.length ? `停止理由: ${gate.blockers.join(" / ")}` : "必須条件を通過。反証と受け入れ条件を確認してから構築へ。";
  const blockers = gate.blockers.length ? `<div class="guard-note"><span>!</span><p>${escapeHtml(gateText)}</p></div>` : "";
  panel.innerHTML = `<div class="build-kicker">BUILD GATE · ${escapeHtml(decision)}</div>
    <h2>${escapeHtml(item.title)}</h2><p class="build-lede">${escapeHtml(gateText)}</p>
    <div class="build-score"><span>現在のScore</span><strong>${Number(item.score).toFixed(1)}</strong><small>/ 100</small></div>
    <div class="brief-block"><small>MVPの出力</small><strong>${escapeHtml(item.output || "成果物を定義してください")}</strong><span>${escapeHtml(item.combinationReason || "公開資産の組み合わせ")}</span></div>
    <div class="brief-block"><small>最初の収益化</small><strong>${escapeHtml(item.model)}</strong><span>${escapeHtml(item.channel)} · ${escapeHtml(item.priceHypothesis || "価格検証")}</span></div>
    <div class="brief-block"><small>最大リスク</small><strong>${escapeHtml(item.risk)}</strong></div>
    <div class="brief-block"><small>Kill Criteria</small><strong>${escapeHtml(item.killCriteria)}</strong></div>
    ${blockers}
    <div class="brief-block"><small>強制反証</small><strong>${falsification.status === "complete" ? "確認済み" : "未完了"}</strong><span>${falsification.note ? escapeHtml(falsification.note) : "無料代替・規約・法律・維持負担を確認してください"}</span></div>
    <div class="build-assets"><small>使用資産</small>${item.assets.map((asset) => `<a href="${safeHref(asset.url)}" target="_blank" rel="noreferrer noopener"><span>${escapeHtml(asset.name)}</span><em>${escapeHtml(asset.licenseLabel || "LICENSE_REVIEW_REQUIRED")}</em></a>`).join("")}</div>
    <div class="build-actions"><button class="primary-button" data-action="falsification">反証を記録</button><button class="secondary-button" data-action="download-brief">Build Briefを保存</button><button class="secondary-button" data-action="copy-brief">コピー</button></div>`;
}

function renderLogs() {
  const list = $("#logList");
  if (!list) return;
  list.innerHTML = state.logs.length
    ? state.logs.slice(0, 16).map((entry) => `<li class="log-${escapeHtml(entry.tone || "info")}"><time>${new Date(entry.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time><span>${escapeHtml(entry.message)}</span></li>`).join("")
    : `<li class="muted">実行ログはここに表示されます。</li>`;
}

function renderAll() {
  syncGateStages();
  renderStages();
  renderStats();
  renderInventory();
  renderDiscoveryLab();
  renderAssets();
  renderHypotheses();
  renderBuildPanel();
  renderLogs();
}

function lower(value) {
  return String(value || "").toLowerCase();
}

function setToast(message, tone = "info") {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.dataset.tone = tone;
  toast.classList.add("visible");
  window.clearTimeout(setToast.timer);
  setToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 3200);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function currentBrief() {
  const selected = selectedHypothesis();
  return createV2BuildBrief(selected, {
    totalAssets: state.stats.total,
    acceptedAssets: state.stats.accepted,
    reviewAssets: state.stats.review,
  }, selected ? state.falsificationByHypothesis[selected.id] : {});
}

function openEvidenceDialog(hypothesisId) {
  evidenceTargetId = hypothesisId;
  const item = state.hypotheses.find((candidate) => candidate.id === hypothesisId);
  const title = $("#evidenceTitle");
  if (title) title.textContent = item ? item.title : "市場証拠";
  const dialog = $("#evidenceDialog");
  if (dialog?.showModal) dialog.showModal();
}

function openFalsificationDialog(hypothesisId) {
  evidenceTargetId = hypothesisId;
  const item = state.hypotheses.find((candidate) => candidate.id === hypothesisId);
  const title = $("#falsificationTitle");
  if (title) title.textContent = item ? item.title : "強制反証";
  const dialog = $("#falsificationDialog");
  if (dialog?.showModal) dialog.showModal();
}

function addFalsification(hypothesisId, formData) {
  const checks = ["freeAlternative", "bigTech", "terms", "legal", "maintenance"];
  const allChecked = checks.every((name) => formData.get(name) === "on");
  const note = String(formData.get("note") || "").trim();
  if (!allChecked || !note) {
    setToast("5項目すべてを確認し、反証メモを入力してください。", "error");
    return false;
  }
  state.falsificationByHypothesis[hypothesisId] = {
    status: "complete",
    checkedAt: new Date().toISOString(),
    strongCounterarguments: Number(formData.get("strongCounterarguments") || 0),
    note,
  };
  state.hypotheses = rankHypothesesV2(state.hypotheses, state.evidenceByHypothesis, state.falsificationByHypothesis);
  renderAll();
  saveState();
  setToast("強制反証を記録しました。Build Gateを更新しました。");
  log(`強制反証を記録: ${hypothesisId}`);
  return true;
}

function attachEvents() {
  $("#runButton")?.addEventListener("click", runBrowserScout);
  $("#loadSnapshotButton")?.addEventListener("click", loadSnapshot);
  $("#loadInventoryButton")?.addEventListener("click", () => loadInventorySnapshot());
  $("#exportJsonButton")?.addEventListener("click", () => downloadFile("venture-builder-snapshot.json", JSON.stringify(state, null, 2), "application/json"));
  $("#exportReportButton")?.addEventListener("click", () => downloadFile("venture-builder-report-v0.2.md", createV2MarkdownReport(state), "text/markdown;charset=utf-8"));
  $("#resetButton")?.addEventListener("click", () => {
    if (!window.confirm("この端末に保存した探索結果を削除しますか？")) return;
    const inventory = state.inventory;
    state = makeInitialState();
    state.inventory = inventory;
    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    setToast("ローカル保存データを削除しました。");
  });
  $("#assetSearch")?.addEventListener("input", renderAssets);
  $("#assetLicense")?.addEventListener("change", renderAssets);
  $("#spotlightNext")?.addEventListener("click", () => {
    spotlightOffset += 1;
    renderDiscoveryLab();
  });
  $("#combinationNext")?.addEventListener("click", () => {
    combinationOffset += 1;
    renderDiscoveryLab();
  });
  $("#evidenceForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    addEvidence(evidenceTargetId, new FormData(event.currentTarget));
    event.currentTarget.reset();
    $("#evidenceDialog")?.close();
  });
  $("#cancelEvidence")?.addEventListener("click", () => $("#evidenceDialog")?.close());
  $("#cancelEvidence2")?.addEventListener("click", () => $("#evidenceDialog")?.close());
  $("#falsificationForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (addFalsification(evidenceTargetId, new FormData(event.currentTarget))) {
      event.currentTarget.reset();
      $("#falsificationDialog")?.close();
    }
  });
  $("#cancelFalsification")?.addEventListener("click", () => $("#falsificationDialog")?.close());
  document.addEventListener("click", (event) => {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;
    const id = actionTarget.dataset.id;
    if (action === "select" || action === "brief") {
      state.selectedHypothesisId = id;
      renderAll();
      saveState();
      if (action === "brief") $("#buildPanel")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (action === "evidence") openEvidenceDialog(id);
    if (action === "falsification") openFalsificationDialog(state.selectedHypothesisId);
    if (action === "download-brief") downloadFile("mvp-build-brief.md", currentBrief(), "text/markdown;charset=utf-8");
    if (action === "copy-brief") {
      const copyPromise = navigator.clipboard?.writeText(currentBrief());
      if (!copyPromise) {
        setToast("コピーできませんでした。保存ボタンを使ってください。", "error");
      } else {
        copyPromise.then(() => setToast("Build Briefをコピーしました."), () => setToast("コピーできませんでした。保存ボタンを使ってください。", "error"));
      }
    }
  });
}

async function init() {
  loadLocalState();
  attachEvents();
  renderAll();
  if (!state.assets.length) {
    const snapshot = makeEmptyScoutSnapshot();
    if (snapshot.assets.length) state.assets = snapshot.assets;
  }
  await loadInventorySnapshot({ silent: true });
}

init();
