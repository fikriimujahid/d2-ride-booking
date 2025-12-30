# ============================================================================
# IAM Role Outputs
# ============================================================================
output "ridebooking_ec2_api_role_arn" {
  description = "ARN of the ridebooking-ec2-api-role"
  value       = aws_iam_role.ridebooking_ec2_api_role.arn
}

output "ridebooking_ec2_websocket_role_arn" {
  description = "ARN of the ridebooking_ec2_websocket_role"
  value       = aws_iam_role.ridebooking_ec2_websocket_role.arn
}

output "ridebooking_bastion_role_arn" {
  description = "ARN of the ridebooking_bastion_role"
  value       = aws_iam_role.ridebooking_bastion_role.arn
}

output "ridebooking_rds_monitoring_role_arn" {
  description = "ARN of the ridebooking_rds_monitoring_role"
  value       = aws_iam_role.ridebooking_rds_monitoring_role.arn
}

output "github_actions_deploy_role_arn" {
  description = "ARN of the github_actions_deploy_role"
  value       = aws_iam_role.github_actions_deploy_role.arn
}
