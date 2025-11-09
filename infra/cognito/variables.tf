variable "environment" {
  description = "環境名"
  type        = string
}

variable "project_name" {
  description = "プロジェクト名"
  type        = string
}

variable "cognito_domain" {
  description = "Cognito User Pool Domain (optional, defaults to project-environment-auth). Must be unique within the AWS region."
  type        = string
  default     = ""
}