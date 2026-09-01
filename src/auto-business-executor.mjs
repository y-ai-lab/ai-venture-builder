export const EXECUTOR_VERSION = "0.4.0";

export const SHOPIFY_CSV_BUSINESS = Object.freeze({
  id: "shopify-csv-preflight",
  name: "Shopify商品CSV 登録前チェック＋安全修正",
  customer: "Shopifyへ商品を一括登録する小規模EC運営者・制作担当者",
  problem: "インポート直前までCSVの欠損・重複・価格・バリエーション不整合に気づけず、差し戻しや誤登録が起きる",
  promise: "商品情報を推測せず、登録前に止めるべき箇所と安全に直せる箇所を分離して返す",
  price: 5000,
  channel: "ココナラ",
  categoryHint: "Webサイト制作・Webデザイン > ECサイト制作 > EC商品登録・移行",
  deliveryDays: 2,
  revisions: 1,
  rowLimit: 300,
  fileLimit: 1,
  mvpUrl: "https://y-ai-lab.github.io/ec-csv-preflight/",
  repositoryUrl: "https://github.com/y-ai-lab/ec-csv-preflight",
  listingUrl: "",
  launchStatus: "READY_FOR_LISTING_INPUT",
  title: "Shopify商品CSVを登録前にチェック・修正します",
  catchphrase: "SKU・価格・バリエーションの事故を、登録前に見つけます",
  keywords: ["Shopify", "CSV", "商品登録", "商品移行", "SKU", "バリエーション", "ECサイト"],
  included: [
    "Shopify商品CSV 1ファイル・300データ行まで",
    "欠損・重複・形式・バリエーション不整合のチェック",
    "安全に確定できる箇所だけを修正したCSV",
    "未解決の要確認一覧",
    "MarkdownレポートとJSONレポート",
    "修正後CSVの再チェック1回",
  ],
  excluded: [
    "Shopify管理画面へのログイン・商品登録・公開",
    "商品名・Handle・SKU・欠損価格・画像URL・Variantの推測や創作",
    "商品説明文の作成、画像加工、法務・税務判断",
    "顧客情報・注文情報を含むCSVの取扱い",
  ],
  safeFixes: ["前後空白", "UTF-8 BOM", "明確な価格表記", "Shopify Status表記", "安全な文字列正規化"],
  neverGuess: ["商品名", "Handle", "SKU", "欠損価格", "重複SKUの代替値", "画像URL", "Variant内容"],
  intake: [
    "チェック対象のShopify商品CSV",
    "データ行数",
    "特に気になっている点（任意）",
    "商品データ以外の個人情報・認証情報が含まれていないことの確認",
  ],
  deliverables: ["修正版CSV", "未解決一覧", "Markdownレポート", "JSONレポート", "納品サマリー"],
  evidence: [
    { type: "sale", label: "Shopify商品一括登録", proof: "販売実績7件・評価5.0(6)", url: "https://coconala.com/services/3454920" },
    { type: "paid_review", label: "Shopify商品登録代行", proof: "評価・購入レビューのある5,000円帯サービスを確認", url: "https://coconala.com/services/3274782" },
    { type: "official", label: "Shopify商品CSV仕様", proof: "必須列・依存列・Status・価格形式を公式ヘルプで確認", url: "https://help.shopify.com/ja/manual/products/import-export/using-csv" },
  ],
  faq: [
    ["Shopifyへ直接登録してもらえますか？", "基本料金はCSVのチェック・安全修正・レポート納品までです。管理画面へのログインや直接登録は含みません。"],
    ["すべて自動で直りますか？", "いいえ。意味を変えず確定できる箇所だけ修正します。SKU重複や欠損価格などはNEEDS_REVIEWとして残します。"],
    ["CSVは外部AIへ送られますか？", "MVPはブラウザ内だけで処理し、外部API・データベースへ送信しません。取引で受領したファイルも納品に必要な範囲だけで扱います。"],
    ["何行まで対応できますか？", "基本料金は1ファイル・300データ行までです。超える場合は購入前に範囲を確認します。"],
    ["インポート成功を保証しますか？", "保証しません。Shopifyの最新仕様、ストア設定、画像公開状態など外部条件があるため、登録前の品質確認と安全修正を提供します。"],
    ["修正をお願いできますか？", "合意範囲内の再チェックは1回含みます。商品内容の判断や新規データ作成は対象外です。"],
  ],
});

