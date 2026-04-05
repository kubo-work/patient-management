# App RunnerのACM検証レコード
# ※ aws_apprunner_custom_domain_association.api が apply されるまで値が確定しないため
#    terraform import 時は app_runner_domain_validation.tf.bak に退避して使用する
resource "aws_route53_record" "api_apprunner_validation" {
  for_each = {
    for r in aws_apprunner_custom_domain_association.api.certificate_validation_records : r.name => r
  }
  zone_id = aws_route53_zone.api.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.value]
}
