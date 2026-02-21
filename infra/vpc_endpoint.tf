# ------------------------------------------------------------
# VPC Endpoint
# ------------------------------------------------------------
# resource "aws_vpc_endpoint" "s3" {
#   vpc_id            = aws_vpc.main.id
#   service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
#   vpc_endpoint_type = "Gateway"
#   route_table_ids   = aws_route_table.private[*].id

#   tags = {
#     Name = "${var.project}-${var.environment}-s3-vpcep"
#   }
# }


# resource "aws_vpc_endpoint" "cloudwatch" {
#   vpc_id              = aws_vpc.main.id
#   service_name        = "com.amazonaws.${data.aws_region.current.name}.logs"
#   vpc_endpoint_type   = "Interface"
#   private_dns_enabled = true
#   subnet_ids          = aws_subnet.private[*].id
#   security_group_ids  = [aws_security_group.vpc_endpoint.id]
#   tags = {
#     Name = "${var.project}-${var.environment}-ecr-api-webapp"
#   }
# }

# resource "aws_vpc_endpoint" "rds" {
#   vpc_id              = aws_vpc.main.id
#   service_name        = "com.amazonaws.${data.aws_region.current.name}.rds"
#   vpc_endpoint_type   = "Interface"
#   private_dns_enabled = true
#   subnet_ids          = aws_subnet.private[*].id
#   security_group_ids  = [aws_security_group.vpc_endpoint.id]
#   tags = {
#     Name = "${var.project}-${var.environment}-rds"
#   }
# }
