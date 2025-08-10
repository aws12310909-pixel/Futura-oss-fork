import { RespondToAuthChallengeCommand } from '@aws-sdk/client-cognito-identity-provider'
import type { ChangeInitialPasswordRequest } from '~/types'
import { createCognitoClient } from '~/server/utils/client-factory'
import { useLogger } from '~/composables/useLogger'

const logger = useLogger({ prefix: '[API-CHANGE-INITIAL-PWD]' })

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<ChangeInitialPasswordRequest>(event)
    const { email, temporaryPassword, newPassword, session } = body

    if (!email || !temporaryPassword || !newPassword || !session) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Email, temporary password, new password, and session are required'
      })
    }

    const config = useRuntimeConfig()
    const client = createCognitoClient()

    // Respond to NEW_PASSWORD_REQUIRED challenge
    const challengeCommand = new RespondToAuthChallengeCommand({
      ClientId: config.cognitoClientId as string,
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      Session: session,
      ChallengeResponses: {
        USERNAME: email,
        NEW_PASSWORD: newPassword
      }
    })

    const challengeResponse = await client.send(challengeCommand)

    if (!challengeResponse.AuthenticationResult?.AccessToken) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Failed to change password'
      })
    }

    return {
      success: true,
      message: 'Password changed successfully',
      data: {
        authenticationResult: challengeResponse.AuthenticationResult
      }
    }
  } catch (error: unknown) {
    logger.error('初期パスワード変更エラー:', error)
    
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error'
    })
  }
})