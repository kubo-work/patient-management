# ------------------------------------------------------------
# ALB (Application Load Balancer)
# ------------------------------------------------------------
resource "aws_lb" "api" {
  name               = "${var.project}-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_c.id]

  idle_timeout = 60

  tags = {
    Name = "${var.project}-${var.environment}-alb"
  }
}

# ------------------------------------------------------------
# Target Group (ECS Fargate)
# ------------------------------------------------------------
resource "aws_lb_target_group" "api" {
  name        = "${var.project}-${var.environment}-tg"
  port        = 8080
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = aws_vpc.main.id

  deregistration_delay = 30

  health_check {
    path                = "/"
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.project}-${var.environment}-tg"
  }
}

# ------------------------------------------------------------
# HTTP Listener (80 → 443 リダイレクト)
# ------------------------------------------------------------
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ------------------------------------------------------------
# HTTPS Listener (443 → ECS Target Group)
# ------------------------------------------------------------
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.api.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ------------------------------------------------------------
# Route53 → ALB
# ------------------------------------------------------------
resource "aws_route53_record" "api" {
  zone_id         = aws_route53_zone.api.zone_id
  name            = local.api_domain
  type            = "A"
  allow_overwrite = true

  alias {
    name                   = aws_lb.api.dns_name
    zone_id                = aws_lb.api.zone_id
    evaluate_target_health = true
  }
}

output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "api_url" {
  value = "https://${local.api_domain}"
}
