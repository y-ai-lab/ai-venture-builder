# AI VENTURE BUILDER v0.2

公開されている無料資産を、根拠のある0円事業へ組み立てるための、無料自動継続・ローカル優先のEvidence-first MVPです。

## できること

- ブラウザからGitHub公開Repositoryを検索
- CLI / GitHub ActionsからGitLab公開プロジェクト、Hugging Faceモデル・データセット、日本政府e-Govデータカタログを検索
- ライセンスを `PASS / REVIEW / EXCLUDE` に分類
- 有料API・GPU・クラウド依存の可能性を減点
- 実際に取得した合格資産から、組み合わせ型ビジネス仮説を最大20件生成
- 顧客、問題、収益方法、販売チャネル、自律稼働率、Kill Criteriaを表示
- 支払い・売上、契約・発注、求人、購入済みレビュー、困りごとなどの市場証拠を区別して再スコア
- 競合の存在だけでは需要と判定せず、TOP5の強制反証とBuild Gateを適用
- JSONスナップショット、Markdownレポート、MVP Build Briefを書き出し
- GitHub公開Repositoryを作成順に100件ずつ棚卸しし、前回地点から再開
- 全件の一次判定と、有望候補だけのREADME・ライセンス・Release・Contributor深掘り
- インベントリのcursor、深掘り待ちキュー、注目候補を公開JSONとして保存
- 個人情報・APIキー・トークンを保存しない

## 起動

Node.js 20以上があれば、プロジェクト直下で次を実行します。

```bash
python3 -m http.server 4173
```

ブラウザで `http://localhost:4173` を開き、「探索を開始」を押します。

ブラウザ実行はCORSと公開API制限を考慮してGitHubのみです。全ソースを取得する場合は別ターミナルで次を実行します。

```bash
npm run scout
```

取得結果は `data/latest-scout.json` に保存され、「保存済みデータを読み込む」から表示できます。

ネットワークなしの動作確認は次です。

```bash
npm run scout:dry
npm run inventory:dry
npm run qa
```

## FULL INVENTORY / DEEP SCOUT

通常のSCOUTは検索語ごとの候補探索です。全件を分析対象にしたい場合は、`scripts/full-inventory.mjs`を使います。

- `GET https://api.github.com/repositories`を作成順のカタログとして使用
- 1回の実行で最大100件を取得し、最後のRepository IDを`data/inventory-state.json`へ保存
- 次回はそのIDから再開するため、長時間の全件棚卸しを分割できる
- 一次判定は取得した全件に行い、用途・更新・利用シグナルの強い候補を深掘りキューへ追加
- 深掘りではRepository詳細、README、Release、Contributor情報を確認
- ライセンス不明は深掘り後も`NO_LICENSE`として商用候補から除外し、判断不能は`LICENSE_REVIEW_REQUIRED`に残す
- トークンは`GITHUB_TOKEN`または`SCOUT_GITHUB_TOKEN`から実行時だけ読み、ファイルへ保存しない

ローカルでは次のように実行できます。

```bash
npm run inventory -- --batch-size 100 --deep-limit 8
```

公開Repositoryでは`.github/workflows/full-inventory.yml`を毎日自動実行します（日本時間03:17目安）。Actions画面からの手動実行も残しています。ワークフローが保存するのは棚卸しメタデータと候補情報であり、Source codeやSecretは保存しません。GitHub Pagesの画面にある「進捗・注目候補を読み込む」から結果を確認できます。

## GitHub Actions

`.github/workflows/scout.yml` は `workflow_dispatch` のみです。定期cronは設定していません。

公開Repositoryへ配置した後、Actions画面から手動実行すると、GitHub・GitLab・Hugging Faceの公開APIを調べ、`data/latest-scout.json`を更新します。APIキーや個人のSecretは使いません。GitHubが自動付与する書き込みトークンはワークフロー実行中だけ使われ、Repositoryへ保存されません。

`.github/workflows/pages.yml` はGitHub Pagesへの公開用です。公開ボタン・Repository作成・Actions実行は、アカウント権限が必要なため人間承認の対象です。

## 0円ガード

このMVPは外部の有料AI API、課金DB、VPS、有料ドメイン、自動化SaaSを使いません。AIによる最終的な市場判断は、ChatGPT WorkでWeb上の証拠を確認してから行う前提です。アプリの仮説生成は、API課金なしで再現できるルールベース処理です。

GitHub PagesはGitHub Freeの公開Repositoryで利用可能と案内されています。標準GitHub-hosted runnerは公開Repositoryで無料と案内されています。一方、未認証GitHub REST APIには通常60リクエスト/時の制限があるため、取得は直列・少量にしています。条件は変わり得るため、公開前に公式情報を再確認してください。

- [GitHub Pages — What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Actions — Billing and usage](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [GitHub REST API — Rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitLab — Projects API](https://docs.gitlab.com/api/projects/)
- [Hugging Face — Hub API](https://huggingface.co/docs/hub/api)
- [e-Govデータポータル — メタデータ取得API](https://data.e-gov.go.jp/data/api_guide)

## ライセンス運用

`MIT / Apache-2.0 / BSD系 / ISC / Unlicense / CC0 / CC-BY`を初期のPASS候補とし、GPL系・AGPL・SSPL・BSL・MPL・ODbL・独自条件などはREVIEWにします。ライセンス不明、商用利用不可、権利条件不明はEXCLUDEです。

PASSは法的保証ではありません。最終的に採用する資産は、元Repository・LICENSE・README・モデルカード・データセット条件を人間が確認してください。

## v0.2の境界

この版は、候補探索・除外・実資産ベースの仮説化・証拠管理・強制反証・Build Gate・Build Brief作成までを担当します。市場証拠がない仮説を「売れる」と判定しません。決済、営業DM、契約、Marketplace登録、不可逆な公開は自動実行しません。

ChatGPT Work側での起動条件と、Web調査・アプリ・人間承認の分担は [OPERATOR_RUNBOOK.md](./OPERATOR_RUNBOOK.md) にまとめています。実行用の指示書は [docs/MASTER_PROMPT_v0.2.md](./docs/MASTER_PROMPT_v0.2.md)、全体設計は [docs/AI_VENTURE_BUILDER_v0.2.md](./docs/AI_VENTURE_BUILDER_v0.2.md) を参照してください。

## 既存MVP

今回作成した「OSS 商用利用前チェック」は別Repository・別URLで保存しています。Builder v0.2の変更で上書きしません。

- https://github.com/y-ai-lab/oss-license-preflight
- https://y-ai-lab.github.io/oss-license-preflight/
