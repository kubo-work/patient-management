# ============================================================
# CloudWatch Log Groups
# ============================================================

resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/instance/${aws_db_instance.postgres.identifier}/postgresql"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-${var.environment}-rds-postgresql-logs"
  }
}

resource "aws_cloudwatch_log_group" "rds_upgrade" {
  name              = "/aws/rds/instance/${aws_db_instance.postgres.identifier}/upgrade"
  retention_in_days = 14

  tags = {
    Name = "${var.project}-${var.environment}-rds-upgrade-logs"
  }
}

# ============================================================
# CloudWatch Alarms - RDS
# ============================================================

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${var.project}-${var.environment}-rds-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU使用率が80%を超えました"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${var.project}-${var.environment}-rds-free-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 2000000000 # 2GB
  alarm_description   = "RDS 空きストレージが2GB未満になりました"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${var.project}-${var.environment}-rds-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 50
  alarm_description   = "RDS 接続数が50を超えました"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.identifier
  }
}

# ============================================================
# CloudWatch Alarms - ACM（証明書有効期限監視）
# ============================================================

# フロントエンド証明書は us-east-1 で発行されているため provider を合わせる
resource "aws_cloudwatch_metric_alarm" "acm_front_expiry" {
  provider            = aws.us_east_1
  alarm_name          = "${var.project}-${var.environment}-acm-front-expiry"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DaysToExpiry"
  namespace           = "AWS/CertificateManager"
  period              = 86400
  statistic           = "Minimum"
  threshold           = 30
  alarm_description   = "フロントエンド ACM 証明書の有効期限が30日以内になりました"

  dimensions = {
    CertificateArn = aws_acm_certificate.front.arn
  }
}

resource "aws_cloudwatch_metric_alarm" "acm_api_expiry" {
  alarm_name          = "${var.project}-${var.environment}-acm-api-expiry"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "DaysToExpiry"
  namespace           = "AWS/CertificateManager"
  period              = 86400
  statistic           = "Minimum"
  threshold           = 30
  alarm_description   = "API ACM 証明書の有効期限が30日以内になりました"

  dimensions = {
    CertificateArn = aws_acm_certificate.api.arn
  }
}

# ============================================================
# CloudWatch Alarms - CloudFront（メトリクスは us-east-1 で管理）
# ============================================================

resource "aws_cloudwatch_metric_alarm" "cloudfront_4xx" {
  provider            = aws.us_east_1
  alarm_name          = "${var.project}-${var.environment}-cloudfront-4xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "4xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 5
  alarm_description   = "CloudFront 4xxエラー率が5%を超えました"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.front.id
    Region         = "Global"
  }
}

resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  provider            = aws.us_east_1
  alarm_name          = "${var.project}-${var.environment}-cloudfront-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "5xxErrorRate"
  namespace           = "AWS/CloudFront"
  period              = 300
  statistic           = "Average"
  threshold           = 1
  alarm_description   = "CloudFront 5xxエラー率が1%を超えました"

  dimensions = {
    DistributionId = aws_cloudfront_distribution.front.id
    Region         = "Global"
  }
}

# ============================================================
# CloudWatch Alarms - App Runner
# ============================================================

resource "aws_cloudwatch_metric_alarm" "app_runner_5xx" {
  alarm_name          = "${var.project}-${var.environment}-app-runner-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Http5xxCount"
  namespace           = "AWS/AppRunner"
  period              = 300
  statistic           = "Sum"
  threshold           = 10
  alarm_description   = "App Runner 5xxエラーが10件を超えました"

  dimensions = {
    ServiceName = aws_apprunner_service.app.service_name
  }
}

resource "aws_cloudwatch_metric_alarm" "app_runner_request_latency" {
  alarm_name          = "${var.project}-${var.environment}-app-runner-latency-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "RequestLatency"
  namespace           = "AWS/AppRunner"
  period              = 300
  extended_statistic  = "p99"
  threshold           = 5000
  alarm_description   = "App Runner リクエストのp99レイテンシが5秒を超えました"

  dimensions = {
    ServiceName = aws_apprunner_service.app.service_name
  }
}
