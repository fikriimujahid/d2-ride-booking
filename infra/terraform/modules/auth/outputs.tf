# ============================================================================
# Authentication Module - Output Values
# ============================================================================
output "user_pool_id" {
  description = "The unique ID of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_client_id" {
  description = "The unique ID of the Cognito User Pool Client for SPA/browser apps (no secret)"
  value       = aws_cognito_user_pool_client.web.id
}

output "user_pool_client_secret" {
  description = "The client secret for the server-side Cognito User Pool Client (Sensitive)"
  value       = aws_cognito_user_pool_client.server.client_secret
  sensitive   = true
}

output "user_pool_client_id_server" {
  description = "The unique ID of the server-side Cognito User Pool Client"
  value       = aws_cognito_user_pool_client.server.id
}

output "user_pool_arn" {
  description = "The ARN (Amazon Resource Name) of the Cognito User Pool"
  value       = aws_cognito_user_pool.main.arn
}

output "user_pool_group_names" {
  description = "Cognito User Pool Groups used as roles"
  value = {
    admin     = aws_cognito_user_group.admin.name
    passenger = aws_cognito_user_group.passenger.name
    driver    = aws_cognito_user_group.driver.name
  }
}
