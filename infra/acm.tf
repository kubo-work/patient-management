# フロントエンド用証明書（CloudFrontはus-east-1必須）
resource "aws_acm_certificate" "front" {
  provider          = aws.us_east_1
  domain_name       = local.front_domain
  validation_method = "DNS"
}

# ACM証明書の検証レコード
resource "aws_route53_record" "front_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.front.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  zone_id = aws_route53_zone.front.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "front" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.front.arn
  validation_record_fqdns = [for r in aws_route53_record.front_cert_validation : r.fqdn]
}

# バックエンド用証明書（App Runnerのリージョンに合わせる）
resource "aws_acm_certificate" "api" {
  domain_name       = local.api_domain
  validation_method = "DNS"
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }
  zone_id = aws_route53_zone.api.zone_id
  name    = each.value.name
  type    = each.value.type
  records = [each.value.record]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for r in aws_route53_record.api_cert_validation : r.fqdn]
}
