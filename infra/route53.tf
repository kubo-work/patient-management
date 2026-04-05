# ルートゾーンを廃止し、サブドメインゾーンを2つ作る
resource "aws_route53_zone" "front" {
  name = local.front_domain
}

resource "aws_route53_zone" "api" {
  name = local.api_domain
}

output "front_name_servers" {
  value = aws_route53_zone.front.name_servers
}

output "api_name_servers" {
  value = aws_route53_zone.api.name_servers
}
