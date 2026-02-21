# ------------------------------------------------------------
# Security group
# ------------------------------------------------------------


resource "aws_security_group" "rds_sg" {
  name   = "rds-sg"
  vpc_id = aws_vpc.main.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"] # 仮。あとでApp Runner SGに変更
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

# resource "aws_security_group" "vpc_endpoint" {
#   name        = "${var.project}-${var.environment}-vpc-endpoint-sg"
#   vpc_id      = aws_vpc.main.id
#   description = "Allow HTTPS inbound traffic,and HTTPS outbound traffic."
#   tags = {
#     Name = "${var.project}-${var.environment}-vpc-endpoint-sg"
#   }
# }

# resource "aws_security_group_rule" "vpcep_in_https" {
#   type              = "ingress"
#   protocol          = "tcp"
#   from_port         = 443
#   to_port           = 443
#   security_group_id = aws_security_group.vpc_endpoint.id
#   cidr_blocks       = [aws_vpc.main.cidr_block]
# }

# resource "aws_security_group_rule" "vpcep_out_https" {
#   type              = "egress"
#   protocol          = "tcp"
#   from_port         = 443
#   to_port           = 443
#   security_group_id = aws_security_group.vpc_endpoint.id
#   cidr_blocks       = [aws_vpc.main.cidr_block]
# }
