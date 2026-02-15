# ------------------------------------------------------------
# Systems Manager Parameter Store
# ------------------------------------------------------------
# GitHub ActionsからRDS接続情報を取得するため
resource "aws_ssm_parameter" "database_url" {
  name        = "/${var.project}/${var.environment}/rds/database_url"
  description = "PostgreSQL database connection URL"
  type        = "SecureString"
  value       = "postgresql://${urlencode(var.db_username)}:${urlencode(var.db_password)}@${aws_db_instance.postgres.address}:5432/${var.db_name}"

  tags = {
    Name = "${var.project}-${var.environment}-database-url"
  }
}

# RDSのエンドポイントのみ（デバッグ用）
resource "aws_ssm_parameter" "rds_endpoint" {
  name        = "/${var.project}/${var.environment}/rds/endpoint"
  description = "RDS endpoint address"
  type        = "String"
  value       = aws_db_instance.postgres.address

  tags = {
    Name = "${var.project}-${var.environment}-rds-endpoint"
  }
}
