import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getDynamoDBService } from '~/server/utils/dynamodb'
import { useLogger } from '~/composables/useLogger'

export default defineEventHandler(async (event) => {
  const logger = useLogger({ prefix: '[UploadImage]' })
  try {
    const currentUser = await requireAuth(event)
    
    // Parse form data
    const formData = await readMultipartFormData(event)
    
    if (!formData || formData.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'No file provided'
      })
    }

    const file = formData.find(item => item.name === 'file')
    
    if (!file || !file.data) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid file data'
      })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
    if (!allowedTypes.includes(file.type || '')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid file type. Only JPEG and PNG are allowed'
      })
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.data.length > maxSize) {
      throw createError({
        statusCode: 400,
        statusMessage: 'File size too large. Maximum 5MB allowed'
      })
    }

    const config = useRuntimeConfig()
    const s3Client = new S3Client({
      region: config.awsRegion
    })

    // Generate unique file name
    const fileExtension = file.filename?.split('.').pop() || 'jpg'
    const fileName = `profile-images/${currentUser.user_id}/${Date.now()}.${fileExtension}`

    // Upload to S3
    const uploadCommand = new PutObjectCommand({
      Bucket: config.s3UploadsBucket,
      Key: fileName,
      Body: file.data,
      ContentType: file.type
    })

    await s3Client.send(uploadCommand)

    // Update user profile with image URL
    const imageUrl = `https://${config.s3UploadsBucket}.s3.${config.awsRegion}.amazonaws.com/${fileName}`
    
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