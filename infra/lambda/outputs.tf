output "function_arns" {
  description = "Lambda function ARNs"
  value = {
    api_handler = aws_lambda_function.api_handler.arn
  }
}

output "function_names" {
  description = "Lambda function names"
  value = {
    api_handler = aws_lambda_function.api_handler.function_name
  }
}

output "log_group_name" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.nuxt_app.name
}