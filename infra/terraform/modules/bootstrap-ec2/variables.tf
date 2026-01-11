variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev, prod)"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "availability_zone" {
  description = "Availability Zone for the public subnet"
  type        = string
}

variable "ami_id" {
  description = "AMI ID for the EC2 instance (Amazon Linux 2023)"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "EC2 key pair name (required only if SSH is enabled)"
  type        = string
  default     = null
}

variable "enable_ssh" {
  description = "Whether to open SSH (22) to the instance"
  type        = bool
  default     = false
}

variable "ssh_admin_cidrs" {
  description = "CIDR blocks allowed to SSH to the instance (only used when enable_ssh=true)"
  type        = list(string)
  default     = []

  validation {
    condition = var.enable_ssh == false || (
      length(var.ssh_admin_cidrs) > 0 &&
      alltrue([for c in var.ssh_admin_cidrs : c != "0.0.0.0/0"]) &&
      alltrue([for c in var.ssh_admin_cidrs : can(regex("/32$", c))])
    )
    error_message = "When enable_ssh=true, ssh_admin_cidrs must be one or more /32 CIDRs and must not include 0.0.0.0/0."
  }
}

variable "app_port" {
  description = "Primary application port to expose (e.g., Fastify 3000). Ingress only opens if allowed_app_cidrs is non-empty (or falls back to ssh_admin_cidrs when enable_ssh=true)."
  type        = number
  default     = 3000
}

variable "extra_app_ports" {
  description = "Additional TCP ports to expose on the bootstrap instance (e.g., Next.js apps on 3001/3002). Uses the same allowed_app_cidrs gating as app_port."
  type        = list(number)
  default     = []

  validation {
    condition     = alltrue([for p in var.extra_app_ports : p >= 1 && p <= 65535])
    error_message = "extra_app_ports must contain valid TCP port numbers (1-65535)."
  }
}

variable "allowed_app_cidrs" {
  description = "CIDR blocks allowed to reach app_port. If empty and enable_ssh=true, defaults to ssh_admin_cidrs."
  type        = list(string)
  default     = []
}

variable "allowed_http_cidrs" {
  description = "CIDR blocks allowed to reach HTTP (80)"
  type        = list(string)
  default     = []
}

variable "allowed_https_cidrs" {
  description = "CIDR blocks allowed to reach HTTPS (443)"
  type        = list(string)
  default     = []
}

variable "enable_s3_versioning" {
  description = "Enable S3 versioning for the artifacts/logs bucket"
  type        = bool
  default     = false
}

variable "ssm_parameter_prefix" {
  description = "SSM Parameter Store path prefix that the instance can read (e.g., /mern-bootstrap)"
  type        = string
  default     = "/mern-bootstrap"
}

variable "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC provider (if set, creates a deploy role). Example: arn:aws:iam::<acct>:oidc-provider/token.actions.githubusercontent.com"
  type        = string
  default     = ""
}

variable "github_repo" {
  description = "GitHub repo in org/repo form (used to constrain OIDC subject claims)"
  type        = string
  default     = ""
}

variable "github_allowed_subs" {
  description = "Allowed OIDC subject patterns for GitHub Actions (token.actions.githubusercontent.com:sub)"
  type        = list(string)
  default     = []
}

variable "extra_deploy_s3_bucket_arns" {
  description = "Additional S3 bucket ARNs GitHub Actions deploy role may sync to (e.g., static site buckets)."
  type        = list(string)
  default     = []
}
