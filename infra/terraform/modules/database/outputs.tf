output "rds_endpoint" {
  description = "The connection endpoint for the RDS instance"
  value       = aws_db_instance.main.address
}

output "rds_port" {
  description = "The port for the RDS instance"
  value       = aws_db_instance.main.port
}

output "rds_db_name" {
  description = "The database name"
  value       = aws_db_instance.main.db_name
}

output "rds_secret_arn" {
  description = "ARN of the Secrets Manager secret containing DB credentials"
  value       = aws_secretsmanager_secret.db_secret.arn
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.locations.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.locations.arn
}

output "redis_primary_endpoint_address" {
  description = "Address of the endpoint for the primary node in the replication group"
  value       = var.enable_redis ? aws_elasticache_replication_group.redis[0].primary_endpoint_address : null
}

output "redis_port" {
  description = "The port of the Redis cluster"
  value       = var.enable_redis ? aws_elasticache_replication_group.redis[0].port : null
}

output "rds_security_group_id" {
  description = "ID of the RDS Security Group"
  value       = aws_security_group.rds_sg.id
}

output "redis_security_group_id" {
  description = "ID of the Redis Security Group"
  value       = var.enable_redis ? aws_security_group.redis_sg[0].id : null
}
