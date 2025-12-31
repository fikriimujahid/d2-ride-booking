# ============================================================================
# Authentication Module - Output Values
# ============================================================================
output "user_pool_id" {
  description = "The unique ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_client_id" {
  description = "The unique ID of the Cognito User Pool Client for web applications"
  value       = aws_cognito_user_pool_client.web.id
}

output "user_pool_client_secret" {
  description = "The client secret for the Cognito User Pool Client (Sensitive)"
  value       = aws_cognito_user_pool_client.web.client_secret
  sensitive   = true
}

output "user_pool_arn" {
  description = "The ARN (Amazon Resource Name) of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}
