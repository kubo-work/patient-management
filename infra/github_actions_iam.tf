# ------------------------------------------------------------
# IAM Role for GitHub Actions OIDC
# ------------------------------------------------------------
data "aws_caller_identity" "current" {}

# GitHub Actions用のOIDCプロバイダー
resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://token.actions.githubusercontent.com"

  client_id_list = [
    "sts.amazonaws.com",
  ]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd"
  ]

  tags = {
    Name = "${var.project}-github-actions-oidc"
  }
}

# GitHub Actionsが引き受けるロール
resource "aws_iam_role" "github_actions" {
  name = "${var.project}-${var.environment}-github-actions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          }
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:kubo-work/patient-management:*"
          }
        }
      }
    ]
  })

  tags = {
    Name = "${var.project}-${var.environment}-github-actions-role"
  }
}

# SSM Parameter Storeへのアクセス権限
resource "aws_iam_role_policy" "github_actions_ssm" {
  name = "ssm-parameter-access"
  role = aws_iam_role.github_actions.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = [
          "arn:aws:ssm:ap-northeast-1:${data.aws_caller_identity.current.account_id}:parameter/${var.project}/${var.environment}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = "*"
      }
    ]
  })
}

# ロールARNを出力（GitHub Secretsに設定する）
output "github_actions_role_arn" {
  value       = aws_iam_role.github_actions.arn
  description = "IAM Role ARN for GitHub Actions (set this as AWS_ROLE_ARN secret)"
}
