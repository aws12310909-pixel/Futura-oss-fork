<template>
  <div class="w-full h-full">
    <canvas ref="chartCanvas" class="w-full h-full"/>
  </div>
</template>

<script setup lang="ts">
import type { MarketRate } from '~/types'

const props = defineProps<{
  data: MarketRate[]
}>()

const chartCanvas = ref<HTMLCanvasElement>()

// Simple line chart implementation for BTC rate trends
const drawChart = () => {
  if (!chartCanvas.value || !props.data.length) return

  const canvas = chartCanvas.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Set canvas size
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * window.devicePixelRatio
  canvas.height = rect.height * window.devicePixelRatio
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

  const width = rect.width
  const height = rect.height
  const padding = 50

  // Clear canvas
  ctx.clearRect(0, 0, width, height)

  // Sort data by timestamp and get rate values
  const sortedData = [...props.data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
  const values = sortedData.map(item => item.btc_jpy_rate)
  const timestamps = sortedData.map(item => item.timestamp)
  
  const maxValue = Math.max(...values)
  const minValue = Math.min(...values)
  const valueRange = maxValue - minValue || 1

  // Helper functions
  const getX = (index: number) => padding + (index / (sortedData.length - 1)) * (width - 2 * padding)
  const getY = (value: number) => height - padding - ((value - minValue) / valueRange) * (height - 2 * padding)

  // Draw grid lines
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1

  // Horizontal grid lines
  for (let i = 0; i <= 5; i++) {
    const y = padding + (i / 5) * (height - 2 * padding)
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
  }

  // Vertical grid lines (show every few data points)
  const step = Math.max(1, Math.floor(sortedData.length / 6))
  for (let i = 0; i < sortedData.length; i += step) {
    const x = getX(i)
    ctx.beginPath()
    ctx.moveTo(x, padding)
    ctx.lineTo(x, height - padding)
    ctx.stroke()
  }

  // Draw area under curve with orange gradient
  if (sortedData.length > 1) {
    const gradient = ctx.createLinearGradient(0, padding, 0, height - padding)
    gradient.addColorStop(0, 'rgba(251, 146, 60, 0.3)')
    gradient.addColorStop(1, 'rgba(251, 146, 60, 0.05)')
    
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.moveTo(getX(0), height - padding)
    
    sortedData.forEach((item, index) => {
      ctx.lineTo(getX(index), getY(item.btc_jpy_rate))
    })
    
    ctx.lineTo(getX(sortedData.length - 1), height - padding)
    ctx.closePath()
    ctx.fill()
  }

  // Draw line with orange color
  ctx.strokeStyle = '#f97316'
  ctx.lineWidth = 3
  ctx.beginPath()
  
  sortedData.forEach((item, index) => {
    const x = getX(index)
    const y = getY(item.btc_jpy_rate)
    
    if (index === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  })
  
  ctx.stroke()

  // Draw points
  ctx.fillStyle = '#f97316'
  sortedData.forEach((item, index) => {
    const x = getX(index)
    const y = getY(item.btc_jpy_rate)
    
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, 2 * Math.PI)
    ctx.fill()
  })

  // Draw labels
  ctx.fillStyle = '#6b7280'
  ctx.font = '12px Inter, sans-serif'
  ctx.textAlign = 'center'

  // X-axis labels (timestamps)
  const labelStep = Math.max(1, Math.floor(sortedData.length / 4))
  for (let i = 0; i < sortedData.length; i += labelStep) {
    const x = getX(i)
    const date = new Date(timestamps[i])
    const label = `${date.getMonth() + 1}/${date.getDate()}`
    ctx.fillText(label, x, height - 15)
  }

  // Y-axis labels (BTC rates)
  ctx.textAlign = 'right'
  for (let i = 0; i <= 5; i++) {
    const value = minValue + (i / 5) * valueRange
    const y = height - padding - ((value - minValue) / valueRange) * (height - 2 * padding)
    const label = value >= 1000000 
      ? `¥${(value / 1000000).toFixed(1)}M`
      : value >= 1000
      ? `¥${(value / 1000).toFixed(0)}K`
      : `¥${value.toLocaleString()}`
    ctx.fillText(label, padding - 10, y + 4)
  }
}

// Redraw chart when data changes
watch(() => props.data, () => {
  nextTick(() => {
    drawChart()
  })
}, { deep: true })

// Draw chart on mount
onMounted(() => {
  nextTick(() => {
    drawChart()
  })
})

// Handle window resize
const handleResize = () => {
  nextTick(() => {
    drawChart()
  })
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})
</script>
