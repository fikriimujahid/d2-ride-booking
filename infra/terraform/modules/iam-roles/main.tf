# ==============================================================================
# DATA SOURCE: AWS Account Information
# ------------------------------------------------------------------------------
data "aws_caller_identity" "current" {}

# ==============================================================================
# LOCALS: GitHub OIDC Subjects (who may assume roles)
# ------------------------------------------------------------------------------
locals {
  allowed_subs = [
    "repo:${var.github_repo}:ref:refs/heads/dev", # Dev branch pushes
    "repo:${var.github_repo}:environment:dev",    # Dev environment deploys

    #"repo:${var.github_repo}:ref:refs/heads/staging",  # Staging branch pushes
    #"repo:${var.github_repo}:environment:staging",     # Staging environment deploys

    "repo:${var.github_repo}:ref:refs/heads/main", # Main branch pushes
    "repo:${var.github_repo}:environment:main",    # Main environment deploys (alternative naming)

    "repo:${var.github_repo}:ref:refs/heads/prod", # Main branch pushes
    "repo:${var.github_repo}:environment:prod",    # Prod environment deploys (alternative naming)

    "repo:${var.github_repo}:pull_request/*", # All pull requests (requires wildcard)
  ]
}

# ==============================================================================
# LOCALS: ARN helpers, reusable action groups, and shared tags
# ==============================================================================

# ==============================================================================
# IAM ROLE: ridebooking-admin
# ==============================================================================
# resource "aws_iam_role" "ridebooking_admin" {
#   name = "ridebooking-admin"

#   assume_role_policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Effect    = "Allow"
#       Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
#       Action    = "sts:AssumeRole"
#       # Condition = {
#       #   Bool      = { "aws:MultiFactorAuthPresent" = "true" }
#       #   IpAddress = { "aws:SourceIp" = ["1.2.3.4/32", "5.6.7.8/32"] }
#       # }
#     }]
#   })

#   max_session_duration = 43200 # 12 hours

#   tags = {
#     project     = var.project
#     environment = "shared"
#     managed_by  = "terraform"
#   }
# }

# ==============================================================================
# IAM POLICY: ridebooking-admin-policy
# ==============================================================================
# resource "aws_iam_role_policy_attachment" "ridebooking_admin_attach" {
#   role       = aws_iam_role.ridebooking_admin.name
#   policy_arn = "arn:aws:iam::aws:policy/AdministratorAccess"
# }

# ==============================================================================
# IAM POLICY: Permission Boundary (prevents privilege escalation)
# ==============================================================================
resource "aws_iam_policy" "permission_boundary" {
  name = "${var.project}-permission-boundary"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Deny"
      Action = [
        "iam:CreateUser",
        "iam:CreateRole",
        "iam:AttachUserPolicy",
        "iam:AttachRolePolicy",
        "organizations:*",
        "account:*"
      ]
      Resource = "*"
    }]
  })
}

# ==============================================================================
# IAM ROLE: ridebooking-developer
# ==============================================================================
# resource "aws_iam_role" "ridebooking_developer" {
#   name = "ridebooking-developer"

#   assume_role_policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [{
#       Effect    = "Allow"
#       Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
#       Action    = "sts:AssumeRole"
#       Condition = {
#         Bool = { "aws:MultiFactorAuthPresent" = "true" }
#       }
#     }]
#   })

#   max_session_duration = 28800 # 8 hours

#   tags = {
#     project     = var.project
#     environment = "shared"
#     managed_by  = "terraform"
#   }
# }

# ==============================================================================
# POLICY DOC (data): ridebooking-developer-policy
# ==============================================================================
# resource "aws_iam_policy" "ridebooking_developer_policy" {
#   name        = "ridebooking-developer-policy"
#   description = "Policy for ridebooking-developer role"

#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Sid    = "ReadOnlyProduction"
#         Effect = "Allow"
#         Action = [
#           "ec2:Describe*",
#           "rds:Describe*",
#           "cloudwatch:Get*",
#           "cloudwatch:List*",
#           "logs:Get*",
#           "logs:Describe*",
#           "logs:FilterLogEvents",
#           "s3:ListBucket",
#           "s3:GetObject"
#         ]
#         Resource = "*"
#         Condition = {
#           StringEquals = {
#             "aws:ResourceTag/Environment" = "prod"
#           }
#         }
#       },
#       {
#         Sid    = "FullAccessDevelopment"
#         Effect = "Allow"
#         Action = [
#           "ec2:*",
#           "rds:*",
#           "dynamodb:*",
#           "elasticache:*",
#           "s3:*",
#           "cloudwatch:*",
#           "logs:*",
#           "secretsmanager:GetSecretValue"
#         ]
#         Resource = "*"
#         Condition = {
#           StringEquals = {
#             "aws:ResourceTag/Environment" = "dev"
#           }
#         }
#       },
#       {
#         Sid    = "DenyIAMChanges"
#         Effect = "Deny"
#         Action = [
#           "iam:Create*",
#           "iam:Delete*",
#           "iam:Put*",
#           "iam:Update*",
#           "iam:Attach*",
#           "iam:Detach*"
#         ]
#         Resource = "*"
#       }
#     ]
#   })

