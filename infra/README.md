# BTC Mock App Infrastructure

This directory contains Terraform configurations for the BTC Mock App infrastructure.

## Structure

```
infra/
├── main.tf              # Main Terraform configuration
├── variables.tf         # Input variables
├── outputs.tf          # Output values
├── terraform.tfvars.example  # Example variables file
├── cognito/            # Cognito User Pools configuration
├── dynamodb/           # DynamoDB tables configuration
├── s3/                # S3 bucket configuration
├── iam/               # IAM roles and policies
└── lambda/            # Lambda function configuration
```

## Prerequisites

1. AWS CLI configured with appropriate credentials
2. Terraform installed (>= 1.0)
3. Appropriate AWS permissions for:
   - Cognito
   - DynamoDB
   - S3
   - IAM
   - Lambda
   - CloudWatch

## Deployment

1. Copy the example variables file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars` with your specific values:
   ```hcl
   aws_region   = "ap-northeast-1"
   environment  = "dev"
   project_name = "futura"
   ```

3. Initialize Terraform:
   ```bash
   terraform init
   ```

4. Plan the deployment:
   ```bash
   terraform plan
   ```

5. Apply the configuration:
   ```bash
   terraform apply
   ```

## Resources Created

- **Cognito User Pool**: User authentication and authorization
- **DynamoDB Tables**: Data storage (5 tables)
- **S3 Bucket**: File upload storage (private)
- **IAM Roles/Policies**: Lambda execution permissions
- **Lambda Function**: Placeholder for Amplify deployment
- **CloudWatch Log Groups**: Application logging

## Important Notes

- The initial admin user is created with username `admin` and temporary password `TempPass123!`
- All resources are tagged with environment and project information
- DynamoDB tables have point-in-time recovery enabled
- S3 bucket is private with versioning enabled
- Lambda function is a placeholder - actual deployment via Amplify

## Environment Variables

After deployment, you'll need these values for your application:

- `COGNITO_USER_POOL_ID`: From output `cognito_user_pool_id`
- `COGNITO_CLIENT_ID`: From output `cognito_user_pool_client_id`
- `S3_BUCKET_NAME`: From output `s3_bucket_name`
- `DYNAMODB_TABLE_NAMES`: From output `dynamodb_table_names`

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

**Warning**: This will permanently delete all data. Make sure to backup any important data before running this command.