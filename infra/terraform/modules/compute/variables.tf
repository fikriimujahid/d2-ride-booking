variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "public_subnet_ids" {
  description = "List of public subnet IDs"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs"
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security Group ID for ALB"
  type        = string
}

variable "app_security_group_id" {
  description = "Security Group ID for Application Instances"
  type        = string
}

variable "bastion_security_group_id" {
  description = "Security Group ID for Bastion"
  type        = string
}

variable "instance_type_api" {
  description = "Instance type for API server"
  type        = string
  default     = "t3.micro"
}

variable "instance_type_websocket" {
  description = "Instance type for WebSocket server"
  type        = string
  default     = "t3.micro"
}

variable "instance_type_bastion" {
  description = "Instance type for Bastion hosst"
  type        = string
  default     = "t3.micro"
}

variable "iam_instance_profile_api" {
  description = "IAM Instance Profile name for API"
  type        = string
}

variable "iam_instance_profile_websocket" {
  description = "IAM Instance Profile name for WebSocket"
  type        = string
}

variable "iam_instance_profile_bastion" {
  description = "IAM Instance Profile name for Bastion"
  type        = string
}

variable "ami_id" {
  description = "AMI ID for instances (Amazon Linux 2023)"
  type        = string
}

variable "key_name" {
  description = "SSH Key pair name (optional)"
  type        = string
  default     = null
}

variable "acm_certificate_arn" {
  description = "ARN of ACM certificate for HTTPS (optional for dev)"
  type        = string
  default     = null
}

variable "asg_min_size" {
  type    = number
  default = 1
}

variable "asg_max_size" {
  type    = number
  default = 2
}

variable "asg_desired_capacity" {
  type    = number
  default = 1
}

# New Data Variables for Customization
variable "user_data_api" {
  description = "User data script for API instances (base64 encoded or plain text)"
  type        = string
  default     = <<-EOF
              #!/bin/bash
              yum update -y
              EOF
}

variable "user_data_websocket" {
  description = "User data script for WebSocket instances"
  type        = string
  default     = <<-EOF
              #!/bin/bash
              yum update -y
              EOF
}

variable "user_data_bastion" {
  description = "User data script for Bastion host"
  type        = string
  default     = <<-EOF
              #!/bin/bash
              yum update -y
              EOF
}

variable "enable_bastion" {
  description = "Enable Bastion host creation"
  type        = bool
  default     = true
}
