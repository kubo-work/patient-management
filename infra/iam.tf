# ------------------------------------------------------------
# IAM Role for CodeBuild
# ------------------------------------------------------------
resource "aws_iam_role" "codebuild_role" {
  name = "${var.project}-${var.environment}-codebuild-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "codebuild.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project}-${var.environment}-codebuild-role"
  }
}

# CloudWatch Logs policy
resource "aws_iam_role_policy" "codebuild_logs" {
  role = aws_iam_role.codebuild_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# VPC access policy
resource "aws_iam_role_policy" "codebuild_vpc" {
  role = aws_iam_role.codebuild_role.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ec2:CreateNetworkInterface",
          "ec2:DescribeNetworkInterfaces",
          "ec2:DeleteNetworkInterface",
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeDhcpOptions",
          "ec2:DescribeVpcs",
          "ec2:CreateNetworkInterfacePermission",
          "codestar-connections:UseConnection",
          "codestar-connections:ListConnections",
          "codestar-connections:GetConnection",
          "codestar-connections:UseConnection"
        ]
        Resource = "*"
      }
    ]
  })
}
