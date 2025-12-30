variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "domain_name" {
  description = "The root domain name (e.g., fikri.dev)"
  type        = string
}

variable "subdomain_app" {
  description = "Subdomain for the main application (e.g., dev.d2)"
  type        = string
}

variable "subdomain_api" {
  description = "Subdomain for the API (e.g., api.dev.d2)"
  type        = string
}

variable "subdomain_ws" {
  description = "Subdomain for WebSocket (e.g., ws.dev.d2)"
  type        = string
}

variable "alb_dns_name" {
  description = "DNS name of the ALB"
  type        = string
}

variable "alb_zone_id" {
  description = "Zone ID of the ALB"
  type        = string
}
