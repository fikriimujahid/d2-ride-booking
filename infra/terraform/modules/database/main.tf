locals {
  name_prefix = "${var.project}-${var.environment}"

  # Common tags to be assigned to all resources
  common_tags = {
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ==============================================================================
# SECRETS (RDS Password)
# ==============================================================================
resource "random_password" "db_password" {
  length  = 16
  special = false # Avoid special chars that might break connection strings
}

resource "aws_secretsmanager_secret" "db_secret" {
  name        = "${local.name_prefix}-db-credentials"
  description = "Database credentials for ${local.name_prefix}"
  tags        = local.common_tags
}

resource "aws_secretsmanager_secret_version" "db_secret_val" {
  secret_id = aws_secretsmanager_secret.db_secret.id
  secret_string = jsonencode({
    username = "admin"
    password = random_password.db_password.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = aws_db_instance.main.db_name
  })
}

# ==============================================================================
# SECURITY GROUPS
# ==============================================================================
resource "aws_security_group" "rds_sg" {
  name        = "${local.name_prefix}-rds-sg"
  description = "Allow MySQL access from allowed SGs"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-rds-sg" })
}

resource "aws_security_group" "redis_sg" {
  count       = var.enable_redis ? 1 : 0
  name        = "${local.name_prefix}-redis-sg"
  description = "Allow Redis access from allowed SGs"
  vpc_id      = var.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_groups
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-redis-sg" })
}

# ==============================================================================
# RDS MYSQL
# ==============================================================================
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = merge(local.common_tags, { Name = "${local.name_prefix}-db-subnet-group" })
}

resource "aws_db_instance" "main" {
  identifier        = "${local.name_prefix}-mysql"
  engine            = "mysql"
  engine_version    = "8.4.7"
  instance_class    = var.rds_instance_class
  allocated_storage = var.rds_allocated_storage
  storage_type      = "gp3"

  username = "admin"
  password = random_password.db_password.result
  db_name  = replace("${var.project}_${var.environment}", "-", "_") # e.g. d2_dev

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds_sg.id]

  multi_az            = var.multi_az
  publicly_accessible = false
  skip_final_snapshot = var.environment != "prod"

  # For production, we should set these
  backup_retention_period = var.environment == "prod" ? 7 : 0
  deletion_protection     = var.environment == "prod"

  tags = local.common_tags
}

# ==============================================================================
# DYNAMODB (Locations)
# ==============================================================================
resource "aws_dynamodb_table" "locations" {
  name         = "${local.name_prefix}-locations"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id" # Generic ID for now

  attribute {
    name = "id"
    type = "S"
  }

  tags = local.common_tags
}

# ==============================================================================
# ELASTICACHE REDIS
# ==============================================================================
resource "aws_elasticache_subnet_group" "redis" {
  count      = var.enable_redis ? 1 : 0
  name       = "${local.name_prefix}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
  tags       = local.common_tags
}

resource "aws_elasticache_replication_group" "redis" {
  count = var.enable_redis ? 1 : 0

  replication_group_id = "${local.name_prefix}-redis"
  description          = "Redis replication group for ${local.name_prefix}"
  node_type            = var.redis_node_type
  num_cache_clusters   = var.redis_num_cache_nodes
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.redis[0].name
  security_group_ids = [aws_security_group.redis_sg[0].id]

  automatic_failover_enabled = var.multi_az && var.redis_num_cache_nodes > 1

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true # Requires managing auth token if set, or just use SG.
  # For simple setups usually transit/auth enabled is best practice but requires client support.
  # We will stick to basic secure defaults.

  tags = local.common_tags
}
