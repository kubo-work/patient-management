resource "aws_apprunner_vpc_connector" "connector" {
  vpc_connector_name = "${var.project}-${var.environment}-vpc-connector"
  subnets            = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  security_groups    = [aws_security_group.app_runner_sg.id]
  tags = {
    Name = "${var.project}-${var.environment}-vpc-connector"
  }
}
