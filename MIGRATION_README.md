# Database Migration with GitHub Actions

このプロジェクトでは、GitHub Actionsを使用してプライベートRDSへのマイグレーションを実行します。

## セットアップ手順

### 1. Terraform apply

```bash
cd infra
terraform apply
```

これにより以下が作成されます：
- RDS（PostgreSQL）
- SSM Parameter Store（データベースURL）
- GitHub Actions用のIAMロール

### 2. GitHub ActionsロールARNを確認

```bash
terraform output github_actions_role_arn
```

出力例：
```
arn:aws:iam::438465142992:role/patient-management-dev-github-actions-role
```

### 3. GitHub Secretsに設定

GitHubリポジトリの Settings > Secrets and variables > Actions で以下を設定：

| Secret名 | 値 |
|---------|---|
| `AWS_ROLE_ARN` | 上記で取得したARN |

### 4. マイグレーション実行

1. GitHubリポジトリの **Actions** タブに移動
2. **Database Migration** ワークフローを選択
3. **Run workflow** をクリック
4. Environment を選択（dev/prod）
5. **Run workflow** で実行

## 仕組み

```
GitHub Actions起動
  ↓
AWS OIDC認証（IAMロール引き受け）
  ↓
SSM Parameter StoreからDATABASE_URLを取得
  ↓
Prisma migrateを実行
  ↓
完了 ✅
```

## RDSを再作成した場合

```bash
terraform destroy
terraform apply
```

→ **自動的にSSM Parameter Storeも更新されます**
→ GitHub Actionsは次回実行時に新しいURLを取得
→ **手動更新不要！**

## デバッグ

### Parameter Storeの値を確認

```bash
aws ssm get-parameter \
  --name "/patient-management/dev/rds/database_url" \
  --with-decryption \
  --query Parameter.Value \
  --output text
```

### ローカルでマイグレーション実行

```bash
# Parameter Storeから取得
export DATABASE_URL=$(aws ssm get-parameter \
  --name "/patient-management/dev/rds/database_url" \
  --with-decryption \
  --query Parameter.Value \
  --output text)

# マイグレーション実行
cd backend
npx prisma migrate deploy
```

## トラブルシューティング

### GitHub Actionsでエラーが出る場合

1. **IAMロールの権限を確認**
   ```bash
   aws iam get-role-policy \
     --role-name patient-management-dev-github-actions-role \
     --policy-name ssm-parameter-access
   ```

2. **Parameter Storeの値を確認**
   上記のデバッグコマンドを実行

3. **GitHub Actionsのログを確認**
   Actions タブ > 失敗したワークフロー > ログを確認

## コスト

- SSM Parameter Store: 無料枠内
- GitHub Actions: パブリックリポジトリは無料
- IAM: 無料

**CodeBuildと比較して、コストは変わりません（むしろ下がる可能性）**
