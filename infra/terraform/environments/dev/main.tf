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

# ----------------------------------------------------------------------------
# Data Sources
# ----------------------------------------------------------------------------
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

locals {
  common_tags = {
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ============================================================================
# Auth Module
# ============================================================================

module "auth" {
  source = "../../modules/auth"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags

  cognito_tier             = var.cognito_tier
  password_min_length      = var.password_min_length
  enable_mfa               = var.enable_mfa
  enable_advanced_security = var.enable_advanced_security
}

# ============================================================================
# Bootstrap (Single EC2 in Public Subnet)
# ============================================================================
module "bootstrap" {
  source = "../../modules/bootstrap-ec2"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags

  vpc_cidr            = var.vpc_cidr
  availability_zone   = var.availability_zones[0]
  public_subnet_cidr  = var.public_subnet_cidrs[0]
  ami_id              = data.aws_ami.amazon_linux_2023.id
  instance_type       = var.bootstrap_instance_type

  enable_ssh      = var.bootstrap_enable_ssh
  key_name        = var.bootstrap_key_name
  ssh_admin_cidrs = var.bootstrap_ssh_admin_cidrs

  allowed_app_cidrs = var.bootstrap_allowed_app_cidrs

  github_oidc_provider_arn = var.github_oidc_provider_arn
  github_repo              = var.github_repo
  github_allowed_subs       = var.github_allowed_subs
}

# ============================================================================
# Static Frontends (Public S3 Website)
# NOTE: S3 website endpoints are HTTP-only. This is intentionally minimal.
# ============================================================================
module "frontend_admin" {
  source = "../../modules/static-site-s3"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags

  site_name = "admin"
}

module "frontend_driver" {
  source = "../../modules/static-site-s3"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags

  site_name = "driver"
}

module "frontend_passenger" {
  source = "../../modules/static-site-s3"

  project     = var.project
  environment = var.environment
  tags        = local.common_tags

  site_name = "passenger"
}

# ============================================================================
# Networking Module
# ============================================================================
# module "networking" {
#   source = "../../modules/networking"

#   project     = var.project
#   environment = var.environment

#   # VPC and Subnets
#   vpc_cidr             = var.vpc_cidr
#   availability_zones   = var.availability_zones
#   public_subnet_cidrs  = var.public_subnet_cidrs
#   private_subnet_cidrs = var.private_subnet_cidrs
# }

# ============================================================================
# Database Module
# ============================================================================
# module "database" {
#   source = "../../modules/database"

#   project     = var.project
#   environment = var.environment

#   vpc_id             = module.networking.vpc_id
#   private_subnet_ids = module.networking.private_subnet_ids
#   allowed_security_groups = [
#     module.networking.app_security_group_id,
#     module.networking.bastion_security_group_id
#   ]

#   # Database Configuration
#   rds_instance_class    = var.rds_instance_class
#   rds_allocated_storage = var.rds_allocated_storage

#   # Dev configuration (fixed)
#   multi_az     = false # Single-AZ for dev
#   enable_redis = false # Redis only for prod
# }

# ============================================================================
# Compute Module
# ============================================================================
# module "compute" {
#   source = "../../modules/compute"

#   project     = var.project
#   environment = var.environment

#   vpc_id             = module.networking.vpc_id
#   public_subnet_ids  = module.networking.public_subnet_ids
#   private_subnet_ids = module.networking.private_subnet_ids

#   # Security Groups
#   alb_security_group_id     = module.networking.alb_security_group_id
#   app_security_group_id     = module.networking.app_security_group_id
#   bastion_security_group_id = module.networking.bastion_security_group_id

#   # AMI (Amazon Linux 2023)
#   ami_id = data.aws_ami.amazon_linux_2023.id

#   # Instance Types
#   instance_type_api       = var.instance_type_api
#   instance_type_websocket = var.instance_type_websocket
#   instance_type_bastion   = var.instance_type_bastion

#   # IAM Instance Profiles (Hardcoded as shared/global resources)
#   iam_instance_profile_api       = "ridebooking-ec2-api-profile"
#   iam_instance_profile_websocket = "ridebooking-ec2-websocket-profile"
#   iam_instance_profile_bastion   = "ridebooking-bastion-profile"

#   # Auto Scaling
#   asg_min_size         = 1
#   asg_max_size         = 2
#   asg_desired_capacity = 1

#   # Dev Specific Configuration
#   enable_bastion = true

#   # Simple user data for dev (just updates)
#   user_data_api = <<-EOF
#               #!/bin/bash
#               yum update -y
#               echo "Hello from API Dev Node" > /home/ec2-user/hello.txt
#               EOF

#   user_data_websocket = <<-EOF
#               #!/bin/bash
#               yum update -y
#               echo "Hello from WebSocket Dev Node" > /home/ec2-user/hello.txt
#               EOF

#   # Optional
#   # acm_certificate_arn = ... (Not used in dev usually)
# }

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

