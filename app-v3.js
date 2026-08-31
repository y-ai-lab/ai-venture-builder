import {
  VERSION,
  evaluatePainGate,
  generateAssetSearchQueries,
  normalizeEvidence,
  normalizeGithubAsset,
  rankAssets,
  evaluateBuildGate,
  makeBuildBrief,
} from "./src/paid-pain-engine.mjs";

const STORAGE_KEY = "ai-venture-builder:v0.3:demand-first";
const API = "https://api.github.com/search/repositories";
const HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "ai-venture-builder-v0.3",
};

let state = loadState() || {
  pain: {
    customer: "",
    problem: "",
    offer: "",
    price: "",
    channel: "",
    firstCustomerRoute: "",
    killCriteria: "",
    autonomyPercent: 70,
    zeroCost: true,
    oneDayMvp: true,
    solutionHint: "",
    evidence: [],
  },
  assets: [],
  selectedAssetIds: [],
  lastRun: null,
};

function $(id) { return document.getElementById(id); }
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); } catch { return null; }
}
function readPainForm() {
  state.pain = {
    ...state.pain,
    customer: $("customer").value.trim(),
    problem: $("problem").value.trim(),
    offer: $("offer").value.trim(),
    price: Number($("price").value || 0),
    channel: $("channel").value.trim(),
    firstCustomerRoute: $("firstCustomerRoute").value.trim(),
    killCriteria: $("killCriteria").value.trim(),
    autonomyPercent: Number($("autonomyPercent").value || 0),
    zeroCost: $("zeroCost").checked,
    oneDayMvp: $("oneDayMvp").checked,
    solutionHint: $("solutionHint").value.trim(),
  };
  saveState();
  render();
}
function writePainForm() {
  const p = state.pain;
  $("customer").value = p.customer || "";
  $("problem").value = p.problem || "";
  $("offer").value = p.offer || "";
  $("price").value = p.price || "";
  $("channel").value = p.channel || "";
  $("firstCustomerRoute").value = p.firstCustomerRoute || "";
  $("killCriteria").value = p.killCriteria || "";
  $("autonomyPercent").value = p.autonomyPercent ?? 70;
  $("zeroCost").checked = p.zeroCost !== false;
  $("oneDayMvp").checked = p.oneDayMvp !== false;
  $("solutionHint").value = p.solutionHint || "";
}

