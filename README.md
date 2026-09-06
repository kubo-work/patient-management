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
    - GitHub Actions（型チェック。デプロイは手動実行）

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
- バックエンド : Render
- データベース : Neon（PostgreSQL 18 / AWS us-east-2）

## ログインURL
https://www.patient-management-kubo-works-projects.com/doctor/login

## デモアカウント
ログインID: test_doctor@example.com  
パスワード: test

## 注意点
- renderが無料プランの関係で**レスポンスが50秒以上遅れる可能性があります。**
- 現在、バックエンドを Render から Vercel へ統合する移行作業を進めています。移行が完了すると上記のレスポンス遅延は解消されます。設計の経緯は `docs/adr/` に記録しています。
- `infra/`（Terraform）は ECS Fargate + ALB + RDS + CloudFront/S3 での稼働まで到達済みですが、現在は停止しています。Vercel への統合に伴い静的エクスポート構成が使えなくなったため、この構成の扱いは移行完了後に判断します。

## 作成した機能
- ログイン機能
- 診察作成機能
- 診察履歴確認
- 診察編集機能
- 診察削除機能
- 患者作成機能
- 患者情報編集機能
