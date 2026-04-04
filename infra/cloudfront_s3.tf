resource "aws_s3_bucket" "front" {
  bucket = local.front_domain
}

resource "aws_cloudfront_origin_access_control" "front" {
  name                              = "s3-front-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "front" {
  origin {
    domain_name              = aws_s3_bucket.front.bucket_regional_domain_name
    origin_id                = "s3-front"
    origin_access_control_id = aws_cloudfront_origin_access_control.front.id
  }

  enabled             = true
  default_root_object = "index.html"
  aliases             = [local.front_domain]

  default_cache_behavior {
    target_origin_id       = "s3-front"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    forwarded_values {
      query_string = false
      cookies { forward = "none" }
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.front.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction { restriction_type = "none" }
  }
}

resource "aws_s3_bucket_policy" "front" {
  bucket = aws_s3_bucket.front.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid    = "AllowCloudFrontOAC"
      Effect = "Allow"
      Principal = {
        Service = "cloudfront.amazonaws.com"
      }
      Action   = "s3:GetObject"
      Resource = "${aws_s3_bucket.front.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.front.arn
        }
      }
    }]
  })
}

# Route53 → CloudFront
resource "aws_route53_record" "front" {
  zone_id = aws_route53_zone.front.zone_id
  name    = local.front_domain
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.front.domain_name
    zone_id                = aws_cloudfront_distribution.front.hosted_zone_id
    evaluate_target_health = false
  }
}