function renderEvidence() {
  const container = $("evidenceList");
  if (!state.pain.evidence.length) {
    container.innerHTML = `<div class="empty-state compact-empty"><strong>まだ需要証拠がありません</strong><p>最低1件の実支払い・契約証拠と、補助証拠を含め合計3件が必要です。</p></div>`;
    return;
  }
  container.innerHTML = state.pain.evidence.map((item, index) => `
    <article class="asset-card">
      <div class="asset-topline"><span class="license-badge ${["sale","contract","paid_review"].includes(item.type) ? "pass" : "review"}">${escapeHtml(item.type)}</span><button class="ghost-button remove-evidence" data-index="${index}">削除</button></div>
      <h3>${escapeHtml(item.source || "需要証拠")}</h3>
      <p>${escapeHtml(item.note || item.url || "記録あり")}</p>
      <div class="asset-meta"><span>${item.amount ? `${Number(item.amount).toLocaleString("ja-JP")}円` : "金額不明"}</span>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer noopener">証拠を見る ↗</a>` : ""}</div>
    </article>
  `).join("");
  document.querySelectorAll(".remove-evidence").forEach((button) => button.addEventListener("click", () => {
    state.pain.evidence.splice(Number(button.dataset.index), 1);
    saveState(); render();
  }));
}

function renderPainGate() {
  const gate = evaluatePainGate(state.pain);
  const summary = gate.evidence;
  $("painGateState").textContent = gate.passed ? "PAID PAIN CONFIRMED" : "NO BUILD";
  $("painGateState").className = `gate-state ${gate.passed ? "pass" : ""}`;
  $("painGateBody").innerHTML = `
    <div class="score-grid compact-score-grid">
      <div><span>実支払い証拠</span><strong>${summary.paidCount}</strong></div>
      <div><span>全需要証拠</span><strong>${summary.supportCount}</strong></div>
      <div><span>価格</span><strong>${Number(state.pain.price || 0).toLocaleString("ja-JP")}円</strong></div>
      <div><span>AI自律率</span><strong>${Number(state.pain.autonomyPercent || 0)}%</strong></div>
    </div>
    ${gate.blockers.length ? `<ul class="blocker-list">${gate.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p class="success-copy">需要起点の条件を通過しました。公開資産探索を開始できます。</p>`}
  `;
  $("assetScoutButton").disabled = !gate.passed;
  $("assetScoutHint").textContent = gate.passed ? "悩みから検索語を生成し、GitHubの無料公開資産を探します。" : `先に解消: ${gate.nextAction}`;
}

function renderAssets() {
  const container = $("assetList");
  if (!state.assets.length) {
    container.innerHTML = `<div class="empty-state"><strong>まだ公開資産を探していません</strong><p>PAID PAIN Gate通過後に探索できます。</p></div>`;
    return;
  }
  container.innerHTML = state.assets.slice(0, 30).map((asset) => {
    const selected = state.selectedAssetIds.includes(asset.id);
    return `<article class="asset-card ${selected ? "selected" : ""}">
      <div class="asset-topline"><span class="license-badge ${asset.licenseDecision.toLowerCase()}">${asset.licenseDecision} · ${escapeHtml(asset.license)}</span><span class="asset-score">${asset.assetScore}/100</span></div>
      <h3>${escapeHtml(asset.name)}</h3>
      <p>${escapeHtml(asset.description || "説明なし")}</p>
      <div class="asset-meta"><span>★ ${Number(asset.stars).toLocaleString("ja-JP")}</span><span>${escapeHtml(asset.language || "-")}</span><a href="${escapeHtml(asset.url)}" target="_blank" rel="noreferrer noopener">GitHub ↗</a></div>
      <button class="${selected ? "secondary-button" : "primary-button"} choose-asset" data-id="${escapeHtml(asset.id)}" ${asset.licenseDecision !== "PASS" ? "disabled" : ""}>${selected ? "選択解除" : asset.licenseDecision === "PASS" ? "MVP部品に選ぶ" : "License要確認"}</button>
    </article>`;
  }).join("");
  document.querySelectorAll(".choose-asset").forEach((button) => button.addEventListener("click", () => {
    const id = button.dataset.id;
    if (state.selectedAssetIds.includes(id)) state.selectedAssetIds = state.selectedAssetIds.filter((item) => item !== id);
    else if (state.selectedAssetIds.length < 3) state.selectedAssetIds.push(id);
    saveState(); render();
  }));
}

function renderBuildGate() {
  const selected = state.assets.filter((asset) => state.selectedAssetIds.includes(asset.id));
  const gate = evaluateBuildGate({ pain: state.pain, selectedAssets: selected });
  $("buildGateState").textContent = gate.decision;
  $("buildGateState").className = `gate-state ${gate.buildAllowed ? "pass" : ""}`;
  $("buildGateBody").innerHTML = gate.blockers.length
    ? `<ul class="blocker-list">${gate.blockers.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p class="success-copy">Build Gate通過。ここから初めてMVP実装へ進みます。</p>`;
  $("copyBriefButton").disabled = !gate.buildAllowed;
  $("briefPreview").textContent = makeBuildBrief({ pain: state.pain, selectedAssets: selected });
}

function render() {
  renderEvidence();
  renderPainGate();
  renderAssets();
  renderBuildGate();
  $("versionLabel").textContent = `v${VERSION}`;
  $("lastRun").textContent = state.lastRun ? new Date(state.lastRun).toLocaleString("ja-JP") : "未実行";
}

async function scoutAssets() {
  const gate = evaluatePainGate(state.pain);
  if (!gate.passed) return;
  const button = $("assetScoutButton");
  button.disabled = true;
  button.textContent = "探索中…";
  const queries = generateAssetSearchQueries(state.pain);
  $("queryList").innerHTML = queries.map((q) => `<code>${escapeHtml(q)}</code>`).join(" ");
  const found = [];
  const errors = [];
  for (const query of queries) {
    try {
      const url = new URL(API);
      url.searchParams.set("q", query);
      url.searchParams.set("sort", "stars");
      url.searchParams.set("order", "desc");
      url.searchParams.set("per_page", "10");
      const response = await fetch(url, { headers: HEADERS });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || `HTTP ${response.status}`);
      found.push(...(body.items || []).map((repo) => normalizeGithubAsset(repo, query)));
    } catch (error) {
      errors.push(`${query}: ${error.message}`);
    }
  }
  state.assets = rankAssets(found);
  state.selectedAssetIds = state.selectedAssetIds.filter((id) => state.assets.some((asset) => asset.id === id));
  state.lastRun = new Date().toISOString();
  saveState();
  button.textContent = "悩みから公開資産を探索";
  $("assetScoutHint").textContent = errors.length ? `${state.assets.length}件取得 / ${errors.length}クエリ失敗` : `${state.assets.length}件取得。PASS Licenseから最大3件選択してください。`;
  render();
}

function addEvidence() {
  const evidence = normalizeEvidence({
    type: $("evidenceType").value,
    source: $("evidenceSource").value,
    url: $("evidenceUrl").value,
    amount: $("evidenceAmount").value,
    note: $("evidenceNote").value,
  });
  if (!evidence.url && !evidence.note) return;
  state.pain.evidence.push(evidence);
  $("evidenceSource").value = "";
  $("evidenceUrl").value = "";
  $("evidenceAmount").value = "";
  $("evidenceNote").value = "";
  saveState(); render();
}

async function copyBrief() {
  const selected = state.assets.filter((asset) => state.selectedAssetIds.includes(asset.id));
  const brief = makeBuildBrief({ pain: state.pain, selectedAssets: selected });
  await navigator.clipboard.writeText(brief);
  const button = $("copyBriefButton");
  const original = button.textContent;
  button.textContent = "コピーしました";
  setTimeout(() => { button.textContent = original; }, 1400);
}

function resetAll() {
  if (!window.confirm("この端末に保存したVENTURE BUILDER v0.3の状態を削除しますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

writePainForm();
render();
["customer","problem","offer","price","channel","firstCustomerRoute","killCriteria","autonomyPercent","zeroCost","oneDayMvp","solutionHint"].forEach((id) => {
  $(id).addEventListener(id === "zeroCost" || id === "oneDayMvp" ? "change" : "input", readPainForm);
});
$("addEvidenceButton").addEventListener("click", addEvidence);
$("assetScoutButton").addEventListener("click", scoutAssets);
$("copyBriefButton").addEventListener("click", copyBrief);
$("resetButton").addEventListener("click", resetAll);
