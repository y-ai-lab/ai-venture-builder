# AI VENTURE BUILDER v0.2 — Operator Runbook

## 起動条件

以下の明示的な指示がある場合だけ、事業探索を開始する。

- 探索開始
- VENTURE BUILDERを実行
- ゼロベースで探索

「開発を進めて」はBuilder本体の実装・テストとして扱い、事業探索は開始しない。定期実行もしない。

## 実行順序

1. **Run Gate** — 目的、0円条件、対象市場、禁止事項を確認する。
2. **SCOUT** — GitHub、GitLab、Hugging Face、政府データ等の公開API・公開ページを調査する。
3. **FULL INVENTORY（自動継続）** — GitHub公開Repositoryを作成順に100件ずつ取得し、最後のIDをcursorとして保存する。全件に一次判定を行い、有望候補だけ深掘りキューへ送る。毎日03:17（日本時間）目安に自動実行し、手動実行も可能。
4. **NORMALIZE** — 出典URL、取得日時、ライセンス、利用条件、依存、費用、更新状況を記録する。
5. **FILTER** — `No License`、商用利用不可、費用不明、規約上危険、個人情報必須、維持負担過大を除外する。
6. **COMPOSE** — 実際に残った資産を2〜4個組み合わせ、顧客・問題・出力物・差別化を定義する。
7. **VALIDATE** — 支払い・売上、契約・発注、求人、有料レビュー、困りごとの証拠をWebで確認する。
8. **SCORE** — 指定の100点配点で計算する。競合存在だけでは需要点を加算しない。
9. **FALSIFY** — TOP5すべてについて、無料代替、大手参入、規約、法律、著作権、維持負担、価格競争を確認する。
10. **BUILD GATE** — 証拠・ライセンス・0円条件・反証を通過した1位だけを採用する。条件不足なら`NO BUILD`。
11. **BUILDER / QA** — 最初の1円を検証できる最小MVPを実装し、実際にテストする。
12. **MONETIZE / HANDOFF** — 価格、販売チャネル、納品方法、Kill Criteria、次の操作1つを提示する。

## 証拠ルール

記録する各証拠には、`type`、`url`、`observedAt`、`note`を付ける。

- `sale`: 実際の支払い・売上
- `contract`: 契約・発注・有償案件
- `job`: 求人・業務委託募集
- `paid_review`: 有料レビュー・導入事例
- `complaint`: 具体的な困りごと
- `price_displayed`: 価格表示だけ。販売実績とは扱わない
- `competitor_only`: 競合の存在だけ。需要点は0点

同一ページを複数証拠として登録しない。表示価格と実販売価格、募集金額と契約金額を分ける。

## Build Gateの停止条件

- ライセンスが`PASS`でない
- 有料API、GPU課金、VPS、有料DB、カード登録が必須
- 支払い・契約・求人等の需要証拠が不足
- 顧客、問題、初回支払い、納品物が未定義
- TOP5の反証が未完了
- 個人情報・機密情報の保存が必須
- 規約・著作権・法律上の確認ができない

## 人間の承認が必要な操作

- GitHubログイン、OAuth、Secret登録
- Repository・Webサイトの公開
- 決済・アフィリエイト登録
- 営業メール・DM・投稿
- 契約、支払い、購入
- 個人情報を扱う設計

調査、コード作成、サンプル生成、ローカルテスト、README作成は自律的に進める。

## 既存MVPの保管

「OSS 商用利用前チェック」はBuilder v0.2とは別成果物として扱う。既存Repositoryと公開URLを変更しない。

- Repository: https://github.com/y-ai-lab/oss-license-preflight
- Pages: https://y-ai-lab.github.io/oss-license-preflight/

新候補のMVPは別フォルダ、別Repository、別URLで作成する。