#   tags = {
#     project     = var.project
#     environment = "shared"
#     managed_by  = "terraform"
#   }
# }

# ==============================================================================
# SERVICE ROLE: ridebooking-ec2-api-role
# ==============================================================================
resource "aws_iam_role" "ridebooking_ec2_api_role" {
  name = "ridebooking-ec2-api-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  permissions_boundary = aws_iam_policy.permission_boundary.arn

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

resource "aws_iam_instance_profile" "ridebooking_ec2_api_profile" {
  name = "ridebooking-ec2-api-profile"
  role = aws_iam_role.ridebooking_ec2_api_role.name

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# SERVICE POLICY: ridebooking-ec2-api-policy
# ==============================================================================
resource "aws_iam_policy" "ridebooking_ec2_api_policy" {
  name        = "ridebooking-ec2-api-policy"
  description = "Policy for ridebooking-ec2-api-role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManagerAccess"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          "arn:aws:secretsmanager:*:*:secret:${var.project}/*/database/*",
          "arn:aws:secretsmanager:*:*:secret:${var.project}/*/api/*"
        ]
      },
      {
        Sid    = "CloudWatchLogsWrite"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
          "logs:DescribeLogStreams"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/ec2/${var.project}-*"
      },
      {
        Sid    = "DynamoDBAccess"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:DeleteItem"
        ]
        Resource = [
          "arn:aws:dynamodb:*:*:table/${var.project}-*-locations",
          "arn:aws:dynamodb:*:*:table/${var.project}-*-events"
        ]
      },
      {
        Sid    = "S3ConfigAccess"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project}-config-*",
          "arn:aws:s3:::${var.project}-config-*/*"
        ]
      },
      {
        Sid    = "S3LogsWrite"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:PutObjectAcl"
        ]
        Resource = "arn:aws:s3:::${var.project}-logs-*/*"
      }
    ]
  })

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# SERVICE ROLE: ridebooking-ec2-websocket-role
# ==============================================================================
resource "aws_iam_role" "ridebooking_ec2_websocket_role" {
  name = "ridebooking-ec2-websocket-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  permissions_boundary = aws_iam_policy.permission_boundary.arn

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

resource "aws_iam_instance_profile" "ridebooking_ec2_websocket_profile" {
  name = "ridebooking-ec2-websocket-profile"
  role = aws_iam_role.ridebooking_ec2_websocket_role.name

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# SERVICE POLICY: ridebooking-ec2-websocket-policy
# ==============================================================================
resource "aws_iam_policy" "ridebooking_ec2_websocket_policy" {
  name        = "ridebooking-ec2-websocket-policy"
  description = "Policy for ridebooking-ec2-websocket-role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "SecretsManagerRedis"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:*:*:secret:${var.project}/*/cache/*"
      },
      {
        Sid    = "CloudWatchLogsWrite"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/ec2/${var.project}-websocket-*"
      },
      {
        Sid    = "DynamoDBLocationWrite"
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:GetItem",
          "dynamodb:Query"
        ]
        Resource = "arn:aws:dynamodb:*:*:table/${var.project}-*-locations"
      },
      {
        Sid    = "SESEmailNotifications"
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "ses:FromAddress" = "notifications@${var.project}.com"
          }
        }
      },
      {
        Sid    = "SNSPushNotifications"
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = "arn:aws:sns:*:*:${var.project}-*-mobile-push"
      }
    ]
  })

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# SERVICE ROLE: ridebooking-bastion-role
# ==============================================================================
resource "aws_iam_role" "ridebooking_bastion_role" {
  name = "ridebooking-bastion-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  permissions_boundary = aws_iam_policy.permission_boundary.arn

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

resource "aws_iam_instance_profile" "ridebooking_bastion_profile" {
  name = "ridebooking-bastion-profile"
  role = aws_iam_role.ridebooking_bastion_role.name

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# SERVICE POLICY: ridebooking-bastion-policy
# ==============================================================================
resource "aws_iam_policy" "ridebooking_bastion_policy" {
  name        = "ridebooking-bastion-policy"
  description = "Policy for ridebooking-bastion-role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogsWrite"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/ec2/${var.project}-bastion-*"
      },
      {
        Sid    = "SSMSessionManager"
        Effect = "Allow"
        Action = [
          "ssm:UpdateInstanceInformation",
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3SessionLogs"
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "arn:aws:s3:::${var.project}-logs-*/bastion-sessions/*"
      }
    ]
  })

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# SERVICE ROLE: ridebooking-rds-monitoring-role
# ==============================================================================
resource "aws_iam_role" "ridebooking_rds_monitoring_role" {
  name = "ridebooking-rds-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  permissions_boundary = aws_iam_policy.permission_boundary.arn

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# CI/CD ROLE: github-actions-deploy-role
# ==============================================================================
resource "aws_iam_role" "github_actions_deploy_role" {
  name = "github-actions-deploy-role"

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
          "token.actions.githubusercontent.com:sub" = local.allowed_subs
        }
      }
    }]
  })

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# CI/CD POLICY: github-actions-deploy-policy
# ==============================================================================
resource "aws_iam_policy" "github_actions_deploy_policy" {
  name        = "github-actions-deploy-policy"
  description = "Policy for github-actions-deploy-role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "EC2DeploymentAccess"
        Effect = "Allow"
        Action = [
          "ec2:DescribeInstances",
          "ec2:DescribeTags",
          "ec2:CreateTags"
        ]
        Resource = "*"
      },
      {
        Sid    = "S3ArtifactsUpload"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${var.project}-deployments-*",
          "arn:aws:s3:::${var.project}-deployments-*/*"
        ]
      },
      {
        Sid    = "S3BootstrapArtifactsObjects"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:AbortMultipartUpload"
        ]
        Resource = "arn:aws:s3:::${var.project}-*-bootstrap/artifacts/*"
      },
      {
        Sid    = "S3BootstrapArtifactsList"
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${var.project}-*-bootstrap"
        Condition = {
          StringLike = {
            "s3:prefix" = [
              "artifacts/*",
              "artifacts"
            ]
          }
        }
      },
      {
        Sid    = "S3StaticSiteAdminBuckets"
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          "arn:aws:s3:::${var.project}-*-admin-*"
        ]
      },
      {
        Sid    = "S3StaticSiteAdminObjects"
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:AbortMultipartUpload"
        ]
        Resource = [
          "arn:aws:s3:::${var.project}-*-admin-*/*"
        ]
      },
      {
        Sid    = "CloudWatchReadOnly"
        Effect = "Allow"
        Action = [
          "cloudwatch:GetMetricData",
          "logs:FilterLogEvents",
          "logs:GetLogEvents"
        ]
        Resource = "*"
      },
      {
        Sid    = "SSMSendCommandToTaggedInstances"
        Effect = "Allow"
        Action = [
          "ssm:SendCommand"
        ]
        Resource = "arn:aws:ec2:*:*:instance/*"
        Condition = {
          StringEquals = {
            "aws:ResourceTag/project" = var.project
          }
        }
      },
      {
        Sid    = "SSMSendCommandDocument"
        Effect = "Allow"
        Action = [
          "ssm:SendCommand"
        ]
        Resource = [
          "arn:aws:ssm:*::document/AWS-RunShellScript",
          "arn:aws:ssm:*:*:document/AWS-RunShellScript"
        ]
      },
      {
        Sid    = "SSMGetCommandInvocation"
        Effect = "Allow"
        Action = [
          "ssm:GetCommandInvocation",
          "ssm:ListCommandInvocations",
          "ssm:ListCommands"
        ]
        Resource = "*"
      }
    ]
  })

  tags = {
    project     = var.project
    environment = "shared"
    managed_by  = "terraform"
  }
}

