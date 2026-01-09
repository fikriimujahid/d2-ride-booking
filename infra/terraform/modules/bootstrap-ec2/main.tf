data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  name_prefix = "${var.project}-${var.environment}"
  common_tags = merge({
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }, var.tags)

  bucket_name = lower(replace("${local.name_prefix}-${data.aws_caller_identity.current.account_id}-bootstrap", "_", "-"))

  github_subs_effective = length(var.github_allowed_subs) > 0 ? var.github_allowed_subs : (
    var.github_repo != "" ? [
      "repo:${var.github_repo}:ref:refs/heads/dev",
      "repo:${var.github_repo}:ref:refs/heads/main",
      "repo:${var.github_repo}:pull_request/*"
    ] : []
  )

  create_github_deploy_role = var.github_oidc_provider_arn != "" && length(local.github_subs_effective) > 0

  app_cidrs_effective = length(var.allowed_app_cidrs) > 0 ? var.allowed_app_cidrs : (var.enable_ssh ? var.ssh_admin_cidrs : [])
}

# ============================================================================
# Networking (Public-only)
# ============================================================================
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-vpc"
  })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-igw"
  })
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = var.availability_zone
  map_public_ip_on_launch = true

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-subnet"
    Type = "public"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-public-rt"
  })
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ============================================================================
# Security Group (Locked down: only web ports; SSH optional)
# ============================================================================
resource "aws_security_group" "app" {
  name        = "${local.name_prefix}-bootstrap-sg"
  description = "Bootstrap SG for single EC2 (public web; SSH optional)"
  vpc_id      = aws_vpc.main.id

  dynamic "ingress" {
    for_each = length(local.app_cidrs_effective) > 0 ? [1] : []
    content {
      description = "App (Fastify)"
      from_port   = var.app_port
      to_port     = var.app_port
      protocol    = "tcp"
      cidr_blocks = local.app_cidrs_effective
    }
  }

  dynamic "ingress" {
    for_each = length(var.allowed_http_cidrs) > 0 ? [1] : []
    content {
      description = "HTTP"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = var.allowed_http_cidrs
    }
  }

  dynamic "ingress" {
    for_each = length(var.allowed_https_cidrs) > 0 ? [1] : []
    content {
      description = "HTTPS"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = var.allowed_https_cidrs
    }
  }

  dynamic "ingress" {
    for_each = var.enable_ssh ? [1] : []
    content {
      description = "SSH (admin)"
      from_port   = 22
      to_port     = 22
      protocol    = "tcp"
      cidr_blocks = var.ssh_admin_cidrs
    }
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-bootstrap-sg"
  })
}

# ============================================================================
# S3 bucket for artifacts/logs
# ============================================================================
resource "aws_s3_bucket" "bootstrap" {
  bucket = local.bucket_name

  tags = merge(local.common_tags, {
    Name = local.bucket_name
  })
}

