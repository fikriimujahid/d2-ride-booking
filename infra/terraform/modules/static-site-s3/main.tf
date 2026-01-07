data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  name_prefix = "${var.project}-${var.environment}-${var.site_name}"

  common_tags = merge({
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
    component   = "static-site"
    site        = var.site_name
  }, var.tags)

  bucket_name = lower(replace("${local.name_prefix}-${data.aws_caller_identity.current.account_id}", "_", "-"))
}

resource "aws_s3_bucket" "site" {
  bucket = local.bucket_name

  tags = merge(local.common_tags, {
    Name = local.bucket_name
  })
}

resource "aws_s3_bucket_ownership_controls" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

# For a public static website, we must allow a public bucket policy.
resource "aws_s3_bucket_public_access_block" "site" {
  bucket = aws_s3_bucket.site.id

  block_public_acls       = false
  ignore_public_acls      = false
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_server_side_encryption_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_website_configuration" "site" {
  bucket = aws_s3_bucket.site.id

  index_document {
    suffix = var.index_document
  }

  error_document {
    key = var.error_document
  }
}

resource "aws_s3_bucket_policy" "public_read" {
  bucket = aws_s3_bucket.site.id

  depends_on = [
    aws_s3_bucket_public_access_block.site,
    aws_s3_bucket_ownership_controls.site
  ]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = ["s3:GetObject"]
        Resource  = "${aws_s3_bucket.site.arn}/*"
      }
    ]
  })
}