export const EXECUTOR_AGENTS = Object.freeze([
  { id: "launcher", name: "LAUNCHER", role: "MVPを商品へ変換", status: "COMPLETE", items: ["商品名", "価格", "範囲", "FAQ", "販売文", "商品画像仕様"] },
  { id: "seller", name: "SELLER", role: "最初の有料受注へ接続", status: "READY", items: ["ココナラ1チャネル", "競合販売証拠", "検索語", "初回価格", "販売導線"] },
  { id: "delivery", name: "DELIVERY OPERATOR", role: "受注後の作業を標準化", status: "COMPLETE", items: ["受領確認", "自動チェック", "安全修正", "再チェック", "納品パック", "修正対応"] },
  { id: "growth", name: "GROWTH OPERATOR", role: "7・14・30日で判定", status: "READY", items: ["表示", "お気に入り", "問い合わせ", "購入", "売上", "作業時間"] },
]);

function number(value) {
  const result = Number(value || 0);
  return Number.isFinite(result) && result >= 0 ? result : 0;
}

export function normalizeMetrics(input = {}) {
  return {
    days: number(input.days),
    views: number(input.views),
    clicks: number(input.clicks),
    favorites: number(input.favorites),
    inquiries: number(input.inquiries),
    purchases: number(input.purchases),
    revenue: number(input.revenue),
    workMinutes: number(input.workMinutes),
  };
}

export function evaluateGrowth(input = {}) {
  const metrics = normalizeMetrics(input);
  const conversionRate = metrics.views ? (metrics.purchases / metrics.views) * 100 : 0;
  const inquiryRate = metrics.views ? (metrics.inquiries / metrics.views) * 100 : 0;
  let decision = "KEEP";
  let action = "現在の条件を変えず、次の判定日まで計測する";
  let reason = "検証途中、または有料受注を確認";

  if (metrics.purchases > 0) {
    decision = "KEEP";
    action = "新機能を増やさず、同じ範囲で3件完了まで納品時間を測る";
    reason = "最初の有料受注を確認";
  } else if (metrics.days >= 30 && metrics.views >= 50) {
    decision = "KILL";
    action = "追加開発を止め、同じPaid Pain内で提供形態か対象顧客を再設計する";
    reason = "十分な表示があるのに30日間購入0件";
  } else if (metrics.days >= 30) {
    decision = "PIVOT";
    action = "商品は維持し、販売カテゴリーか顧客到達経路を1つだけ変更する";
    reason = "30日経過したが、購入判断に十分な流入を作れていない";
  } else if (metrics.days >= 14 && metrics.views >= 20 && metrics.inquiries === 0) {
    decision = "IMPROVE";
    action = "サービス内容か価格を1要素だけ改善する";
    reason = "表示はあるが14日間問い合わせ0件";
  } else if (metrics.days >= 7 && metrics.views < 10) {
    decision = "IMPROVE";
    action = "タイトル・カテゴリ・1枚目画像の順に、1要素だけ改善する";
    reason = "7日経過時点で表示が極端に少ない";
  }

  return { decision, action, reason, metrics, conversionRate, inquiryRate };
}

