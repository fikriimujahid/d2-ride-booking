variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment name (e.g., dev)"
  type        = string
}

variable "site_name" {
  description = "Short site name (e.g., admin, driver, passenger)"
  type        = string
}

variable "tags" {
  description = "Additional tags"
  type        = map(string)
  default     = {}
}

variable "index_document" {
  description = "Index document for S3 website"
  type        = string
  default     = "index.html"
}

variable "error_document" {
  description = "Error document for S3 website"
  type        = string
  default     = "index.html"
}
