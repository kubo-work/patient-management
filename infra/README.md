# infra/

AWS 環境（ECS Fargate + ALB + RDS + CloudFront/S3）を Terraform で管理する一式。
バックエンドは ECS Fargate 上で稼働し、Prisma マイグレーションは **タスク起動時に毎回自動実行**（`npx prisma migrate deploy` は冪等なので DB は壊れません）。

---

## 全体構成

```
                   ┌────────────────────────┐
                   │   Route 53 (Hosted Zone)│
                   │  aws.<domain>           │
                   │  api-aws.<domain>       │
                   └───────────┬─────────────┘
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
      ┌──────────────────┐         ┌──────────────────┐
      │   CloudFront     │         │   ALB (HTTPS)    │
      │   (Front: Next)  │         │                  │
      └────────┬─────────┘         └────────┬─────────┘
               │                            │
               ▼                            ▼
        ┌────────────┐              ┌──────────────┐
        │  S3 Bucket │              │ ECS Fargate  │
        │ (静的サイト)│              │ (Express API)│
        └────────────┘              │  prisma      │
                                    │  migrate     │
                                    │  deploy      │
                                    └──────┬───────┘
                                           │
                                           ▼
                                    ┌────────────┐
                                    │ RDS Postgres│
                                    │ (private)   │
                                    └────────────┘
                                    Secrets Manager
                                    └→ DATABASE_URL
```

- **VPC**: `10.0.0.0/16`、AZ は `ap-northeast-1a / 1c`
- **Public subnet**: ALB / NAT Gateway 配置
- **Private subnet**: ECS タスク / RDS 配置
- **NAT Gateway**: ECS タスクから ECR / Secrets Manager / CloudWatch Logs への egress 用（destroy で停止）
- **ECR**: バックエンド Docker イメージ（最新10件保持）

---

## 前提条件

- AWS アカウント / IAM ユーザー
  - `patient-admin` プロファイル（管理者権限。tfstate バケット作成と AdministratorAccess の付け外しに使用）
  - `patient` プロファイル（通常運用。`AWSPatientManagementPolicy` だけ付与）
- ローカルツール
  - Terraform >= 1.6
  - AWS CLI v2
  - Node.js >= 20
  - Docker（`aws-build-push` で linux/amd64 イメージをビルドするため）
- `infra/.env` に最低限以下を記述：
  ```
  AWS_PROFILE=patient
  TF_VAR_project=patient-management
  TF_VAR_environment=dev
  TF_VAR_db_name=...
  TF_VAR_db_username=...
  TF_VAR_db_password=...
  TF_VAR_client_url=https://aws.<your-domain>
  # 任意。RDS を新規作成した直後に、ここで指定した DB から初期データを取り込む。
  # 通常は Neon の接続文字列を入れる。未設定なら取り込みは行われず RDS は空のまま。
  TF_VAR_source_database_url=postgres://...
  ```

---

## ディレクトリ構成

```
infra/
├── README.md
├── main.tf                  ← provider / backend (S3 tfstate)
├── variables.tf             ← 入力変数 / locals
├── network.tf               ← VPC / subnet / IGW / NAT GW / route table
├── security_group.tf        ← alb_sg / ecs_task_sg / rds_sg
├── route53.tf               ← Hosted Zone (front / api)
├── acm.tf                   ← ACM 証明書（front は us-east-1, api は東京）
├── cloudfront_s3.tf         ← フロント配信
├── alb.tf                   ← ALB / Target Group / Listener
├── ecr.tf                   ← ECR リポジトリ
├── ecs.tf                   ← ECS Cluster / Service / Task Definition / IAM
├── rds.tf                   ← PostgreSQL 15 (db.t3.micro)
├── secrets.tf               ← Secrets Manager (DATABASE_URL)
├── iam_policy.tf            ← AWSPatientManagementPolicy
├── cloudwatch.tf            ← Log Group / Alarms (RDS / ALB / ECS / CloudFront / ACM)
└── scripts/                 ← npm スクリプト群（後述）
```

---

## npm スクリプト一覧（scripts/）

```
infra/scripts/
├── package.json
├── aws-setup.js        ← 初回: tfstate バケット作成 + IAM ポリシー登録
├── aws-apply.js        ← デプロイ（domain / all の 2 モード）
├── aws-build-push.js   ← Docker build → ECR push → ECS 強制再デプロイ
├── aws-down.js         ← 撤去（domain / all の 2 モード）
└── aws-teardown.js     ← 完全リセット（tfstate バケットごと削除）
```

実行は `infra/scripts/` ディレクトリで `npm run <script>`。

---

## 各コマンドの詳細

### `npm run aws-setup`

**初回 / 完全リセット後の土台作り。** [aws-setup.js](scripts/aws-setup.js)