resource "aws_s3_bucket_public_access_block" "bootstrap" {
  bucket = aws_s3_bucket.bootstrap.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "bootstrap" {
  bucket = aws_s3_bucket.bootstrap.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "bootstrap" {
  bucket = aws_s3_bucket.bootstrap.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_versioning" "bootstrap" {
  bucket = aws_s3_bucket.bootstrap.id

  versioning_configuration {
    status = var.enable_s3_versioning ? "Enabled" : "Suspended"
  }
}

# ============================================================================
# IAM role for EC2 (no static credentials)
# ============================================================================
resource "aws_iam_role" "ec2" {
  name = "${local.name_prefix}-bootstrap-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "bootstrap_access" {
  name = "${local.name_prefix}-bootstrap-access"
  role = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadBootstrapParameters"
        Effect = "Allow"
        Action = [
          "ssm:GetParameter",
          "ssm:GetParameters",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${var.ssm_parameter_prefix}/*"
      },
      {
        Sid    = "ArtifactsAndLogsBucketObjects"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:AbortMultipartUpload"
        ]
        Resource = [
          "${aws_s3_bucket.bootstrap.arn}/artifacts/*",
          "${aws_s3_bucket.bootstrap.arn}/logs/*"
        ]
      },
      {
        Sid      = "ArtifactsAndLogsBucketList"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = aws_s3_bucket.bootstrap.arn
        Condition = {
          StringLike = {
            "s3:prefix" = ["artifacts/*", "logs/*"]
          }
        }
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "${local.name_prefix}-bootstrap-ec2-profile"
  role = aws_iam_role.ec2.name

  tags = local.common_tags
}

# ============================================================================
# EC2 instance + Elastic IP
# ============================================================================
resource "aws_instance" "app" {
  ami                         = var.ami_id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public.id
  vpc_security_group_ids      = [aws_security_group.app.id]
  associate_public_ip_address = true
  iam_instance_profile        = aws_iam_instance_profile.ec2.name

  key_name = var.enable_ssh ? var.key_name : null

  user_data = <<-EOF
              #!/bin/bash
              set -euo pipefail

              dnf update -y
              dnf install -y docker git unzip awscli curl

              systemctl enable docker
              systemctl start docker

              # Install Docker Compose v2 (AL2023 may not have docker-compose-plugin in dnf)
              ARCH="$(uname -m)"
              case "$ARCH" in
                x86_64) COMPOSE_ARCH="x86_64" ;;
                aarch64) COMPOSE_ARCH="aarch64" ;;
                *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
              esac

              mkdir -p /usr/local/lib/docker/cli-plugins
              curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$${COMPOSE_ARCH}" \
                -o /usr/local/lib/docker/cli-plugins/docker-compose
              chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

              # Fail fast if compose isn't detected
              /usr/bin/docker compose version

              # Ensure SSM agent is running (AL2023 typically has it installed)
              systemctl enable amazon-ssm-agent || true
              systemctl start amazon-ssm-agent || true

              usermod -aG docker ec2-user

              mkdir -p /opt/app

              cat > /etc/systemd/system/d2-app.service <<'UNIT'
              [Unit]
              Description=D2 Bootstrap App (Docker Compose)
              After=docker.service network-online.target
              Wants=docker.service network-online.target
              ConditionPathExists=/opt/app/current/docker-compose.yml

              [Service]
              Type=simple
              WorkingDirectory=/opt/app/current
              ExecStart=/usr/bin/docker compose up
              ExecStop=/usr/bin/docker compose down
              Restart=always
              RestartSec=5

              [Install]
              WantedBy=multi-user.target
              UNIT

              systemctl daemon-reload
              systemctl enable d2-app.service

              cat > /usr/local/bin/push-d2-logs-to-s3 <<'SCRIPT'
              #!/bin/bash
              set -euo pipefail

              BUCKET="${aws_s3_bucket.bootstrap.bucket}"
              HOST="$(hostname -s)"
              TS="$(date -u +%Y%m%dT%H%M%SZ)"
              OUT="/tmp/d2-app-$${TS}.log"

              journalctl -u d2-app.service --no-pager > "$OUT" || true
              aws s3 cp "$OUT" "s3://${aws_s3_bucket.bootstrap.bucket}/logs/${local.name_prefix}/$${HOST}/d2-app-$${TS}.log" || true
              SCRIPT

              chmod +x /usr/local/bin/push-d2-logs-to-s3

              cat > /etc/systemd/system/d2-logpush.service <<'UNIT'
              [Unit]
              Description=Push D2 app logs to S3
              After=network-online.target
              Wants=network-online.target

              [Service]
              Type=oneshot
              ExecStart=/usr/local/bin/push-d2-logs-to-s3
              UNIT

              cat > /etc/systemd/system/d2-logpush.timer <<'UNIT'
              [Unit]
              Description=Schedule D2 log push

              [Timer]
              OnBootSec=2m
              OnUnitActiveSec=15m
              Persistent=true

              [Install]
              WantedBy=timers.target
              UNIT

              systemctl daemon-reload
              systemctl enable --now d2-logpush.timer

              cat > /usr/local/bin/ssm-deploy <<'SCRIPT'
              #!/bin/bash
              set -euo pipefail

              if [[ $# -lt 2 ]]; then
                echo "Usage: ssm-deploy <s3_bucket> <s3_key>" >&2
                exit 2
              fi

              BUCKET="$1"
              KEY="$2"

              TMP_DIR="/tmp/app-deploy"
              mkdir -p "$TMP_DIR"
              aws s3 cp "s3://$BUCKET/$KEY" "$TMP_DIR/artifact.tgz"

              rm -rf /opt/app/current
              mkdir -p /opt/app/current
              tar -xzf "$TMP_DIR/artifact.tgz" -C /opt/app/current

              if [[ -x /opt/app/current/deploy/ssm_deploy.sh ]]; then
                /opt/app/current/deploy/ssm_deploy.sh
              elif [[ -f /opt/app/current/docker-compose.yml ]]; then
                cd /opt/app/current
                systemctl restart d2-app.service
              else
                echo "Artifact unpacked to /opt/app/current. No deploy hook found." >&2
                echo "Add /deploy/ssm_deploy.sh (executable) or a docker-compose.yml to automate startup." >&2
              fi
              SCRIPT

              chmod +x /usr/local/bin/ssm-deploy

              echo "bootstrap-ready" > /home/ec2-user/bootstrap.txt
              EOF

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-bootstrap"
    Role = "bootstrap"
  })
}

resource "aws_eip" "app" {
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "${local.name_prefix}-bootstrap-eip"
  })
}

resource "aws_eip_association" "app" {
  instance_id   = aws_instance.app.id
  allocation_id = aws_eip.app.id
}

# ============================================================================
# Optional: GitHub Actions deploy role (OIDC)
# ============================================================================
resource "aws_iam_role" "github_actions_deploy" {
  count = local.create_github_deploy_role ? 1 : 0

  name = "${local.name_prefix}-github-actions-deploy"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = var.github_oidc_provider_arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = local.github_subs_effective
        }
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  count = local.create_github_deploy_role ? 1 : 0

  name = "${local.name_prefix}-github-actions-deploy"
  role = aws_iam_role.github_actions_deploy[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Sid    = "S3Artifacts"
          Effect = "Allow"
          Action = [
            "s3:PutObject",
            "s3:GetObject",
            "s3:AbortMultipartUpload"
          ]
          Resource = "${aws_s3_bucket.bootstrap.arn}/artifacts/*"
        },
        {
          Sid      = "S3List"
          Effect   = "Allow"
          Action   = ["s3:ListBucket"]
          Resource = aws_s3_bucket.bootstrap.arn
          Condition = {
            StringLike = {
              "s3:prefix" = ["artifacts/*"]
            }
          }
        }
      ],
      length(var.extra_deploy_s3_bucket_arns) > 0 ? [
        {
          Sid      = "S3StaticSites"
          Effect   = "Allow"
          Action   = ["s3:ListBucket"]
          Resource = var.extra_deploy_s3_bucket_arns
        },
        {
          Sid    = "S3StaticSitesObjects"
          Effect = "Allow"
          Action = [
            "s3:PutObject",
            "s3:DeleteObject",
            "s3:GetObject",
            "s3:AbortMultipartUpload"
          ]
          Resource = [for arn in var.extra_deploy_s3_bucket_arns : "${arn}/*"]
        }
      ] : [],
      [
        {
          Sid    = "SSMDeploy"
          Effect = "Allow"
          Action = [
            "ssm:SendCommand",
            "ssm:GetCommandInvocation"
          ]
          Resource = [
            "arn:aws:ec2:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:instance/${aws_instance.app.id}",
            "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:document/AWS-RunShellScript"
          ]
        }
      ]
    )
  })
}
