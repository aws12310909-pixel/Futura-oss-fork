import type { DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb'
import type { RuntimeConfig } from '@nuxt/schema'
import { createDynamoDBDocumentClient } from './client-factory'

// Type for DynamoDB document values
type DynamoDBValue = string | number | boolean | null | DynamoDBValue[] | { [key: string]: DynamoDBValue }
type DynamoDBRecord = Record<string, DynamoDBValue>

class DynamoDBService {
  private client: DynamoDBDocumentClient
  private config: RuntimeConfig

  constructor() {
    this.config = useRuntimeConfig()
    this.client = createDynamoDBDocumentClient()
  }

  // Generic CRUD operations
  async get(tableName: string, key: DynamoDBRecord) {
    const command = new GetCommand({
      TableName: tableName,
      Key: key
    })
    
    const response = await this.client.send(command)
    return response.Item
  }

  async put(tableName: string, item: Record<string, unknown>) {
    const command = new PutCommand({
      TableName: tableName,
      Item: item
    })
    
    await this.client.send(command)
    return item
  }

  async update(tableName: string, key: DynamoDBRecord, updateExpression: string, expressionAttributeValues: DynamoDBRecord, expressionAttributeNames?: Record<string, string>) {
    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: 'ALL_NEW'
    })
    
    const response = await this.client.send(command)
    return response.Attributes
  }

  async delete(tableName: string, key: DynamoDBRecord) {
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key
    })
    
    await this.client.send(command)
  }

  async query(tableName: string, keyConditionExpression: string, expressionAttributeValues: DynamoDBRecord, options?: {
    indexName?: string
    filterExpression?: string
    expressionAttributeNames?: Record<string, string>
    limit?: number
    scanIndexForward?: boolean
  }) {
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      IndexName: options?.indexName,
      FilterExpression: options?.filterExpression,
      ExpressionAttributeNames: options?.expressionAttributeNames,
      Limit: options?.limit,
      ScanIndexForward: options?.scanIndexForward
    })
    
    const response = await this.client.send(command)
    return {
      items: response.Items || [],
      lastEvaluatedKey: response.LastEvaluatedKey,
      count: response.Count || 0
    }
  }

  async scan(tableName: string, options?: {
    filterExpression?: string
    expressionAttributeValues?: DynamoDBRecord
    expressionAttributeNames?: Record<string, string>
    limit?: number
    select?: 'ALL_ATTRIBUTES' | 'ALL_PROJECTED_ATTRIBUTES' | 'SPECIFIC_ATTRIBUTES' | 'COUNT'
  }) {
    const command = new ScanCommand({
      TableName: tableName,
      FilterExpression: options?.filterExpression,
      ExpressionAttributeValues: options?.expressionAttributeValues,
      ExpressionAttributeNames: options?.expressionAttributeNames,
      Limit: options?.limit,
      Select: options?.select
    })
    
    const response = await this.client.send(command)
    return {
      items: response.Items || [],
      lastEvaluatedKey: response.LastEvaluatedKey,
      count: response.Count || 0
    }
  }

  // Helper methods for specific tables
  getTableName(table: 'users' | 'transactions' | 'market_rates' | 'sessions' | 'permissions' | 'batch_operations'): string {
    const tableMap = {
      'users': this.config.dynamodbUsersTable,
      'transactions': this.config.dynamodbTransactionsTable,
      'market_rates': this.config.dynamodbMarketRatesTable,
      'sessions': this.config.dynamodbSessionsTable,
      'permissions': this.config.dynamodbPermissionsTable,
      'batch_operations': this.config.dynamodbBatchOperationsTable
    }
    
    const tableName = tableMap[table]
    if (!tableName) {
      throw new Error(`Environment variable for table '${table}' is not configured`)
    }
    
    return tableName
  }

  // Transaction operations
  async transactWrite(items: Array<{
    Put?: { TableName: string; Item: Record<string, unknown> }
    Update?: { TableName: string; Key: DynamoDBRecord; UpdateExpression: string; ExpressionAttributeValues: DynamoDBRecord; ExpressionAttributeNames?: Record<string, string> }
    Delete?: { TableName: string; Key: DynamoDBRecord }
    ConditionCheck?: { TableName: string; Key: DynamoDBRecord; ConditionExpression: string; ExpressionAttributeValues?: DynamoDBRecord }
  }>) {
    const command = new TransactWriteCommand({
      TransactItems: items
    })
    
    await this.client.send(command)
  }
}

// Create singleton instance
let dynamoService: DynamoDBService

export const getDynamoDBService = () => {
  if (!dynamoService) {
    dynamoService = new DynamoDBService()
  }
  return dynamoService
}