1. `patient-admin` で **AdministratorAccess を IAM ユーザに一時アタッチ**（5秒待機で権限伝播）
2. tfstate 用 S3 バケット (`terraform-state-patient-management-dev-kubo`) を作成（既存ならスキップ）
3. バケットポリシーで対象ユーザのみアクセス可に設定
4. `terraform init`
5. `acm.tf / cloudfront_s3.tf / alb.tf / ecs.tf / ecr.tf` を `.bak` に**一時退避**（`AWSPatientManagementPolicy` 単独 apply のため依存を切る）
6. `aws_iam_policy.patient_management` を state に import or apply
7. 退避ファイルを finally で**必ず復元**
8. `patient` ユーザに `AWSPatientManagementPolicy` をアタッチ
9. **AdministratorAccess を即剥奪**（管理者権限を放置しない）

> エラー時も catch で AdministratorAccess を剥がす設計。

---

### `npm run aws-apply-domain`

**Route53 Hosted Zone のみ作成。** [aws-apply.js](scripts/aws-apply.js)（`mode=domain`）

- 同名ゾーン重複チェック → 1 つだけある場合は state に import → 無ければ新規作成
- `aws_route53_zone.front` / `aws_route53_zone.api` を target apply
- 完了後、Name Servers を出力（**お名前.com 等で NS 委任**してから次へ）

> ⚠️ 本スクリプトには **Route53 ゾーン重複バグ修正**が入っています。AWS 上に同名ゾーンが 2 つ以上あると apply 中断（誤って 3 つ目を作らせない）。

---

### `npm run aws-apply`

**本体一括デプロイ。** [aws-apply.js](scripts/aws-apply.js)（`mode=all`）

実行順序：

1. **既存リソースの import**（IAM Role / RDS Parameter Group / Secret / Route53 ゾーン / S3 / RDS の Log Group / ECR / ECS Cluster & Service / ECS Logs Group）
   - 全部 try/catch で「ない / すでに import 済み」は黙ってスキップ
2. **Step1**: ACM 証明書を target apply（`for_each` の依存解決のため先に発行）
3. **Step2**: Secrets Manager の `database_url` を target apply（ECS 起動時に AWSCURRENT が必要）
4. **Step3**: ECR リポジトリを target apply（タスク定義が `repository_url` を参照）
5. **Step4**: 残り全部を apply
6. 完了後 `alb_dns_name` / `api_url` / `ecr_repository_url` を出力

---

### `npm run aws-build-push`

**バックエンドのコンテナビルド & デプロイ。** [aws-build-push.js](scripts/aws-build-push.js)

1. `terraform output -raw ecr_repository_url` で ECR URI を取得
2. `aws ecr get-login-password` → `docker login`
3. タグ生成（`git rev-parse --short HEAD` があれば使用、なければ `build-<timestamp>`）
4. `docker build --platform linux/amd64 -t <ecr>:<tag> -t <ecr>:latest -f packages/api/Dockerfile .`
   - **Apple Silicon / arm64 環境でも Fargate は x86_64 なので必ず `--platform linux/amd64` を指定**
   - ビルドコンテキストは monorepo のルート（bun workspaces 全体を解決するため）
5. `docker push <ecr>:<tag>` と `:latest`
6. `aws ecs update-service --force-new-deployment` で ECS が新イメージを pull → タスク再起動
7. **タスク起動時に `prisma migrate deploy` が走り**、未適用マイグレーションがあれば自動適用

> マイグレーション失敗時はタスクが起動失敗 → 旧タスクが残るため API は無停止（ALB が unhealthy なターゲットに流さない）。

---

### `npm run aws-down-domain`

**Route53 Hosted Zone だけ削除。** [aws-down.js](scripts/aws-down.js)（`mode=domain`）

- インフラ本体（RDS / ACM / S3 / ECS / ALB 等）はそのまま残す
- `terraform destroy -target=aws_route53_zone.*` をリトライ付きで実行

---

### `npm run aws-down`

**インフラ撤去（Route53 以外を全削除）。** [aws-down.js](scripts/aws-down.js)（`mode=all`）

実行順序：

1. **Route53 ゾーンを state から `terraform state rm`**（AWS 上の DNS 委任を保持して NS 設定をやり直さなくて済むように）
2. **ECS サービスを CLI で空にして削除**：`update-service --desired-count 0` → `wait services-stable` → `delete-service --force`
   - これをやらないと subnet にぶら下がった ENI が残って `aws_subnet` の destroy が失敗する
   - state からも `aws_ecs_service.backend` を除外
3. **ECR イメージを batch-delete**（`force_delete=true` が効くが念のため）
4. **`AWSPatientManagementPolicy` を全アタッチ先からデタッチ**（IAM ポリシーはアタッチ中だと 409 ConflictError）
5. **`terraform destroy` を最大 3 回リトライ**（10 秒間隔。Terraform は冪等なので削除済みリソースはスキップ）
6. **孤立 EIP を release**（NAT Gateway 削除に失敗していてもアタッチが外れた EIP は確実に解放 → 課金停止）

> ⚠️ NAT Gateway / EIP / ALB は destroy で課金停止。本コマンド完了後の追加料金は **Route 53 Hosted Zone の $0.50/月のみ**（ゾーンを残している場合）。

---

### `npm run aws-teardown`

**tfstate バケットごと完全リセット。** [aws-teardown.js](scripts/aws-teardown.js)

