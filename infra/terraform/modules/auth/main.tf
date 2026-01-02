locals {
  name_prefix = "${var.project}-${var.environment}"
  common_tags = {
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ============================================================================
# RESOURCE: Cognito User Pool
# ----------------------------------------------------------------------------
resource "aws_cognito_user_pool" "main" {
  # Naming convention keeps resources unique per project/environment.
  name = "${local.name_prefix}-user-pool"

  # Choose between LITE and PLUS tiers at apply time.
  user_pool_tier = var.cognito_tier

  # Let users sign in with their email address (friendlier than usernames).
  username_attributes = ["email"]

  # No attributes are auto-verified here; verification is handled in the app flow.
  auto_verified_attributes = ["email"]

  # TERRAFORM CONCEPT: Nested block keeps related settings grouped.
  username_configuration {
    # Case-insensitive login avoids duplicate accounts (User@example == user@example).
    case_sensitive = false
  }

  # Password rules follow NIST guidance: emphasize length and balanced complexity.
  password_policy {
    minimum_length                   = var.password_min_length
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    require_uppercase                = true
    temporary_password_validity_days = 7
  }

  # MFA is optional to keep onboarding simple; flip var.enable_mfa to enforce it.
  mfa_configuration = var.enable_mfa ? "OPTIONAL" : "OFF"

  # TERRAFORM CONCEPT: dynamic blocks let us add configuration only when enabled.
  dynamic "software_token_mfa_configuration" {
    for_each = var.enable_mfa ? [1] : []
    content {
      enabled = true
    }
  }

  # Account recovery prioritizes verified email.
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # Attribute schema explicitly documents what we store and whether users can change it.
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 5
      max_length = 2048
    }
  }

  schema {
    name                = "role"
    attribute_data_type = "String"
    required            = false
    mutable             = false

    string_attribute_constraints {
      min_length = 1
      max_length = 256
    }
  }

  schema {
    name                = "email_notification"
    attribute_data_type = "Boolean"
    required            = false
    mutable             = true
  }


  # Conditional advanced security (only available in PLUS tier).
  dynamic "user_pool_add_ons" {
    for_each = var.enable_advanced_security ? [1] : []
    content {
      # ENFORCED blocks risky sign-ins automatically.
      advanced_security_mode = "ENFORCED"
    }
  }

  # Track remembered devices and challenge new ones.
  device_configuration {
    challenge_required_on_new_device      = true
    device_only_remembered_on_user_prompt = true
  }

  # Email delivery uses Cognito's default sender to reduce setup; switch to SES for branded emails.
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
    # To brand emails later: set email_sending_account = "DEVELOPER" and provide an SES source_arn.
  }

  # Prevent accidental deletion of the user pool during destroy.
  deletion_protection = var.environment == "prod" ? "ACTIVE" : "INACTIVE"

  # Tags help with cost allocation and inventory.
  # Merge standard tags with caller-provided tags (caller wins on conflicts).
  tags = merge(local.common_tags, var.tags)
}


# ============================================================================
# RESOURCE: Cognito User Pool Groups (Roles)
# ----------------------------------------------------------------------------
resource "aws_cognito_user_group" "admin" {
  user_pool_id = aws_cognito_user_pool.main.id
  name         = "Admin"
  description  = "Administrative users"

  # Lower number = higher precedence
  precedence = 1
}

resource "aws_cognito_user_group" "passenger" {
  user_pool_id = aws_cognito_user_pool.main.id
  name         = "Passenger"
  description  = "Passenger users"

  precedence = 2
}

resource "aws_cognito_user_group" "driver" {
  user_pool_id = aws_cognito_user_pool.main.id
  name         = "Driver"
  description  = "Driver users"

  precedence = 3
}


# ============================================================================
# RESOURCE: Cognito User Pool Client (Web Application)
# ----------------------------------------------------------------------------
resource "aws_cognito_user_pool_client" "web" {
  name = "${var.project}-${var.environment}-web-client"

  # TERRAFORM CONCEPT: attribute references create an implicit dependency on the user pool.
  user_pool_id = aws_cognito_user_pool.main.id

  # Backend clients SHOULD have secrets; authentication happens server-side.
  generate_secret = true // pragma: allowlist secret

  # Backend auth flows (server-side only)
  explicit_auth_flows = [
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_PASSWORD_AUTH"
  ]

  # Control which attributes the app can read/write (includes custom flag for notifications).
  read_attributes  = ["email", "name", "phone_number", "custom:role", "custom:email_notification"]
  write_attributes = ["email", "name", "phone_number", "custom:role", "custom:email_notification"]

  # Token lifetimes balance security (short access tokens) and UX (longer refresh tokens).
  access_token_validity  = 60
  id_token_validity      = 60
  refresh_token_validity = 30

  token_validity_units {
    access_token  = "minutes" // pragma: allowlist secret 
    id_token      = "minutes"
    refresh_token = "days" // pragma: allowlist secret 
  }

  # Hide user existence differences to block enumeration attacks.
  prevent_user_existence_errors = "ENABLED"

  # Allow immediate logout/token invalidation instead of waiting for expiry.
  enable_token_revocation = true // pragma: allowlist secret 

  # No hosted UI; authentication happens via API calls from the SPA.
}
