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
  name = "${var.project}-${var.environment}-app-runner-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "build.apprunner.amazonaws.com" }
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
  connection_name = "${var.project}-${var.environment}-github-connection"
  provider_type   = "GITHUB"

  tags = {
    Name = "${var.project}-${var.environment}-github-connection"
  }
}

# ------------------------------------------------------------
# App Runner Service
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
          build_command = "cd backend && npm ci && npm install --production=false && npm run build"
          start_command = "cd backend && npx prisma migrate deploy && npm run start"
          port          = "3000"

          runtime_environment_secrets = {
            DATABASE_URL = aws_secretsmanager_secret_version.database_url.arn
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

  tags = {
    Name = "${var.project}-${var.environment}-app-runner"
  }
}

output "app_runner_url" {
  value = "https://${aws_apprunner_service.app.service_url}"
}
