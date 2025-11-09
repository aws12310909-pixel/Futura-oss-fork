variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
}

variable "uploads_bucket_name" {
  description = "S3 bucket name for uploads (optional, defaults to project-environment-uploads)"
  type        = string
  default     = ""
}