output "certificate_arn" {
  description = "ARN of the validated ACM certificate"
  value       = aws_acm_certificate.main.arn
}

output "zone_id" {
  description = "Hosted Zone ID"
  value       = data.aws_route53_zone.main.zone_id
}

output "app_fqdn" {
  description = "FQDN for the App"
  value       = "${var.subdomain_app}.${var.domain_name}"
}

output "api_fqdn" {
  description = "FQDN for the API"
  value       = "${var.subdomain_api}.${var.domain_name}"
}

output "ws_fqdn" {
  description = "FQDN for WebSocket"
  value       = "${var.subdomain_ws}.${var.domain_name}"
}
