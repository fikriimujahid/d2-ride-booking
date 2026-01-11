# ============================================================================
# Common Variables
# ============================================================================
variable "project" {
  description = "Project name"
  type        = string
  default     = "d2-ride-booking"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "ap-southeast-1"
}

variable "github_repo" {
  description = "GitHub repository name (org/repo)"
  type        = string
  default     = "fikriimujahid/d2-ride-booking" # Adjust default as needed
}

variable "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider (if set, creates a deploy role). Example: arn:aws:iam::<acct>:oidc-provider/token.actions.githubusercontent.com"
  type        = string
  default     = ""
}

variable "github_allowed_subs" {
  description = "Allowed GitHub OIDC subject patterns (token.actions.githubusercontent.com:sub). Leave empty to use module defaults based on github_repo."
  type        = list(string)
  default     = []
}

# ============================================================================
# Auth Module Variables
# ============================================================================
variable "cognito_tier" {
  description = "Cognito User Pool tier: 'LITE' (cheaper) or 'PLUS' (advanced security features)"
  type        = string
  default     = "LITE"
}

variable "password_min_length" {
  description = "Minimum password length (AWS minimum: 6, recommended: 12+)"
  type        = number
  default     = 12
}

variable "enable_mfa" {
  description = "Enable Multi-Factor Authentication (requires authentication app like Google Authenticator)"
  type        = bool
  default     = true
}

variable "enable_advanced_security" {
  description = "Enable Advanced Security Features (requires PLUS tier)"
  type        = bool
  default     = false
}

# ============================================================================
# Networking Module Variables
# ============================================================================
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.11.0/24"]
}

# ============================================================================
# Database Module Variables
# ============================================================================
variable "rds_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "rds_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 20
}

# ============================================================================
# Compute Module Variables
# ============================================================================
variable "instance_type_api" {
  type    = string
  default = "t3.micro"
}

variable "instance_type_websocket" {
  type    = string
  default = "t3.micro"
}

variable "instance_type_bastion" {
  type    = string
  default = "t3.micro"
}

# ============================================================================
# Bootstrap (Single EC2) Variables
# ============================================================================
variable "bootstrap_instance_type" {
  description = "Instance type for the single bootstrap EC2"
  type        = string
  default     = "t3.small"
}

variable "bootstrap_enable_ssh" {
  description = "Enable inbound SSH (22) to the bootstrap instance"
  type        = bool
  default     = false
}

variable "bootstrap_key_name" {
  description = "EC2 key pair name to use when bootstrap_enable_ssh=true"
  type        = string
  default     = null
}

variable "bootstrap_ssh_admin_cidrs" {
  description = "Admin CIDR blocks allowed to SSH when bootstrap_enable_ssh=true (e.g., ['203.0.113.10/32'])"
  type        = list(string)
  default     = []
}

variable "bootstrap_allowed_app_cidrs" {
  description = "CIDR blocks allowed to reach the API app port on the bootstrap instance (default: public)."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "bootstrap_extra_app_ports" {
  description = "Extra TCP ports to expose on the bootstrap instance (dev-only convenience; e.g., web_driver=3001, web_passenger=3002)."
  type        = list(number)
  default     = [3001, 3002]
}
