<template>
  <img 
    :src="logoUrl" 
    alt="M・S CFD App Logo" 
    :class="computedClass"
    @error="handleImageError"
  />
</template>

<script setup lang="ts">
interface Props {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  centered?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'xl',
  centered: true
})

const config = useRuntimeConfig()

// ロゴ画像のパス（後で調整可能）
const logoPath = '/logo/ms-cfd-logo.png'

// 完全なロゴURL
const logoUrl = computed(() => {
  const baseUrl = config.public.imageBaseUrl
  if (!baseUrl) {
    // imageBaseUrlが設定されていない場合は、publicディレクトリからの相対パスを使用
    return logoPath
  }
  // 末尾のスラッシュを調整
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  return `${normalizedBaseUrl}${logoPath}`
})

// サイズと配置に応じたクラス
const computedClass = computed(() => {
  const sizeClasses = {
    sm: 'h-5',
    md: 'h-6',
    lg: 'h-8',
    xl: 'h-24'
  }
  
  const baseClass = `${sizeClasses[props.size]} w-auto flex-shrink-0`
  const alignClass = props.centered ? 'mx-auto mb-4' : ''
  
  return `${baseClass} ${alignClass}`.trim()
})

// 画像読み込みエラー時のハンドリング
const handleImageError = (event: Event) => {
  console.warn('Logo image failed to load:', logoUrl.value)
}
</script>

