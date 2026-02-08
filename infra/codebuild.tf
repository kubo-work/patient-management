# infra/codebuild.tf
resource "aws_codebuild_project" "migrate" {
  name           = "${var.project}-${var.environment}-migrate"
  service_role   = aws_iam_role.codebuild_role.arn
  source_version = "feature/terraform"
  artifacts {
    type = "NO_ARTIFACTS"
  }


  environment {
    compute_type = "BUILD_GENERAL1_SMALL"
    image        = "aws/codebuild/standard:7.0"
    type         = "LINUX_CONTAINER"

    environment_variable {
      name  = "AWS_RDS_DATABASE_URL"
      value = "postgresql://${urlencode(var.db_username)}:${urlencode(var.db_password)}@${aws_db_instance.postgres.address}:5432/${var.db_name}"
      type  = "PLAINTEXT"
    }
  }

  source {
    type      = "GITHUB"
    location  = "https://github.com/kubo-work/patient-management.git"
    buildspec = "infra/buildspec.yml"

    # ブランチを指定
    git_clone_depth = 1
    git_submodules_config {
      fetch_submodules = false
    }
  }

  vpc_config {
    vpc_id             = aws_vpc.main.id
    subnets            = [aws_subnet.private_a.id]
    security_group_ids = [aws_security_group.codebuild_sg.id]
  }

  tags = {
    Name = "${var.project}-${var.environment}-codebuild-migrate"
  }
}
