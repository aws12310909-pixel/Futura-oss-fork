import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'

interface UploadImageRequest {
  filename: string
  contentType: string
  base64Data: string
}

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[UploadImage]' })
  try {
    const currentUser = await requireAuth(event)
    
    // Parse JSON body
    const body = await readBody<UploadImageRequest>(event)
    
    if (!body || !body.filename || !body.contentType || !body.base64Data) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Missing required fields: filename, contentType, base64Data'
      })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(body.contentType)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid file type. Only JPEG and PNG are allowed'
      })
    }

    // Decode Base64 to Buffer
    const fileBuffer = Buffer.from(body.base64Data, 'base64')

    // Validate file size (max 3MB)
    const maxSize = 3 * 1024 * 1024 // 3MB
    if (fileBuffer.length > maxSize) {
      throw createError({
        statusCode: 400,
        statusMessage: 'File size too large. Maximum 3MB allowed'
      })
    }

    const config = useRuntimeConfig()
    const s3Client = new S3Client({
      region: config.awsRegion
    })

    // Generate unique file name
    const fileExtension = body.filename.split('.').pop() || 'jpg'
    const fileName = `profile-images/${currentUser.user_id}/${Date.now()}.${fileExtension}`

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: config.s3UploadsBucket,
      Key: fileName,
      Body: fileBuffer,
      ContentType: body.contentType
    })

    await s3Client.send(uploadCommand)

    // Generate image URL
    // imageBaseUrl is required (e.g., CloudFront URL) since S3 bucket is private
    if (!config.imageBaseUrl) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Image base URL is not configured. Please set NUXT_IMAGE_BASE_URL environment variable'
      })
    }

    const imageUrl = `${config.imageBaseUrl.replace(/\/$/, '')}/${fileName}`
    
    const dynamodb = getDynamoDBService()
    const tableName = dynamodb.getTableName('users')

    await dynamodb.update(
      tableName,
      { user_id: currentUser.user_id },
      'SET profile_image_url = :image_url, updated_at = :updated_at',
      {
        ':image_url': imageUrl,
        ':updated_at': new Date().toISOString()
      }
    )

    return {
      success: true,
      data: {
        url: imageUrl,
        key: fileName
      },
      message: 'Image uploaded successfully'
    }
  } catch (error: unknown) {
    logger.error('画像アップロードエラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upload image'
    })
  }
})