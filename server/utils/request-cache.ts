import type { H3Event } from 'h3'

const REQUEST_CACHE = new WeakMap<H3Event, Map<string, any>>()

export function getRequestCache(event: H3Event): Map<string, any> {
  if (!REQUEST_CACHE.has(event)) {
    REQUEST_CACHE.set(event, new Map())
  }
  return REQUEST_CACHE.get(event)!
}

export function getCachedUserPermissions(event: H3Event, userId: string) {
  const cache = getRequestCache(event)
  const key = `permissions:${userId}`
  
  if (cache.has(key)) {
    return cache.get(key)
  }
  
  return null
}

export function setCachedUserPermissions(event: H3Event, userId: string, permissions: string[]) {
  const cache = getRequestCache(event)
  const key = `permissions:${userId}`
  cache.set(key, permissions)
}

export function getCachedUserInfo(event: H3Event, userId: string) {
  const cache = getRequestCache(event)
  const key = `user:${userId}`
  
  if (cache.has(key)) {
    return cache.get(key)
  }
  
  return null
}

export function setCachedUserInfo(event: H3Event, userId: string, userInfo: any) {
  const cache = getRequestCache(event)
  const key = `user:${userId}`
  cache.set(key, userInfo)
}