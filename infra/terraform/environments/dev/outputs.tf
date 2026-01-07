# ============================================================================
# Dev Outputs (Bootstrap)
# ============================================================================

output "cognito_user_pool_id" {
	description = "Cognito User Pool ID"
	value       = module.auth.user_pool_id
}

output "cognito_spa_client_id" {
	description = "Cognito SPA client ID (safe for frontend)"
	value       = module.auth.user_pool_client_id
}

output "cognito_server_client_id" {
	description = "Cognito server client ID (backend-only)"
	value       = module.auth.user_pool_client_id_server
}

output "bootstrap_instance_id" {
	description = "Bootstrap EC2 instance ID"
	value       = module.bootstrap.instance_id
}

output "bootstrap_elastic_ip" {
	description = "Bootstrap Elastic IP"
	value       = module.bootstrap.elastic_ip
}

output "bootstrap_s3_bucket" {
	description = "S3 bucket for artifacts/logs"
	value       = module.bootstrap.s3_bucket_name
}

output "github_actions_deploy_role_arn" {
	description = "Optional GitHub Actions deploy role ARN (OIDC)"
	value       = module.bootstrap.github_actions_deploy_role_arn
}

output "frontend_admin_website_url" {
	description = "Admin frontend public S3 website URL (HTTP)"
	value       = module.frontend_admin.website_url
}

output "frontend_driver_website_url" {
	description = "Driver frontend public S3 website URL (HTTP)"
	value       = module.frontend_driver.website_url
}

output "frontend_passenger_website_url" {
	description = "Passenger frontend public S3 website URL (HTTP)"
	value       = module.frontend_passenger.website_url
}
