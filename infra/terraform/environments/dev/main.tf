# ============================================================================
# Terraform Configuration
# ============================================================================

terraform {
  required_version = ">= 1.0" # Use Terraform v1+ for current syntax/features

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # Stick to AWS provider v5.x to avoid breaking changes
    }
  }

  backend "s3" {
    # Configuration loaded from backend.hcl
  }
}

# ============================================================================
# Provider Configuration
# ============================================================================
provider "aws" {
  region = var.aws_region # Set in variables.tf and terraform.tfvars

  default_tags {
    tags = {
      project     = var.project
      environment = var.environment
      managed_by  = "terraform"
    }
  }
}

# ----------------------------------------------------------------------------
# Secondary AWS provider alias (us-east-1)
# ----------------------------------------------------------------------------
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

# ============================================================================
# Variables vs Locals
# ============================================================================

locals {
  common_tags = {
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ============================================================================
# Networking Module
# ============================================================================
module "networking" {
  source = "../../modules/networking"

  project     = var.project
  environment = var.environment

  # VPC and Subnets
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# ============================================================================
# DNS & ACM Module
# ============================================================================
# module "dns" {
#   source = "../../modules/dns-acm"

#   project     = var.project
#   environment = var.environment

#   # Domains
#   domain_name   = "fikri.dev"
#   subdomain_app = "dev.d2"
#   subdomain_api = "api.dev.d2"
#   subdomain_ws  = "ws.dev.d2"

#   # Load Balancer (Placeholder - usually from alb module outputs)
#   # Since ALB logic isn't fully implemented here yet, we'll placeholder it for now
#   # In a complete flow: alb_dns_name = module.alb.dns_name
#   alb_dns_name = "placeholder-alb.us-east-1.elb.amazonaws.com"
#   alb_zone_id  = "Z35SXDOTRQ7X7K" # Valid ALB Zone ID for us-east-1 (example)
# }

