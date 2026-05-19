<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  title: String,
  desc: String,
  option: Object,
  height: { type: String, default: '320px' }
})

const el = ref(null)
let chart = null

function render() {
  if (!el.value) return
  if (!chart) chart = echarts.init(el.value)
  chart.setOption(props.option || {}, true)
}

function resize() { chart && chart.resize() }

onMounted(() => {
  render()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart && chart.dispose()
})

watch(() => props.option, () => render(), { deep: true })
</script>

<template>
  <div class="chart-card">
    <div class="cc-head" v-if="title">
      <div>
        <div class="cc-title">{{ title }}</div>
        <div class="cc-desc" v-if="desc">{{ desc }}</div>
      </div>
      <slot name="extra" />
    </div>
    <div class="cc-body" :style="{ height }" ref="el" />
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.chart-card {
  background: $bg-card;
  border: 1px solid $border-soft;
  border-radius: $radius;
  padding: 20px;
  box-shadow: $shadow-card;
}
.cc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.cc-title { font-size: 15px; font-weight: 600; }
.cc-desc { font-size: 12px; color: $text-muted; margin-top: 4px; }
.cc-body { width: 100%; }
</style>
