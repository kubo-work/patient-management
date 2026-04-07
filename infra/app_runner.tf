data "aws_apprunner_hosted_zone_id" "current" {}

resource "aws_apprunner_custom_domain_association" "api" {
  domain_name = local.api_domain
  service_arn = aws_apprunner_service.app.arn
}

# App Runner 向けは apex（このゾーン名＝api ドメイン）のため CNAME は不可。Route 53 の ALIAS（A）を使う。
# https://docs.aws.amazon.com/apprunner/latest/dg/manage-custom-domains-route53.html
resource "aws_route53_record" "api" {
  zone_id = aws_route53_zone.api.zone_id
  name    = local.api_domain
  type    = "A"

  allow_overwrite = true

  alias {
    name                   = aws_apprunner_custom_domain_association.api.dns_target
    zone_id                = data.aws_apprunner_hosted_zone_id.current.id
    evaluate_target_health = true
  }
}


resource "aws_apprunner_vpc_connector" "connector" {
  vpc_connector_name = "${var.project}-${var.environment}-vpc-connector"
  subnets            = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  security_groups    = [aws_security_group.app_runner_sg.id]
  tags = {
    Name = "${var.project}-${var.environment}-vpc-connector"
  }
}

# ------------------------------------------------------------
# IAM Role for App Runner
# ------------------------------------------------------------
resource "aws_iam_role" "app_runner" {
  name = "pm-dev-app-runner-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "build.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}


resource "aws_iam_role" "app_runner_instance" {
  name = "pm-dev-app-runner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "tasks.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "app_runner" {
  role       = aws_iam_role.app_runner.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# ------------------------------------------------------------
# GitHub Connection（適用後にコンソールで認証が必要）
# ------------------------------------------------------------
resource "aws_apprunner_connection" "github" {
  connection_name = "pm-dev-github-connection"
  provider_type   = "GITHUB"

  tags = {
    Name = "${var.project}-${var.environment}-github-connection"
  }
}

# ------------------------------------------------------------
# App Runner Service（バックエンド API）
# ------------------------------------------------------------
resource "aws_apprunner_service" "app" {
  service_name = "${var.project}-${var.environment}-app-runner"

  source_configuration {
    authentication_configuration {
      connection_arn = aws_apprunner_connection.github.arn
    }

    code_repository {
      repository_url = "https://github.com/kubo-work/patient-management"

      source_code_version {
        type  = "BRANCH"
        value = "main"
      }

      code_configuration {
        configuration_source = "API"
        code_configuration_values {
          runtime       = "NODEJS_22"
          build_command = "sh scripts/app-runner-backend-build.sh"
          start_command = "sh scripts/app-runner-backend-start.sh"
          port          = "8080"

          runtime_environment_variables = {
            CLIENT_URL = var.client_url
            NODE_ENV   = "production"
          }

          runtime_environment_secrets = {
            DATABASE_URL = aws_secretsmanager_secret.database_url.arn
          }
        }
      }
    }

    auto_deployments_enabled = true
  }

  network_configuration {
    egress_configuration {
      egress_type       = "VPC"
      vpc_connector_arn = aws_apprunner_vpc_connector.connector.arn
    }
  }

  instance_configuration {
    instance_role_arn = aws_iam_role.app_runner_instance.arn
  }

  tags = {
    Name = "${var.project}-${var.environment}-app-runner"
  }
}

// ------------------------------------------------------------
// Output
// ------------------------------------------------------------
output "app_runner_url" {
  value = "https://${aws_apprunner_service.app.service_url}"
}

// ------------------------------------------------------------
// IAM Role Policy for App Runner Instance Secrets
// ------------------------------------------------------------
resource "aws_iam_role_policy" "app_runner_instance_secrets" {
  name = "secrets-access"
  role = aws_iam_role.app_runner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      # シークレット ARN は既に ...-6文字 形式。末尾に "-*" を付けると GetSecretValue と一致しないことがある
      Resource = aws_secretsmanager_secret.database_url.arn
    }]
  })
}

// ------------------------------------------------------------
// IAM Role Policy for App Runner Instance CloudWatch Logs
// ------------------------------------------------------------
resource "aws_iam_role_policy" "app_runner_instance_cloudwatch" {
  name = "cloudwatch-logs-access"
  role = aws_iam_role.app_runner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ]
      Resource = "arn:aws:logs:*:*:*"
    }]
  })
}
