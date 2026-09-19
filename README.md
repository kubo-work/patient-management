# patient-management
## 概要
私が毎週お世話になっている整骨院様向けに作成した患者管理アプリです。
実際にこういうのが欲しいと言われた機能をヒアリングして作成しました。  

## 使用した言語やライブラリ
- 共通
    - TypeScript
    - bun workspaces（monorepo）
- フロントエンド
    - Next.js（App Router）
    - React
    - Mantine UI
    - tRPC（クライアント）
    - SWR
- バックエンド
    - Node.js
    - Hono
    - tRPC
    - Prisma
    - Zod
    - argon2（パスワードのハッシュ化）
    - jose（JWT の署名・検証）
    - Vitest
    - Faker
- インフラ・CI/CD
    - GitHub Actions（型チェック）
    - Vercel（main への push で自動デプロイ）

### 構成

```
apps/
  web/        Next.js アプリ
packages/
  api/        Hono + tRPC（Next.js を import しない独立パッケージ）
  auth/       JWT とパスワードハッシュの共有実装
  db/         Prisma スキーマ / マイグレーション / クライアント
  schema/     フロントとバックエンドで共有する型と定数
infra/        AWS 構成（Terraform）
docs/adr/     設計判断の記録
```

## デプロイ先
- フロントエンド : Vercel
- バックエンド : Vercel（Next.js の Route Handler に Hono をマウント。`api` サブドメインで配信）
- データベース : Neon（PostgreSQL 18 / AWS us-east-2）

フロントとバックエンドは同一の Vercel プロジェクトで動作します。`packages/api` は
Next.js を一切 import しない独立パッケージのままで、接点は Route Handler の数行だけです。

## ログインURL
https://patient-management-kubo-works-projects.com/doctor/login

## デモアカウント
ログインID: test_doctor@example.com  
パスワード: test

## 注意点
- `infra/`（Terraform）は ECS Fargate + ALB + RDS + CloudFront/S3 での稼働まで到達済みですが、現在は停止しています。Vercel への統合に伴い静的エクスポート構成が使えなくなったため、この構成の扱いは改めて判断します。

## 設計判断の記録

主要な技術選定とその理由は `docs/adr/` に ADR として残しています。

| | 内容 |
|---|---|
| ADR 0001 | Prisma 7 のドライバアダプタに `@prisma/adapter-pg` を採用する |
| ADR 0002 | HTTP レイヤを Express から Hono へ置き換える |
| ADR 0003 | API を tRPC 化し domain / repository / router に分割する |
| ADR 0004 | express-session を廃止し JWT + httpOnly Cookie でステートレス化する |
| ADR 0005 | パスワードを argon2id でハッシュ化し、レスポンスから除去する |
| ADR 0006 | API を Vercel へ統合し、api サブドメインを維持したまま Render を撤収する |

## 作成した機能
- ログイン機能
- 診察作成機能
- 診察履歴確認
- 診察編集機能
- 診察削除機能
- 患者作成機能
- 患者情報編集機能
