# ============================================================================
# Authentication Module - Input Variables
# ============================================================================

# ============================================================================
# REQUIRED VARIABLES: No defaults - you MUST provide these
# ============================================================================
variable "project" {
  description = "Project name (e.g., 'myapp', 'acme')"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., 'development', 'staging', 'production')"
  type        = string
}

# ============================================================================
# OPTIONAL VARIABLES: Have defaults - you can override them
# ============================================================================

variable "tags" {
  description = "Resource tags for billing and organization"
  type        = map(string)
  default     = {}
}

variable "cognito_tier" {
  description = "Cognito User Pool tier: 'LITE' (cheaper) or 'PLUS' (advanced security features)"
  type        = string
  default     = "LITE"
}

variable "password_min_length" {
  description = "Minimum password length (AWS minimum: 6, recommended: 12+)"
  type        = number
  default     = 12
}

variable "enable_mfa" {
  description = "Enable Multi-Factor Authentication (requires authentication app like Google Authenticator)"
  type        = bool
  default     = false
}

variable "enable_advanced_security" {
  description = "Enable Advanced Security Features (fraud detection, suspicious login blocking) - requires PLUS tier"
  type        = bool
  default     = false
}