# ==============================================================================
# POLICY ATTACHMENTS: Connect Policies to Roles
# ==============================================================================
# resource "aws_iam_role_policy_attachment" "ridebooking_developer_attach" {
#   role       = aws_iam_role.ridebooking_developer.name
#   policy_arn = aws_iam_policy.ridebooking_developer_policy.arn
# }

resource "aws_iam_role_policy_attachment" "ridebooking_ec2_api_attach" {
  role       = aws_iam_role.ridebooking_ec2_api_role.name
  policy_arn = aws_iam_policy.ridebooking_ec2_api_policy.arn
}

resource "aws_iam_role_policy_attachment" "ridebooking_ec2_websocket_attach" {
  role       = aws_iam_role.ridebooking_ec2_websocket_role.name
  policy_arn = aws_iam_policy.ridebooking_ec2_websocket_policy.arn
}

resource "aws_iam_role_policy_attachment" "ridebooking_bastion_attach" {
  role       = aws_iam_role.ridebooking_bastion_role.name
  policy_arn = aws_iam_policy.ridebooking_bastion_policy.arn
}

resource "aws_iam_role_policy_attachment" "ridebooking_rds_monitoring_attach" {
  role       = aws_iam_role.ridebooking_rds_monitoring_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

resource "aws_iam_role_policy_attachment" "github_actions_deploy_attach" {
  role       = aws_iam_role.github_actions_deploy_role.name
  policy_arn = aws_iam_policy.github_actions_deploy_policy.arn
}
