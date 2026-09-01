# AI VENTURE BUILDER v0.4

**PAID PAIN → PUBLIC ASSET → MVP → FIRST SALE**

AI VENTURE BUILDERは、面白いOSSからビジネスを考えるツールではありません。

まず「誰が、何に困り、実際にお金を払っているか」を証拠化し、その問題を追加費用0円の公開資産で解決できる場合だけMVP構築へ進みます。v0.4では、MVP後の商品化・販売準備・納品・数値改善までをAUTO BUSINESS EXECUTORが引き継ぎます。

公開ページ: https://y-ai-lab.github.io/ai-venture-builder/

## v0.4 AUTO BUSINESS EXECUTOR

MVP完成を終了地点にせず、次の4担当を画面と判定ロジックへ追加しました。

- `LAUNCHER`: 商品名、価格、対応範囲、FAQ、販売文を確定
- `SELLER`: 最初の販売チャネルを1つに絞り、実販売証拠と検索語を固定
- `DELIVERY OPERATOR`: 受領、検査、安全修正、再チェック、納品メッセージを標準化
- `GROWTH OPERATOR`: 表示・問い合わせ・購入・売上からKEEP / IMPROVE / PIVOT / KILLを判定

最初の実証事業は、公開済みの `Shopify CSV Preflight` です。

- MVP: https://y-ai-lab.github.io/ec-csv-preflight/
- 価格: 5,000円
- 販売チャネル: ココナラのみ
- 基本範囲: 1ファイル・300データ行・2日・再チェック1回
- Kill Criteria: 7日で露出改善、14日で商品条件改善、30日でPIVOTまたはKILL

出品の最終公開、顧客CSVの意味確認、契約・本人確認だけを人間承認ポイントとして残します。

## v0.3で変えたこと

v0.2までは公開Repositoryを先に探索し、そこから事業仮説を作る「Asset-first」でした。

v0.3では順番を逆転しました。

```text
実際にお金が動いている悩み
        ↓
PAID PAIN GATE
        ↓
悩みから検索語を生成
        ↓
GitHub等の無料公開資産を探索
        ↓
LICENSE / ¥0 COST GUARD
        ↓
BUILD GATE
        ↓
1日以内のMVP
        ↓
販売検証
```

## PAID PAIN GATE

公開資産探索の前に、以下を必須にしています。

- 顧客が明確
- 悩みが明確
- `sale / contract / paid_review` の実支払い証拠が最低1件
- 補助証拠を含め需要証拠が合計3件以上
- 最初の販売チャネルが決定済み
- 価格が決定済み
- 最初の顧客への到達方法が決定済み
- Kill Criteria設定済み
- 追加費用0円で構築可能
- 1日以内のMVPに切れている
- AI自律稼働率70%以上

1つでも欠ける場合は `NO BUILD` です。

## 需要証拠

証拠は次の種類を区別します。

### 実支払い証拠

- `sale`: 実際の販売実績
- `contract`: 契約済み実績
- `paid_review`: 購入済みレビュー

### 補助証拠

- `job`: 予算付き発注・求人
- `complaint`: 具体的な困りごと
- `price_displayed`: 表示価格
- `competitor_only`: 競合の存在

表示価格や競合があるだけではBuild Gateを通しません。

Marketplaceの規約を無視した自動スクレイピングは行いません。CrowdWorks、ココナラ、Upwork等の証拠は、ブラウザ調査やChatGPT Work等で確認した根拠URLを登録する前提です。

## PUBLIC ASSET SCOUT

PAID PAIN GATEを通過した後だけ、ブラウザからGitHub公開APIを利用できます。

顧客の悩み・解決ヒントから検索語を生成し、公開Repositoryを検索します。

候補は以下を確認します。

- License
- Stars
- 更新日時
- Archivedか
- Forkか
- 使用言語
- 説明

MVP部品として選択できるのは、初期判定で `PASS` になったLicenseのみです。

## LICENSE GUARD

初期PASS候補:

- MIT
- Apache-2.0
- BSD-2-Clause
- BSD-3-Clause
- ISC
- Unlicense
- CC0-1.0

GPL / LGPL / AGPL / MPL / EPL等は `REVIEW` とし、v0.3の自動Build Gateでは通しません。

No License / 不明Licenseは `EXCLUDE` です。

PASS判定は法的保証ではありません。実際の商用利用前には元RepositoryのLICENSE・README・依存関係を確認してください。

## BUILD GATE

MVP構築へ進めるのは、以下の両方を満たす場合だけです。

1. PAID PAIN GATE通過
2. PASS Licenseの公開資産を最低1件選択

通過するとBuild Briefを生成できます。

Build Briefには、

- 顧客
- お金が動いている悩み
- 需要証拠
- 最初に売るもの
- 価格
- 販売チャネル
- 最初の顧客への到達方法
- 使用する無料公開資産
- AI自律稼働率
- Kill Criteria

が入ります。

このBriefをChatGPT Work / Codexへ渡し、初めてMVP実装を開始します。

## FULL INVENTORYについて

GitHub公開Repositoryを作成順に100件ずつ読む旧FULL INVENTORYの**定期実行は停止しました**。

理由:

- GitHub全件を読むこと自体に事業価値がない
- 古いRepositoryから順番に見るため収益候補密度が低い
- 400件確認して深掘り候補0件だった
- 資産から無理に事業を作る方向へ戻りやすい

旧スクリプト `scripts/full-inventory.mjs` は検証記録として残していますが、通常フローでは使用しません。GitHub ActionsのFULL INVENTORY workflowは削除済みです。

## 0円ガード

v0.3は以下を前提にしています。

- Public GitHub Repository
- GitHub Pages
- GitHub公開API
- ブラウザLocalStorage
- 有料AI APIなし
- VPSなし
- 有料DBなし
- 有料ドメインなし
- 有料スクレイピングサービスなし

外部Marketplaceを無理に自動取得する代わりに、支払証拠は根拠URLとともに登録します。

## データ保存

顧客・悩み・需要証拠・探索結果・選択した公開資産は、原則としてブラウザのLocalStorageへ保存します。

個人情報、API Key、Token、Cookie、Passwordは保存しません。

## QA

```bash
npm run qa
```

v0.3では最低限以下をテストします。

- 支払証拠不足ではPAID PAIN GATEを通さない
- 実支払1件＋合計3件の需要証拠でGate通過
- 悩みからGitHub検索語を生成
- MIT / ApacheをPASS
- AGPLをPASSにしない
- No LicenseをEXCLUDE
- 公開資産未選択ではBuild禁止
- Demand Gate + PASS資産でBuild許可
- Build Brief生成

GitHub Actionsの `Demand-first QA` でもpush時に実行します。

## AI VALUE RADARとの関係

AI VALUE RADARとは別レーンです。

- AI VALUE RADAR: 市場・AI/SaaS情報を継続監視する部門
- AI VENTURE BUILDER: 実際に金が動いている悩みからMVPを作る部門

VALUE RADARのRepositoryや処理はこの変更では触りません。

## 最重要ルール

**先に作らない。先に売れている問題を確認する。**

```text
今日は何を作る？
```

ではなく、

```text
今日はどこで実際にお金が動いている？
```

から始めます。
