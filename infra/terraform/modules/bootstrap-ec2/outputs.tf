output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_id" {
  description = "Public subnet ID"
  value       = aws_subnet.public.id
}

output "security_group_id" {
  description = "Security group ID for the instance"
  value       = aws_security_group.app.id
}

output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.app.id
}

output "instance_private_ip" {
  description = "EC2 private IP"
  value       = aws_instance.app.private_ip
}

output "instance_public_dns" {
  description = "EC2 public DNS name"
  value       = aws_instance.app.public_dns
}

output "elastic_ip" {
  description = "Elastic IP address"
  value       = aws_eip.app.public_ip
}

output "s3_bucket_name" {
  description = "S3 bucket name for artifacts/logs"
  value       = aws_s3_bucket.bootstrap.bucket
}

output "ec2_role_arn" {
  description = "IAM role ARN attached to the instance"
  value       = aws_iam_role.ec2.arn
}

output "ec2_instance_profile_name" {
  description = "Instance profile name attached to the instance"
  value       = aws_iam_instance_profile.ec2.name
}

output "github_actions_deploy_role_arn" {
  description = "Optional GitHub Actions deploy role ARN (empty if not created)"
  value       = length(aws_iam_role.github_actions_deploy) > 0 ? aws_iam_role.github_actions_deploy[0].arn : ""
}
