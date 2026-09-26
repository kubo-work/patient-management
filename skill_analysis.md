# GitHubデータから見る得意なこと — skill_analysis

> 対象リポジトリ: [kubo-work/patient-management](https://github.com/kubo-work/patient-management)  
> 分析日: 2026-04-25  
> 総コミット数: 479件 / 総PR数: 100件以上  
> 最終更新: 2026-09-26（技術構成・認証・インフラ・テストの記述を現在の構成に更新。コミットやキーワードの集計は分析日時点の数字のまま）

---

## 1. リファクタリング・コード品質改善 (33件)

PRの中で最も多いカテゴリ。コードを動かすだけでなく「きれいにする」ことへの意識が高い。

- Zod導入による型安全化（`strictNullChecks` 厳格化）
- APIファイルの分割・責務の整理
- 不要なコード・`console.log` の削除

**設計を継続的に改善していくアプローチ**が得意。

---

## 2. バグ特定・デバッグ力 (24件)

CORS・クッキー・セッション・認証まわりのバグを執拗に追い続けたPR群（#227〜#241）が印象的。  
一度で解決せず仮説→検証を繰り返す**粘り強いデバッグスタイル**が見て取れる。

主な取り組み例:
- `Access-Control-Allow-Credentials` の設定
- クロスドメイン・CORS ミドルウェアの調整
- クッキー取得方法の変更
- ログアウト処理のフロー修正

---

## 3. TypeScript フルスタック開発

| レイヤー | 技術スタック |
|---|---|
| 共通 | TypeScript / bun workspaces（monorepo） |
| バックエンド | Node.js / Hono / tRPC / Prisma 7 / Zod / PostgreSQL（Neon） |
| フロントエンド | Next.js（App Router） / React / Mantine UI |
| テスト | Vitest / PGlite |
| インフラ | Vercel / Neon（稼働中）、Terraform / AWS（構築済み・停止中） |

ファイル種別の内訳（2026-09-26 時点、`git ls-files` で数えた git 管理下のファイル数）:

| 拡張子 | ファイル数 |
|---|---|
| `.ts` | 75 |
| `.tsx` | 29 |
| `.tf` | 14 |
| `.js` | 6 |
| `.mjs` | 5 |
| `.yml` | 5 |

フロント・バックエンド・インフラを全部自分でやりきる力がある。

---

## 4. 認証・セキュリティ周りの経験値

コミット解析でもっとも多かったキーワードが **auth (21回)**。  
JWT・セッション・Cookie・CORS・ミドルウェアと、認証の難所をひと通り自力でぶつかって解決している。  
現在はサーバ側のセッションを廃止し、JWT + httpOnly Cookie によるステートレス認証へ移行済み（ADR 0004）。

関連キーワードの出現回数:

| キーワード | 出現回数 |
|---|---|
| auth | 21回 |
| ログイン | 5回 |
| CORS | 1回 |
| クッキー | 2回 |
| セッション | 1回 |
| ミドルウェア | 2回 |

---

## 5. インフラ構築 (AWS + Terraform)

直近のPRで本格的なAWSインフラをTerraformで構築。App Runner から ECS Fargate + ALB 構成へ移行し、コンテナベースのデプロイ基盤を整備。

構築したAWSリソース:

- ECS Fargate（コンテナ実行）
- ALB（Application Load Balancer）
- ECR（Dockerイメージレジストリ）
- NAT Gateway（プライベートサブネットの外部通信）
- CloudFront / S3（フロントエンド配信）
- RDS（PostgreSQL）
- Route53 / ACM（ドメイン管理・SSL証明書）
- VPC / Security Group
- CloudWatch
- IAM Policy / Secrets Manager

コードとしてインフラを管理する **Infrastructure as Code** の実践経験に加え、Dockerイメージのビルド・ECRへのプッシュ・ECSサービス更新までの **CI/CDパイプライン** を整備している。

なお現在の本番は Vercel（フロントと API）+ Neon（PostgreSQL）に統合しており、この AWS 構成は稼働実績を残したまま停止している（README 参照）。

---

## 6. テストコードへの取り組み

当初は Jest + prisma-mock で書いていたが、mock の戻り値を書くだけで実装をなぞる「写経テスト」になっていたため、Vitest + PGlite で作り直した。  
テストコードを「後付けで書く」ではなく**改善の一部として組み込んでいる**姿勢がある。

| 層 | 対象 | 方法 |
|---|---|---|
| 単体 | domain（パスワード照合、カテゴリの差分計算、表示用の整形） | Vitest。DB を使わない純粋関数として検証 |
| 結合 | tRPC の各 router | web と同じ tRPC クライアントで HTTP 経由で呼び、PGlite（WASM 版の Postgres 18）まで通して検証。外部キー・一意制約・トランザクションのロールバックなど、mock では確かめられない挙動を確認している |
| CI | 全テスト | GitHub Actions で PR ごとに実行 |

テストファイル例:
- `packages/api/test/domain/medicalCategoryDiff.spec.ts`
- `packages/api/test/integration/authRouter.spec.ts`
- `packages/api/test/integration/medicalRecordsRouter.spec.ts`
- `packages/auth/test/token.spec.ts`

---

## まとめ

| 得意分野 | 根拠 |
|---|---|
| TypeScript フルスタック | TS/TSX 104ファイル（2026-09-26 時点）、フロント・バック両方のPR、tRPC による端から端までの型共有 |
| 認証・セッション設計 | auth関連コミット21回、大量のデバッグPR |
| インフラ構築 (AWS + Terraform) | tf 14ファイル、ECS Fargate + ALB + ECR 構成を Terraform で構築（現在は停止中） |
| テスト設計 | Vitest + PGlite で実 Postgres を使う結合テストを整備し、PR ごとに CI で実行 |
| リファクタリング・型安全化 | 最多PR、Zod導入、strictNullChecks |
| 粘り強いデバッグ | CORS問題を数十のPRで追跡・解決 |

特に「動かして終わり」ではなく、型・テスト・インフラまで一人でやりきる**垂直統合型のエンジニア**という特徴が際立っている。
