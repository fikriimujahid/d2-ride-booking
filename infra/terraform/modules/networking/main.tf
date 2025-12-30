# ==============================================================================
# VPC AND NETWORKING CONFIGURATION
# ==============================================================================

# ------------------------------------------------------------------------------
# VPC
# ------------------------------------------------------------------------------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name        = "${var.project}-${var.environment}-vpc"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ------------------------------------------------------------------------------
# Internet Gateway
# ------------------------------------------------------------------------------
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "${var.project}-${var.environment}-igw"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ------------------------------------------------------------------------------
# Subnets
# ------------------------------------------------------------------------------
resource "aws_subnet" "public" {
  count             = length(var.public_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.public_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${var.project}-${var.environment}-public-subnet-${count.index + 1}"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Type        = "public"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name        = "${var.project}-${var.environment}-private-subnet-${count.index + 1}"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Type        = "private"
  }
}

# ------------------------------------------------------------------------------
# NAT Configuration (Conditional)
# ------------------------------------------------------------------------------
# PROD: Use NAT Gateway for high availability
# NON-PROD: Use NAT Instance for cost optimization

# --- STRATEGY 1: NAT GATEWAY (PROD) ---
resource "aws_eip" "nat" {
  count  = var.environment == "prod" ? 1 : 0
  domain = "vpc"

  tags = {
    Name        = "${var.project}-${var.environment}-nat-eip"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_nat_gateway" "main" {
  count         = var.environment == "prod" ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  tags = {
    Name        = "${var.project}-${var.environment}-nat-gw"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }

  depends_on = [aws_internet_gateway.main]
}

# --- STRATEGY 2: NAT INSTANCE (NON-PROD) ---
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_security_group" "nat" {
  count       = var.environment != "prod" ? 1 : 0
  name        = "${var.project}-${var.environment}-nat-sg"
  description = "Security group for NAT Instance"
  vpc_id      = aws_vpc.main.id

  # Inbound: Allow all traffic from private subnets
  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = var.private_subnet_cidrs
  }

  # Outbound: Allow all traffic to internet
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-${var.environment}-nat-sg"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_instance" "nat" {
  count                       = var.environment != "prod" ? 1 : 0
  ami                         = data.aws_ami.amazon_linux_2023.id
  instance_type               = var.nat_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.nat[0].id] # Note the index [0]
  associate_public_ip_address = true

  # CRITICAL: Disable Source/Destination Check for NAT/Routing
  source_dest_check = false

  user_data = <<-EOF
              #!/bin/bash
              echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
              sysctl -p
              yum install -y iptables-services
              iptables -t nat -A POSTROUTING -o ens5 -j MASQUERADE
              service iptables save
              systemctl enable iptables
              systemctl start iptables
              EOF

  tags = {
    Name        = "${var.project}-${var.environment}-nat-instance"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
    Role        = "nat"
  }
}

# ------------------------------------------------------------------------------
# Route Tables
# ------------------------------------------------------------------------------

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name        = "${var.project}-${var.environment}-public-rt"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private Route Table
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block           = "0.0.0.0/0"
    nat_gateway_id       = var.environment == "prod" ? aws_nat_gateway.main[0].id : null
    network_interface_id = var.environment != "prod" ? aws_instance.nat[0].primary_network_interface_id : null
  }

  tags = {
    Name        = "${var.project}-${var.environment}-private-rt"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ------------------------------------------------------------------------------
# Security Groups (Application Layers)
# ------------------------------------------------------------------------------

# 1. ALB Security Group
resource "aws_security_group" "alb" {
  name        = "${var.project}-${var.environment}-alb-sg"
  description = "Security group for Application Load Balancer"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-${var.environment}-alb-sg"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# 2. Bastion Security Group
resource "aws_security_group" "bastion" {
  name        = "${var.project}-${var.environment}-bastion-sg"
  description = "Security group for Bastion Host"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH from Allowed IPs"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.allowed_ssh_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-${var.environment}-bastion-sg"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# 3. EC2 Application Security Group
resource "aws_security_group" "app" {
  name        = "${var.project}-${var.environment}-app-sg"
  description = "Security group for Application Instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "HTTP from ALB"
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "WebSocket/Custom from ALB or internal"
    from_port       = 3000 # Assuming Node.js/App port
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "SSH from Bastion"
    from_port       = 22
    to_port         = 22
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.project}-app-sg"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# 4. RDS Security Group
resource "aws_security_group" "rds" {
  name        = "${var.project}-rds-sg"
  description = "Security group for RDS Database"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from App"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  ingress {
    description     = "PostgreSQL from Bastion"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.bastion.id]
  }

  tags = {
    Name        = "${var.project}-rds-sg"
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
