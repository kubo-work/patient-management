# patient-management
## 概要
私が毎週お世話になっている整骨院様向けに作成した患者管理アプリです。
実際にこういうのが欲しいと言われた機能をヒアリングして作成しました。  

## 使用した言語やライブラリ
- フロントエンド
    - Next.js
    - React
    - Mantine UI
- バックエンド
    - Node.js
    - Express
    - Prisma
    - Zod
    - Jest
    - Supertest
    - Faker
- インフラ・CI/CD
    - GitHub Actions（型チェック、ビルド、Renderへの自動デプロイ）


## デプロイ先
- フロントエンド : vercel
- バックエンド : render

## ログインURL
https://www.patient-management-kubo-works-projects.com/doctor/login

## デモアカウント
ログインID: test_doctor@example.com  
パスワード: test

## 注意点
- renderが無料プランの関係で**レスポンスが50秒以上遅れる可能性があります。**

## 作成した機能
- ログイン機能
- 診察作成機能
- 診察履歴確認
- 診察編集機能
- 診察削除機能
- 患者作成機能
- 患者情報編集機能


