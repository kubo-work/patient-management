resource "aws_iam_policy" "patient_management" {
  name = "AWSPatientManagementPolicy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "VisualEditor0"
        Effect = "Allow"
        Action = [
          "iam:*",
          "cloudfront:*",
          "secretsmanager:*",
          "rds:*",
          "cloudwatch:*",
          "logs:*",
          "s3:*",
          "route53:*",
          "ec2:*",
          "apprunner:*",
          "codestar-connections:*",
          "codebuild:*",
          "acm:*"
        ]
        Resource = "*"
      }
    ]
  })
}
