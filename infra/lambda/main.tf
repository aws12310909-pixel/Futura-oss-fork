# Lambda function placeholder for Nuxt3 SSR
# Note: The actual deployment will be handled by Amplify
# This creates the necessary resources for Lambda integration

# CloudWatch Log Group for Lambda functions
resource "aws_cloudwatch_log_group" "nuxt_app" {
  name              = "/aws/lambda/${var.project_name}-${var.environment}-nuxt-app"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-${var.environment}-nuxt-app-logs"
  }
}

# Lambda function for API handlers (placeholder)
# The actual code will be deployed via Amplify
resource "aws_lambda_function" "api_handler" {
  filename         = "placeholder.zip"
  function_name    = "${var.project_name}-${var.environment}-api-handler"
  role            = var.lambda_execution_role_arn
  handler         = "index.handler"
  runtime         = "nodejs18.x"
  timeout         = 30
  memory_size     = 1024

  # Environment variables for the Lambda function
  environment {
    variables = {
      NODE_ENV = var.environment
      REGION   = data.aws_region.current.name
    }
  }

  # This is just a placeholder - actual deployment via Amplify
  lifecycle {
    ignore_changes = [
      filename,
      source_code_hash
    ]
  }

  depends_on = [aws_cloudwatch_log_group.nuxt_app]

  tags = {
    Name = "${var.project_name}-${var.environment}-api-handler"
  }
}

# Create a placeholder zip file for the Lambda function
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "placeholder.zip"
  
  source {
    content = jsonencode({
      message = "This is a placeholder. Actual code will be deployed via Amplify."
    })
    filename = "index.js"
  }
}

# Current AWS region
data "aws_region" "current" {}

# Lambda permission for API Gateway (if needed)
resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api_handler.function_name
  principal     = "apigateway.amazonaws.com"
}