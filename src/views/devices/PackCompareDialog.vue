<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import echarts from '@/utils/echarts'
import dayjs from 'dayjs'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  packs: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v)
})

const metric = ref('temperatureMax')
const METRICS = [
  { key: 'temperatureMax', label: '最高温度 (℃)', unit: '℃', base: (p) => p.temperatureMax, amp: 4 },
  { key: 'voltage',        label: 'PACK 电压 (V)',  unit: 'V', base: (p) => p.voltage,        amp: 0.6 },
  { key: 'soc',            label: 'SOC (%)',        unit: '%', base: (p) => p.soc,            amp: 18 },
  { key: 'tempDelta',      label: '温差 (℃)',       unit: '℃', base: (p) => p.tempDelta,      amp: 2 },
  { key: 'voltDelta',      label: '压差 (mV)',      unit: 'mV', base: (p) => p.voltDelta,     amp: 20 }
]
const curMetric = computed(() => METRICS.find(m => m.key === metric.value))

const COLORS = ['#015eea', '#ef4444', '#22d3a0', '#f59e0b']

/* 用 pack.id 哈希做种子，保证每个 PACK 趋势稳定 */
function hashSeed(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619 >>> 0
  return h
}
function mulberry32(a) {
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function gen24h(pack, m) {
  const rnd = mulberry32(hashSeed(pack.id + ':' + m.key))
  const base = m.base(pack)
  const arr = []
  for (let i = 0; i < 96; i++) {
    const t = i / 96 * 2 * Math.PI
    const v = base + Math.sin(t + (rnd() - 0.5) * 2) * m.amp * 0.5 + (rnd() - 0.5) * m.amp * 0.4
    arr.push(+v.toFixed(m.key === 'voltage' ? 2 : 1))
  }
  return arr
}

const labels = Array.from({ length: 96 }, (_, i) => {
  const start = dayjs().startOf('day')
  return start.add(i * 15, 'minute').format('HH:mm')
})

const chartEl = ref(null)
let chart = null
function render() {
  if (!chart) return
  const m = curMetric.value
  const series = props.packs.slice(0, 4).map((p, i) => ({
    name: p.label,
    type: 'line', smooth: true, showSymbol: false, sampling: 'lttb',
    data: gen24h(p, m),
    lineStyle: { color: COLORS[i], width: 2 }
  }))
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { fontSize: 12 } },
    grid: { left: 56, right: 24, top: 40, bottom: 30 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: '#525c75', fontSize: 11, interval: Math.floor(labels.length / 10) },
      axisLine: { lineStyle: { color: '#dadfeb' } }
    },
    yAxis: {
      type: 'value', name: m.unit, nameTextStyle: { color: '#8a93a8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#eef0f7' } },
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    series
  }, true)
}

function init() {
  if (chart) return
  nextTick(() => {
    if (chartEl.value) {
      chart = echarts.init(chartEl.value)
      render()
    }
  })
}

watch(visible, (v) => {
  if (v) init()
  else { chart?.dispose(); chart = null }
})
watch(metric, () => render())
watch(() => props.packs, () => render(), { deep: false })

function onResize() { chart?.resize() }
window.addEventListener('resize', onResize)
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  chart?.dispose()
})

/* 表格汇总 */
const summary = computed(() => props.packs.slice(0, 4).map((p, i) => ({
  ...p,
  color: COLORS[i]
})))
</script>

<template>
  <el-dialog
    v-model="visible"
    title="PACK 对比"
    width="900"
    @opened="init"
  >
    <div class="cmp-tip">基于 PACK id 稳定生成 24 小时趋势，便于多 PACK 同图对比</div>

    <div class="cmp-tabs">
      <el-radio-group v-model="metric" size="default">
        <el-radio-button v-for="m in METRICS" :key="m.key" :value="m.key">{{ m.label }}</el-radio-button>
      </el-radio-group>
    </div>

    <div class="cmp-chart" ref="chartEl" />

    <div class="cmp-table">
      <div class="ct-head">
        <div>PACK</div>
        <div>电压 V</div>
        <div>SOC %</div>
        <div>SOH %</div>
        <div>最高温 ℃</div>
        <div>温差 ℃</div>
        <div>压差 mV</div>
      </div>
      <div class="ct-row" v-for="p in summary" :key="p.id" :style="{ borderLeftColor: p.color }">
        <div class="ct-name"><span class="dot" :style="{ background: p.color }" /> {{ p.label }}<span class="path">{{ p.path }}</span></div>
        <div>{{ p.voltage }}</div>
        <div>{{ p.soc }}</div>
        <div :class="p.soh < 90 ? 'err' : p.soh < 93 ? 'warn' : ''">{{ p.soh }}</div>
        <div :class="p.temperatureMax > 38 ? 'err' : p.temperatureMax > 35 ? 'warn' : ''">{{ p.temperatureMax }}</div>
        <div>{{ p.tempDelta }}</div>
        <div :class="p.voltDelta > 80 ? 'err' : p.voltDelta > 50 ? 'warn' : ''">{{ p.voltDelta }}</div>
      </div>
    </div>
  </el-dialog>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;
.cmp-tip { font-size: 12px; color: $text-muted; margin-bottom: 12px; }
.cmp-tabs { margin-bottom: 14px; }
.cmp-chart { width: 100%; height: 340px; }
.cmp-table {
  margin-top: 16px;
  border-top: 1px solid $border-soft;
  padding-top: 12px;
}
.ct-head, .ct-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr 1fr;
  gap: 10px;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
}
.ct-head {
  background: $bg-soft;
  border-radius: 6px;
  font-weight: 600; font-size: 12px; color: $text-muted;
}
.ct-row {
  border-left: 3px solid transparent;
  padding-left: 9px;
  &:not(:last-child) { border-bottom: 1px dashed $border-soft; }
}
.ct-name { display: flex; align-items: center; gap: 8px; font-weight: 500; }
.ct-name .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.ct-name .path { font-size: 11px; color: $text-muted; margin-left: 6px; }
.warn { color: #f59e0b; font-weight: 600; }
.err  { color: #ef4444; font-weight: 600; }
</style>
