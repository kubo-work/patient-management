# ------------------------------------------------------------
# VPC Endpoint
# ------------------------------------------------------------

resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  security_group_ids  = [aws_security_group.vpc_endpoint_sg.id]

  tags = {
    Name = "${var.project}-${var.environment}-secretsmanager-vpcep"
  }
}

# 同一 VPC に logs 用 Interface エンドポイント（private DNS 有効）が既にあると、
# 2 つ目は作れずこのエラーになる: conflicting DNS domain for logs.<region>.amazonaws.com
# 解決: 既存を state に取り込む（推奨）
#   aws ec2 describe-vpc-endpoints --filters Name=vpc-id,Values=<VPC_ID> Name=service-name,Values=com.amazonaws.<region>.logs --query 'VpcEndpoints[0].VpcEndpointId' --output text
#   terraform import aws_vpc_endpoint.cloudwatch_logs vpce-xxxxxxxx
resource "aws_vpc_endpoint" "cloudwatch_logs" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.logs"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  subnet_ids          = [aws_subnet.private_a.id, aws_subnet.private_c.id]
  security_group_ids  = [aws_security_group.vpc_endpoint_sg.id]

  tags = {
    Name = "${var.project}-${var.environment}-cloudwatch-logs-vpcep"
  }
}
