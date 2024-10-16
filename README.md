# patient-management
## 概要
医心堂鍼灸整骨院 という私が毎週お世話になっている滋賀県米原市に存在する整骨院様向けに作成した患者管理アプリです。
実際にこういうのが欲しいと言われた機能をヒアリングして作成しました。
※ただしまだ途中です。
[医心堂鍼灸整骨院 サイトURL](https://3066.jp/)

## 使用した言語やライブラリ ※一部です
- フロントエンド
    - NextJS
    - React
    - mantine ui
- バックエンド
    - NodeJS
    - express
    - prisma

## デプロイ先
- フロントエンド : vercel
- バックエンド : render

## ログインURL
https://patient-management-kubo-works-projects.vercel.app/doctor/login

## 注意点
1. ログインに成功すると /doctor/dashboard  に行きますが、この画面は未着手なのでメイン部分は真っ白な状態です。
2. renderが無料プランの関係で**レスポンスが50秒以上遅れる可能性があります。**

## 作成した機能
- ログイン機能
- 診察作成機能
- 診察履歴確認
- 診察編集機能
- 診察削除機能

## 未着手の機能
- 患者作成機能
- 患者情報編集機能
