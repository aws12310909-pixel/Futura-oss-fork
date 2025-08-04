import { 
  PERMISSION_DEFINITIONS, 
  getPermissionsByLevel, 
  getDefaultPermissionTemplates 
} from '~/server/utils/permission-definitions'

export default defineEventHandler(async (event) => {
  try {
    // Require admin permission
    await requirePermission(event, 'admin:access')
    
    return {
      success: true,
      data: {
        categories: PERMISSION_DEFINITIONS.categories,
        allPermissions: PERMISSION_DEFINITIONS.allPermissions,
        totalCount: PERMISSION_DEFINITIONS.allPermissions.length,
        userCategories: getPermissionsByLevel('user'),
        adminCategories: getPermissionsByLevel('admin'),
        templates: getDefaultPermissionTemplates()
      }
    }
    
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch permissions'
    })
  }
})