# ------------------------------------------------------------
# ECS Cluster
# ------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "${var.project}-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  tags = {
    Name = "${var.project}-${var.environment}-cluster"
  }
}

# ------------------------------------------------------------
# CloudWatch Logs (ECS task)
# ------------------------------------------------------------
resource "aws_cloudwatch_log_group" "ecs_backend" {
  name              = "/ecs/${var.project}-${var.environment}-backend"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-${var.environment}-backend-logs"
  }
}

# ------------------------------------------------------------
# IAM: ECS Task Execution Role (ECR pull / Secrets / Logs)
# ------------------------------------------------------------
resource "aws_iam_role" "ecs_task_execution" {
  name = "${var.project}-${var.environment}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Secrets Manager から DATABASE_URL を取得する権限（execution role に必須）
resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["secretsmanager:GetSecretValue"]
      Resource = aws_secretsmanager_secret.database_url.arn
    }]
  })
}

# ------------------------------------------------------------
# IAM: ECS Task Role (アプリ自身が AWS API を叩く時に使用)
# ------------------------------------------------------------
resource "aws_iam_role" "ecs_task" {
  name = "${var.project}-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# ECS Exec（aws ecs execute-command）に必要な SSM 権限
resource "aws_iam_role_policy" "ecs_task_ssm" {
  name = "ssm-exec"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ssmmessages:CreateControlChannel",
        "ssmmessages:CreateDataChannel",
        "ssmmessages:OpenControlChannel",
        "ssmmessages:OpenDataChannel"
      ]
      Resource = "*"
    }]
  })
}

# ------------------------------------------------------------
# ECS Task Definition (Fargate)
# command で Prisma migrate deploy → API 起動
# ------------------------------------------------------------
resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project}-${var.environment}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64"
  }

  container_definitions = jsonencode([{
    name      = "backend"
    image     = "${aws_ecr_repository.backend.repository_url}:${var.image_tag}"
    essential = true

    portMappings = [{
      containerPort = 8080
      protocol      = "tcp"
    }]

    command = [
      "sh",
      "-c",
      "../../node_modules/.bin/prisma migrate deploy --schema ../db/prisma/schema.prisma && node scripts/seed-from-source.js && node build/index.js"
    ]

    environment = [
      { name = "NODE_ENV",        value = "production" },
      { name = "PORT",            value = "8080" },
      { name = "CLIENT_URL",      value = var.client_url },
      { name = "JWT_SECRET_KEY",  value = var.jwt_secret_key },
      # 空の RDS を作り直したときに、ここで指定した DB から初期データを取り込む。
      # 未設定ならスクリプトは何もしない。
      { name = "SOURCE_DATABASE_URL", value = var.source_database_url },
    ]

    # RDS には PgBouncer が無く pooled と直結の区別が無いため、両方に同じ値を割り当てる。
    # schema.prisma が directUrl を宣言している以上、DIRECT_URL が未設定だと
    # prisma migrate deploy が P1012 で起動時に失敗する。
    secrets = [
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "DIRECT_URL",   valueFrom = aws_secretsmanager_secret.database_url.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.ecs_backend.name
        awslogs-region        = data.aws_region.current.name
        awslogs-stream-prefix = "ecs"
      }
    }
  }])

  tags = {
    Name = "${var.project}-${var.environment}-backend"
  }
}

# ------------------------------------------------------------
# ECS Service
# ------------------------------------------------------------
resource "aws_ecs_service" "backend" {
  name            = "${var.project}-${var.environment}-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  enable_execute_command = true

  network_configuration {
    subnets          = [aws_subnet.private_a.id, aws_subnet.private_c.id]
    security_groups  = [aws_security_group.ecs_task_sg.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "backend"
    container_port   = 8080
  }

  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 200

  health_check_grace_period_seconds = 60

  lifecycle {
    ignore_changes = [task_definition]
  }

  depends_on = [aws_lb_listener.https]

  tags = {
    Name = "${var.project}-${var.environment}-backend"
  }
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  value = aws_ecs_service.backend.name
}
