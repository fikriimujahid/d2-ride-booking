locals {
  name_prefix = "${var.project}-${var.environment}"
  common_tags = {
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ============================================================================
# Application Load Balancer (ALB)
# ============================================================================
resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "prod"

  tags = local.common_tags
}

resource "aws_lb_target_group" "api" {
  name     = "${local.name_prefix}-api-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/health"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# Optional HTTPS Listener (if cert provided)
resource "aws_lb_listener" "https" {
  count             = var.acm_certificate_arn != null ? 1 : 0
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-2016-08"
  certificate_arn   = var.acm_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# ============================================================================
# Launch Template (API Server)
# ============================================================================
resource "aws_launch_template" "api" {
  name_prefix   = "${local.name_prefix}-api-lt"
  image_id      = var.ami_id
  instance_type = var.instance_type_api
  key_name      = var.key_name

  iam_instance_profile {
    name = var.iam_instance_profile_api
  }

  vpc_security_group_ids = [var.app_security_group_id]

  # Use try to handle base64 encoding if not already provided
  user_data = base64encode(var.user_data_api)

  tag_specifications {
    resource_type = "instance"
    tags = merge(local.common_tags, {
      Name = "${local.name_prefix}-api-node"
      Role = "api"
    })
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ============================================================================
# Auto Scaling Group (API Server)
# ============================================================================
resource "aws_autoscaling_group" "api" {
  name                = "${local.name_prefix}-api-asg"
  vpc_zone_identifier = var.private_subnet_ids
  target_group_arns   = [aws_lb_target_group.api.arn]
  health_check_type   = "ELB"
  desired_capacity    = var.asg_desired_capacity
  min_size            = var.asg_min_size
  max_size            = var.asg_max_size

  launch_template {
    id      = aws_launch_template.api.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${local.name_prefix}-api-asg-node"
    propagate_at_launch = true
  }

  dynamic "tag" {
    for_each = local.common_tags
    content {
      key                 = tag.key
      value               = tag.value
      propagate_at_launch = true
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ============================================================================
# WebSocket Server (Single EC2 Instance)
# ============================================================================
resource "aws_instance" "websocket" {
  ami           = var.ami_id
  instance_type = var.instance_type_websocket
  subnet_id     = var.private_subnet_ids[0]
  key_name      = var.key_name

  vpc_security_group_ids = [var.app_security_group_id]
  iam_instance_profile   = var.iam_instance_profile_websocket

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-websocket"
    Role = "websocket"
  })

  user_data = var.user_data_websocket
}

# ============================================================================
# Bastion Host (Optional)
# ============================================================================
resource "aws_instance" "bastion" {
  count         = var.enable_bastion ? 1 : 0
  ami           = var.ami_id
  instance_type = var.instance_type_bastion
  subnet_id     = var.public_subnet_ids[0]
  key_name      = var.key_name

  vpc_security_group_ids      = [var.bastion_security_group_id]
  iam_instance_profile        = var.iam_instance_profile_bastion
  associate_public_ip_address = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-bastion"
    Role = "bastion"
  })

  user_data = var.user_data_bastion
}
