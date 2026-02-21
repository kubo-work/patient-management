# ------------------------------------------------------------
# Security group
# ------------------------------------------------------------


resource "aws_security_group" "rds_sg" {
  name   = "rds-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_runner_sg.id]
  }
}

resource "aws_security_group" "app_runner_sg" {
  name        = "${var.project}-${var.environment}-app-runner-sg"
  vpc_id      = aws_vpc.main.id
  description = "VPC Connector Security Group"

  egress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project}-${var.environment}-app-runner-sg"
  }
}
