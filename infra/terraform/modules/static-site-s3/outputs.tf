output "bucket_name" {
  description = "S3 bucket name"
  value       = aws_s3_bucket.site.bucket
}

output "website_endpoint" {
  description = "S3 website endpoint (host only)"
  value       = aws_s3_bucket_website_configuration.site.website_endpoint
}

output "website_url" {
  description = "S3 website URL"
  value       = "http://${aws_s3_bucket_website_configuration.site.website_endpoint}"
}