export function launchReadiness(business = SHOPIFY_CSV_BUSINESS, external = {}) {
  const checks = [
    ["MVP", Boolean(business.mvpUrl), "完成"],
    ["QA", true, "自動テストあり"],
    ["商品設計", Boolean(business.customer && business.included.length), "完成"],
    ["販売価格", business.price > 0, `${business.price.toLocaleString("ja-JP")}円`],
    ["販売チャネル", business.channel === "ココナラ", business.channel],
    ["販売文章", Boolean(business.title && business.catchphrase && business.faq.length >= 5), "完成"],
    ["商品画像", Boolean(external.productImageReady), external.productImageReady ? "完成" : "作成中"],
    ["納品フロー", business.deliverables.length >= 5, "完成"],
    ["出品画面", external.listingInputComplete === true, external.listingInputComplete ? "入力済み" : "未確認"],
  ].map(([label, passed, detail]) => ({ label, passed, detail }));
  const completed = checks.filter((item) => item.passed).length;
  return {
    checks,
    completed,
    total: checks.length,
    percent: Math.round((completed / checks.length) * 100),
    readyToPublish: checks.every((item) => item.passed),
    nextAction: checks.find((item) => !item.passed)?.label || "公開ボタンを押す",
  };
}

export function autonomyBreakdown() {
  const stages = [
    ["調査・事業選定", "完全自動", 1],
    ["MVP構築・QA", "完全自動", 1],
    ["商品設計・販売素材", "完全自動", 1],
    ["出品フォーム入力", "半自動", 0.5],
    ["公開の最終確定", "人間必須", 0],
    ["問い合わせ分析・返信案", "完全自動", 1],
    ["CSV解析・安全修正", "完全自動", 1],
    ["最終商品意味確認", "半自動", 0.5],
    ["納品物・メッセージ生成", "完全自動", 1],
    ["数値判定・改善案", "完全自動", 1],
  ].map(([stage, mode, score]) => ({ stage, mode, score }));
  return { stages, percent: Math.round((stages.reduce((sum, item) => sum + item.score, 0) / stages.length) * 100) };
}

export function makeListingText(business = SHOPIFY_CSV_BUSINESS) {
  const faq = business.faq.map(([question, answer], index) => `Q${index + 1}. ${question}\nA. ${answer}`).join("\n\n");
  return `# ココナラ出品パック\n\n## タイトル\n${business.title}\n\n## キャッチコピー\n${business.catchphrase}\n\n## 価格\n${business.price.toLocaleString("ja-JP")}円\n\n## サービス内容\nShopifyへ商品CSVをインポートする前に、欠損・重複・価格・画像URL・バリエーションの不整合をチェックし、安全に確定できる箇所だけを修正版CSVへ反映します。\n\n意味を変える可能性がある商品名、Handle、SKU、欠損価格、画像URL、Variant内容は推測で作りません。判断が必要な箇所はNEEDS_REVIEWとして一覧化します。\n\n【基本範囲】\n${business.included.map((item) => `・${item}`).join("\n")}\n\n【対応外】\n${business.excluded.map((item) => `・${item}`).join("\n")}\n\n## 購入前確認\n${business.intake.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## 納期・修正\n納期目安：${business.deliveryDays}日\n再チェック：${business.revisions}回\n\n## FAQ\n${faq}\n\n## 検索キーワード\n${business.keywords.join(" / ")}\n`;
}

export function makeIntakeMessage(business = SHOPIFY_CSV_BUSINESS) {
  return `ご購入ありがとうございます。\n\n次の4点をこのトークルームへお送りください。\n${business.intake.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n商品内容を推測しないと修正できない項目は勝手に変更せず、NEEDS_REVIEWとして返します。パスワード、APIキー、顧客名簿、注文情報は送らないでください。`;
}

export function makeDeliveryMessage(summary = {}) {
  const fixed = summary.fixed || "修正版CSVの変更履歴をご確認ください";
  const unresolved = summary.unresolved || "未解決一覧をご確認ください";
  return `お待たせしました。Shopify商品CSVの登録前チェックが完了しました。\n\n【納品物】\n1. 修正版CSV\n2. 未解決一覧\n3. Markdownレポート\n4. JSONレポート\n5. 納品サマリー\n\n【安全に自動修正した内容】\n${fixed}\n\n【NEEDS_REVIEWとして残した内容】\n${unresolved}\n\n商品情報の推測が必要な箇所は、誤登録を避けるため変更していません。合意範囲内の修正後CSVは1回まで再チェックします。なお、本サービスは登録前確認であり、Shopifyへのインポート成功を保証するものではありません。`;
}
