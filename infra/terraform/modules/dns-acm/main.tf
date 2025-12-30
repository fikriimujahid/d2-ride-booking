# ==============================================================================
# DNS AND ACM CONFIGURATION
# ==============================================================================

# ------------------------------------------------------------------------------
# Data Sources
# ------------------------------------------------------------------------------
data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

# ------------------------------------------------------------------------------
# ACM Certificate
# ------------------------------------------------------------------------------
resource "aws_acm_certificate" "main" {
  domain_name = "${var.subdomain_app}.${var.domain_name}"
  subject_alternative_names = [
    "${var.subdomain_api}.${var.domain_name}",
    "${var.subdomain_ws}.${var.domain_name}"
  ]
  validation_method = "DNS"

  tags = {
    Name        = "${var.project}-${var.environment}-cert"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ------------------------------------------------------------------------------
# Route 53 Records for Validation
# ------------------------------------------------------------------------------
resource "aws_route53_record" "validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

# ------------------------------------------------------------------------------
# ACM Validation
# ------------------------------------------------------------------------------
resource "aws_acm_certificate_validation" "main" {
  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for record in aws_route53_record.validation : record.fqdn]
}

# ------------------------------------------------------------------------------
# DNS Records (A Records pointing to ALB)
# ------------------------------------------------------------------------------
resource "aws_route53_record" "app" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.subdomain_app}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.subdomain_api}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "ws" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.subdomain_ws}.${var.domain_name}"
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = true
  }
}