- `aws-down` でインフラを消した**後に**実行する破壊的コマンド
- `patient-admin` で AdministratorAccess を一時付与
- tfstate バケットを `aws s3 rm --recursive` → `delete-bucket`
- AdministratorAccess を剥奪

> 実行後は state が消えるため、再構築は `aws-setup` から。

---

## 運用フロー

### 🚀 初回構築

```bash
cd infra/scripts

# 1. tfstate バケット作成 + IAM ポリシー登録
npm run aws-setup

# 2. Route53 ゾーン作成
npm run aws-apply-domain

#   出力された name servers をお名前.com 等の DNS 管理画面で登録
#   伝播確認: dig NS aws.<domain>

# 3. インフラ全体を構築
npm run aws-apply

# 4. バックエンドのコンテナをビルド & デプロイ（マイグレーションは自動）
npm run aws-build-push
```

### 🔄 日常: コード変更を反映

```bash
# バックエンドのみ
cd infra/scripts && npm run aws-build-push

# Terraform リソースを変更
cd infra/scripts && npm run aws-apply
```

> Prisma スキーマを変更した場合は、ローカルで `cd packages/db && bun run migrate:dev --name <change>` を実行して migration ファイルをコミット → `aws-build-push` で本番に反映。接続先がローカル DB かどうかを確認するガードが入っている。

### 🛑 一時停止（コスト削減のため AWS だけ落としたい）

```bash
cd infra/scripts && npm run aws-down

# 後日復活させる場合
npm run aws-apply
npm run aws-build-push
```

> Route53 ゾーンは残るため、再構築時に NS 委任を再設定する必要なし。

### 💀 完全撤去

```bash
cd infra/scripts
npm run aws-down            # インフラ削除（Route53以外）
npm run aws-down-domain     # Route53 ゾーンも削除
npm run aws-teardown        # tfstate バケットも削除
```

---

## マイグレーション運用

**ECS タスク起動時に自動実行**（[infra/ecs.tf](ecs.tf) の `command`）：

```hcl
command = ["sh", "-c", "../../node_modules/.bin/prisma migrate deploy --schema ../db/prisma/schema.prisma && node scripts/seed-from-source.js && node build/index.js"]
```

| 操作 | DB への影響 |
|---|---|
| `aws-build-push` 連発（同一 migration） | ❌ **何も起きない**。`_prisma_migrates` テーブルで適用済みと判定 |
| 新しい migration を追加して `aws-build-push` | ⭕ **未適用分のみ追加実行**（追記） |
| `aws-down` → `aws-apply` 再構築 | ⭕ RDS が新規作成されるなら全 migration 再実行（**RDS が同一なら無傷**） |
| RDS 自体を destroy | ⭕ DB ごと消滅（**注意**） |

> Prisma の `migrate deploy` は内部で advisory lock を取るため、複数タスク同時起動でも衝突しません。

---

## トラブルシューティング

### `aws-apply` で `BucketAlreadyExists` / `EntityAlreadyExists`
import 漏れ。`aws-apply.js` の import セクションに追加するか、コンソールで状態を確認のうえ手動 `terraform import` してから再実行。

### Route53 ゾーンが 2 つできてしまった
`aws-apply` が中断するように修正済み。コンソールで NS レコード未委任の方を削除してから再実行。

### `aws-down` で subnet 削除に失敗
ECS タスクの ENI が残っている。`drainAndDeleteEcsService()` がスキップされた可能性。手動で：
```bash
aws ecs update-service --cluster patient-management-dev-cluster \
  --service patient-management-dev-backend --desired-count 0 \
  --region ap-northeast-1 --profile patient
aws ecs delete-service --cluster patient-management-dev-cluster \
  --service patient-management-dev-backend --force \
  --region ap-northeast-1 --profile patient
# 数分待ってから再度 npm run aws-down
```

### `aws-down` 後も EIP が課金されている
本スクリプトは destroy 後に孤立 EIP を release しますが、想定外の EIP がある場合：
```bash
aws ec2 describe-addresses --region ap-northeast-1 --profile patient \
  --query "Addresses[?AssociationId==null]"
aws ec2 release-address --allocation-id <eipalloc-xxx> \
  --region ap-northeast-1 --profile patient
```

### Apple Silicon でビルドしたイメージが ECS で起動しない
`aws-build-push.js` は `--platform linux/amd64` を必ず付ける実装。手動 build する場合は同じフラグを忘れずに。

---

## 想定月額（東京リージョン、24h 稼働、軽トラフィック）

| 項目 | 月額目安 |
|---|---|
| Route 53 Hosted Zone × 2 | $1.00 |
| ALB | $17.74 + LCU |
| NAT Gateway | $45.26 + データ処理 |
| Fargate (0.25vCPU / 0.5GB) | $11.24 |
| RDS db.t3.micro Single-AZ + 20GB gp3 | $20.86 |
| CloudFront / S3 | $0〜2 |
| Secrets Manager | $0.40 |
| CloudWatch Logs / Alarms | $1〜3 |
| **合計** | **約 $98〜102 / 月** |

> 一時利用なら `aws-down` で停止し、稼働時間ぶんだけ課金 が現実的（NAT GW $0.062/h × 起動時間）。
