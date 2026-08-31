# AI VENTURE BUILDER v0.3 — Operator Runbook

## 起動条件

以下の明示的な指示がある場合だけ、事業探索を開始する。

- 探索開始
- VENTURE BUILDERを実行
- ゼロベースで探索

定期的なFULL INVENTORYは行わない。

## 最重要原則

**PUBLIC ASSET → BUSINESS をやめ、PAID PAIN → PUBLIC ASSET → MVP の順にする。**

公開資産は事業アイデアの起点ではなく、すでにお金が動いている問題を解決するための部品として扱う。

## 実行順序

1. **PAID PAIN SCOUT** — CrowdWorks、ココナラ、Upwork、Fiverr、購入済みレビュー、契約事例等から「誰が何にお金を払っているか」を調査する。
2. **EVIDENCE REGISTER** — 表示価格と実販売、募集金額と契約金額を分けて証拠を登録する。
3. **PAID PAIN GATE** — 顧客・悩み・実支払証拠・価格・販売チャネル等を確認。1つでも不足なら`NO BUILD`。
4. **ASSET QUERY** — 悩みから解決部品の検索語を生成する。
5. **PUBLIC ASSET SCOUT** — GitHub、Hugging Face、Open Data等から無料公開資産を探す。
6. **LICENSE / FREE GUARD** — 商用利用条件と追加費用0円を確認する。
7. **BUILD GATE** — PASS Licenseの公開資産を選択し、全条件を再確認する。
8. **BUILDER** — 1日以内に作れる最小MVPだけ実装する。
9. **QA** — 正常動作、エラー、License、Secret、0円運用を確認する。
10. **SELL / TEST** — 決めた1チャネルで最初の1円を検証する。
11. **KILL / IMPROVE** — Kill Criteriaに沿って停止・改善を判断する。

## PAID PAIN GATE 必須条件

以下すべてが必要。

- 明確な顧客
- 明確な悩み
- `sale / contract / paid_review` の実支払証拠を最低1件
- 補助証拠を含め需要証拠が合計3件以上
- 最初の販売チャネルが決定済み
- 価格が決定済み
- 最初の顧客への到達方法が決定済み
- Kill Criteria設定済み
- 追加費用0円
- 1日以内のMVP
- AI自律稼働率70%以上

1項目でも欠ける場合、公開資産探索を開始しない。

## 証拠ルール

- `sale`: 実際の販売実績
- `contract`: 契約済み実績
- `paid_review`: 購入済みレビュー
- `job`: 予算付き発注・求人
- `complaint`: 具体的な困りごと
- `price_displayed`: 表示価格のみ
- `competitor_only`: 競合の存在のみ

同一ページを複数証拠として水増ししない。

`price_displayed`と`competitor_only`だけではBuildしない。

## Marketplace調査

CrowdWorks、ココナラ、Upwork等を、規約を無視してGitHub Actionsから自動スクレイピングしない。

Paid Painの調査は、Webブラウジング可能なChatGPT Work / 通常チャット / 人間のブラウザ確認を利用し、根拠URLをBuilderへ登録する。

目的は「自動取得率100%」ではなく「需要証拠を間違えない」こと。

## Public Asset Scout

PAID PAIN GATE通過後にのみ実行する。

優先:

- GitHub公式公開API
- Hugging Face公開情報
- 政府Open Data
- 公開API / RSS

資産起点で新しい事業アイデアを増やさない。

## FULL INVENTORY

旧FULL INVENTORYは停止済み。

- 毎日100Repositoryを古い順に読む処理は廃止
- GitHub Actions workflowは削除
- `scripts/full-inventory.mjs`は過去検証用のLegacyとしてのみ残す

再開する場合も、明確なPaid Painから必要な資産カテゴリが判明した時だけ。

## Build Gate停止条件

- PAID PAIN GATE未通過
- 使用する公開資産がない
- LicenseがPASSでない
- 有料API / VPS / GPU課金 / 有料DB等が必須
- 最初の販売方法が決まっていない
- AI自律稼働率70%未満
- 1日MVPに切れていない
- Kill Criteriaがない

## 人間承認が必要な操作

- 外部サービスのログイン・OAuth
- 不可逆なWeb公開
- Marketplace出品
- 営業メール・DM・投稿
- 契約・支払い・購入
- Affiliate申請
- 個人情報を扱う設計

調査整理、検索語生成、GitHub探索、コード作成、テスト、Build Brief生成は可能な限りAI側で進める。

## 成功判定

Builderの成功は「MVPを何個作ったか」では測らない。

優先KPI:

1. Paid Painを何件正しく確認できたか
2. Build Gateを通過した事業数
3. 実際の応募・販売・問い合わせ数
4. 最初の売上
5. 人間作業時間

**売上検証前に制作物を増やさない。**
