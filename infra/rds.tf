resource "aws_db_subnet_group" "postgres" {
  name       = "${var.project}-${var.environment}-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_c.id]

  tags = {
    Name = "${var.project}-${var.environment}-subnet-group"
  }
}

resource "aws_db_instance" "postgres" {
  engine                  = "postgres"
  engine_version          = "15.10"
  instance_class          = "db.t3.micro"
  db_subnet_group_name    = aws_db_subnet_group.postgres.name
  allocated_storage       = 20
  storage_type            = "gp3"
  vpc_security_group_ids  = [aws_security_group.rds_sg.id]
  parameter_group_name    = aws_db_parameter_group.postgres.name
  backup_retention_period = 7
  backup_target           = "region"
  backup_window           = "02:00-06:00"
  skip_final_snapshot     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  tags = {
    Name = "${var.project}-${var.environment}-rds"
  }
}

resource "aws_db_parameter_group" "postgres" {
  name   = "${var.project}-${var.environment}-parameter-group"
  family = "postgres15"

  # スロークエリログ（0秒＝全クエリを記録）
  parameter {
    name         = "log_min_duration_statement"
    value        = "0"
    apply_method = "immediate"
  }

  # ログ出力先（CloudWatchに送信するためにはstderrにする）
  parameter {
    name         = "log_destination"
    value        = "stderr"
    apply_method = "immediate"
  }

  # クエリ実行中にログに記録する
  parameter {
    name         = "log_statement"
    value        = "all"
    apply_method = "immediate"
  }

  # タイムゾーン
  parameter {
    name         = "timezone"
    value        = "Asia/Tokyo"
    apply_method = "immediate"
  }
}

output "database_url" {
  value     = "postgresql://${urlencode(var.db_username)}:${urlencode(var.db_password)}@${aws_db_instance.postgres.address}:5432/${var.db_name}"
  sensitive = true
}
