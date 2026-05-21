<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import echarts from '@/utils/echarts'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import { stations } from '@/mock/data'
import {
  VideoPlay, VideoPause, ArrowLeftBold, ArrowRightBold, Refresh,
  Download, Clock, Warning, MagicStick, Aim
} from '@element-plus/icons-vue'

/* ---------- 选择 ---------- */
const stationId = ref(stations[0].id)
const packLabel = ref('PACK-07')
const range = ref([
  dayjs('2026-03-12 13:50').toDate(),
  dayjs('2026-03-12 14:50').toDate()
])

/* ---------- 全量历史数据（1Hz） ---------- */
const totalSec = computed(() => Math.floor((range.value[1] - range.value[0]) / 1000))

// 模拟一条带"事故峰"的数据（PACK-07 14:23:18 热失控）
function genHistory() {
  const start = dayjs(range.value[0])
  const total = totalSec.value
  const incidentAt = dayjs('2026-03-12 14:23:18')
  const incidentOffset = incidentAt.diff(start, 'second')
  return Array.from({ length: total }, (_, i) => {
    const t = start.add(i, 'second')
    const d = i - incidentOffset
    let temp, ins, vDelta
    if (d < -300) {
      temp = 28 + Math.sin(i / 40) * 1.5 + (Math.random() - 0.5) * 0.4
      ins = 4800 + (Math.random() - 0.5) * 100
      vDelta = 22 + (Math.random() - 0.5) * 6
    } else if (d < 0) {
      const k = (d + 300) / 300
      temp = 28 + k * k * 12 + (Math.random() - 0.5) * 0.6
      ins = 4800 - k * k * 3500
      vDelta = 22 + k * k * 28
    } else if (d < 120) {
      const k = Math.exp(-d / 30)
      temp = 28 + 36 * k + (Math.random() - 0.5) * 0.8
      ins = 60 + (1 - k) * 4700
      vDelta = 50 + 40 * k
    } else {
      temp = 28 + Math.sin(i / 40) * 1.5 + (Math.random() - 0.5) * 0.4
      ins = 4800 + (Math.random() - 0.5) * 100
      vDelta = 22 + (Math.random() - 0.5) * 6
    }
    const I = -18 - Math.sin(i / 60) * 6 + (d > -10 && d < 60 ? 40 * Math.exp(-Math.abs(d) / 30) : 0)
    const V = 47.3 + (Math.random() - 0.5) * 0.3 - (d > -10 && d < 60 ? 1.2 * Math.exp(-Math.abs(d) / 30) : 0)
    const SOC = Math.max(0, 70 - i * 0.005 + Math.sin(i / 120) * 4)
    return {
      time: t.format('HH:mm:ss'),
      timestamp: t.valueOf(),
      voltage: +V.toFixed(2),
      current: +I.toFixed(1),
      tempMax: +temp.toFixed(1),
      tempMin: +(temp - 2 - Math.random()).toFixed(1),
      tempDelta: +(temp - (temp - 2 - Math.random())).toFixed(1),
      soc: +SOC.toFixed(1),
      insulation: Math.max(20, Math.round(ins)),
      voltageDelta: Math.max(8, Math.round(vDelta))
    }
  })
}
const history = ref(genHistory())

/* ---------- 标注事件 ---------- */
const incidents = computed(() => {
  const base = dayjs(range.value[0])
  const events = [
    { offset: 18 * 60 + 0,  label: '簇电流异常波动',         level: 'info' },
    { offset: 21 * 60 + 42, label: 'PACK-07 压差 >50mV',    level: 'warn' },
    { offset: 22 * 60 + 35, label: '温度梯度 4.8℃ 二级预警', level: 'warn' },
    { offset: 23 * 60 + 18, label: '热失控早期预警',         level: 'err'  },
    { offset: 23 * 60 + 25, label: '消防联动启动 / 灭火释放', level: 'err'  },
    { offset: 24 * 60 + 2,  label: '运维远程拉闸',           level: 'info' },
    { offset: 31 * 60 + 10, label: '温度回落、绝缘恢复',     level: 'ok'   }
  ]
  const baseTime = dayjs('2026-03-12 14:00')
  return events.map(e => {
    const t = baseTime.add(e.offset, 'second')
    const idx = Math.floor((t - base) / 1000)
    return { ...e, time: t.format('HH:mm:ss'), idx }
  }).filter(e => e.idx >= 0 && e.idx < totalSec.value)
})

/* 事故关键时刻 = 第一条 err 级 */
const incidentIdx = computed(() => {
  const err = incidents.value.find(e => e.level === 'err')
  return err ? err.idx : Math.floor(totalSec.value / 2)
})

/* ---------- 播放控制 ---------- */
const cursor = ref(0)
const playing = ref(false)
const speed = ref(5)
const speeds = [1, 2, 5, 10, 30]

let timer = null
function play() {
  playing.value = true
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    cursor.value = (cursor.value + 1) % totalSec.value
    if (cursor.value === totalSec.value - 1) pause()
  }, Math.max(20, 1000 / speed.value))
}
function pause() {
  playing.value = false
  if (timer) { clearInterval(timer); timer = null }
}
function toggle() { playing.value ? pause() : play() }
function rewind(s) { cursor.value = Math.max(0, cursor.value - s) }
function forward(s) { cursor.value = Math.min(totalSec.value - 1, cursor.value + s) }
function jumpTo(idx) { cursor.value = idx; pause() }

/* 快速跳转 */
function jumpBefore5min() { jumpTo(Math.max(0, incidentIdx.value - 300)) }
function jumpAtIncident() { jumpTo(incidentIdx.value) }
function jumpAfter2min() { jumpTo(Math.min(totalSec.value - 1, incidentIdx.value + 120)) }

/* 倍速档位调节 */
function speedUp() {
  const i = speeds.indexOf(speed.value)
  if (i < speeds.length - 1) speed.value = speeds[i + 1]
}
function speedDown() {
  const i = speeds.indexOf(speed.value)
  if (i > 0) speed.value = speeds[i - 1]
}

watch(speed, () => { if (playing.value) play() })
watch(range, () => { history.value = genHistory(); cursor.value = 0; pause(); renderAll() })

/* ---------- 键盘快捷键 ---------- */
function onKey(e) {
  if (e.target?.matches?.('input, textarea, [contenteditable]')) return
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.code === 'Space') { e.preventDefault(); toggle() }
  else if (e.code === 'ArrowLeft') { e.preventDefault(); rewind(10) }
  else if (e.code === 'ArrowRight') { e.preventDefault(); forward(10) }
  else if (e.key === '+' || e.key === '=') { e.preventDefault(); speedUp() }
  else if (e.key === '-' || e.key === '_') { e.preventDefault(); speedDown() }
}

/* ---------- 当前帧 ---------- */
const cur = computed(() => history.value[cursor.value] || history.value[0])
const cursorPct = computed(() => (cursor.value / (totalSec.value - 1)) * 100)
const curTime = computed(() => cur.value.time)

/* ---------- sparkline ±30s ---------- */
const SPARK_R = 30
const SPARK_W = 64
const SPARK_H = 18

function sparkWindow() {
  const c = cursor.value
  const lo = Math.max(0, c - SPARK_R)
  const hi = Math.min(history.value.length - 1, c + SPARK_R)
  return { lo, hi, c }
}

// 为避免重复扫描，把 (lo,hi,min,max) 一并算好
const sparkCache = computed(() => {
  const { lo, hi, c } = sparkWindow()
  const len = hi - lo + 1
  const out = {}
  const fields = ['voltage', 'current', 'tempMax', 'tempDelta', 'voltageDelta', 'insulation', 'soc']
  fields.forEach(f => {
    let mn = Infinity, mx = -Infinity
    for (let i = lo; i <= hi; i++) {
      const v = history.value[i][f]
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
    out[f] = { mn, mx, lo, hi, len, c }
  })
  return out
})

function sparkPath(field) {
  const meta = sparkCache.value[field]
  if (!meta) return ''
  const { mn, mx, lo, hi, len } = meta
  const span = mx - mn || 1
  const step = SPARK_W / Math.max(1, len - 1)
  let s = ''
  for (let i = lo; i <= hi; i++) {
    const v = (field === 'tempDelta')
      ? +(history.value[i].tempMax - history.value[i].tempMin).toFixed(2)
      : history.value[i][field]
    const x = ((i - lo) * step).toFixed(1)
    const y = (SPARK_H - 1 - ((v - mn) / span) * (SPARK_H - 2)).toFixed(1)
    s += (i === lo ? 'M' : 'L') + x + ',' + y + ' '
  }
  return s
}
function sparkAreaPath(field) {
  const meta = sparkCache.value[field]
  if (!meta) return ''
  return sparkPath(field) + ` L${SPARK_W},${SPARK_H} L0,${SPARK_H} Z`
}
function sparkDot(field) {
  const meta = sparkCache.value[field]
  if (!meta) return { x: 0, y: 0 }
  const { mn, mx, lo, hi, c } = meta
  const span = mx - mn || 1
  const step = SPARK_W / Math.max(1, (hi - lo))
  const v = (field === 'tempDelta')
    ? +(history.value[c].tempMax - history.value[c].tempMin).toFixed(2)
    : history.value[c][field]
  return {
    x: +((c - lo) * step).toFixed(1),
    y: +(SPARK_H - 1 - ((v - mn) / span) * (SPARK_H - 2)).toFixed(1)
  }
}

/* ---------- 单体电压（随事故时刻变化） ---------- */
const cellsAt = computed(() => {
  const c = cur.value
  return Array.from({ length: 104 }, (_, i) => {
    let v = 3.35 + (Math.random() - 0.5) * 0.02
    if (i === 6 && c.voltageDelta > 50) v -= c.voltageDelta / 1000
    return v
  })
})

/* ---------- 温度场（4×4 随时刻） ---------- */
const tempGridAt = computed(() => {
  const c = cur.value
  return Array.from({ length: 16 }, (_, i) => {
    let base = c.tempMin + (c.tempMax - c.tempMin) * Math.random()
    if (i === 6 && c.tempMax > 40) base = c.tempMax - 1 + Math.random() * 2
    return +base.toFixed(1)
  })
})

/* ---------- ECharts ---------- */
const trendEl = ref(null)
const cellEl = ref(null)
const heatEl = ref(null)
let trendChart, cellChart, heatChart

function cursorMarkLine() {
  return {
    symbol: ['none', 'circle'],
    symbolSize: 8,
    animation: false,
    silent: true,
    data: [{
      xAxis: cursor.value,
      lineStyle: { color: '#06b6d4', width: 2, type: 'solid', shadowColor: 'rgba(6,182,212,0.4)', shadowBlur: 4 },
      label: { show: false }
    }]
  }
}
function incidentMarkPoint() {
  return {
    symbol: 'pin', symbolSize: 28,
    animation: false,
    label: { show: false },
    data: incidents.value.map(e => ({
      xAxis: e.idx, yAxis: history.value[e.idx]?.tempMax || 30,
      itemStyle: { color: e.level === 'err' ? '#ef4444' : e.level === 'warn' ? '#f59e0b' : e.level === 'ok' ? '#22d3a0' : '#015eea' },
      name: e.label
    }))
  }
}

function renderTrend() {
  if (!trendChart) return
  const labels = history.value.map(d => d.time)
  const axisFont = { color: '#525c75', fontSize: 12, fontFamily: 'inherit' }
  const nameFont = { color: '#8a93a8', fontSize: 12, fontWeight: 500 }
  trendChart.setOption({
    textStyle: { fontFamily: 'PingFang SC, -apple-system, "Segoe UI", system-ui, sans-serif' },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(16,21,46,0.92)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 }
    },
    legend: {
      top: 6, left: 'center',
      itemWidth: 14, itemHeight: 8, itemGap: 18,
      data: ['PACK 电压', '最高温(℃)', '电流(A)', 'SOC(%)'],
      textStyle: { fontSize: 13, color: '#1a1f36', fontWeight: 500 }
    },
    grid: { left: 56, right: 64, top: 56, bottom: 36 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { ...axisFont, interval: Math.floor(labels.length / 8), margin: 10 },
      axisLine: { lineStyle: { color: '#dadfeb' } },
      axisTick: { show: false }
    },
    yAxis: [
      { type: 'value', name: '电压 V / 温度 ℃', position: 'left',
        splitLine: { lineStyle: { color: '#eef0f7' } },
        axisLabel: axisFont,
        nameTextStyle: { ...nameFont, align: 'left', padding: [0, 0, 0, -40] },
        nameGap: 12
      },
      { type: 'value', name: '电流 A / SOC %', position: 'right',
        splitLine: { show: false },
        axisLabel: axisFont,
        nameTextStyle: { ...nameFont, align: 'right', padding: [0, -40, 0, 0] },
        nameGap: 12
      }
    ],
    series: [
      { name: 'PACK 电压', type: 'line', smooth: true, showSymbol: false, sampling: 'lttb', data: history.value.map(d => d.voltage), lineStyle: { color: '#015eea', width: 2 }, areaStyle: { color: 'rgba(1,94,234,0.1)' } },
      { name: '最高温(℃)', type: 'line', smooth: true, showSymbol: false, sampling: 'lttb', data: history.value.map(d => d.tempMax), lineStyle: { color: '#ef4444', width: 2.4 } },
      { name: '电流(A)',  type: 'line', smooth: true, showSymbol: false, sampling: 'lttb', yAxisIndex: 1, data: history.value.map(d => d.current), lineStyle: { color: '#6366f1', width: 2 } },
      { name: 'SOC(%)',   type: 'line', smooth: true, showSymbol: false, sampling: 'lttb', yAxisIndex: 1, data: history.value.map(d => d.soc), lineStyle: { color: '#22d3a0', width: 2 } },
      { name: '__cursor', type: 'line', data: [], silent: true, markLine: cursorMarkLine() },
      { name: '__events', type: 'line', data: [], silent: true, markPoint: incidentMarkPoint() }
    ]
  }, true)
}

/** 游标移动专用：只更新第 5 条 series 的 markLine，不重建整张图 */
function updateTrendCursor() {
  if (!trendChart) return
  trendChart.setOption({
    series: [
      {}, {}, {}, {},
      { markLine: cursorMarkLine() }
    ]
  })
}

function renderCells() {
  if (!cellChart) return
  const data = cellsAt.value
  cellChart.setOption({
    textStyle: { fontFamily: 'PingFang SC, -apple-system, "Segoe UI", system-ui, sans-serif' },
    animation: false,
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(16,21,46,0.92)', borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (p) => `电芯 #${p[0].dataIndex + 1}<br/>电压 <b>${p[0].value.toFixed(3)} V</b>`
    },
    grid: { left: 46, right: 14, top: 14, bottom: 28 },
    xAxis: {
      type: 'category', data: data.map((_, i) => i + 1),
      axisLabel: { color: '#8a93a8', fontSize: 11, interval: 12, margin: 8 },
      axisLine: { lineStyle: { color: '#dadfeb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value', min: 3.20, max: 3.40,
      splitLine: { lineStyle: { color: '#eef0f7' } },
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    series: [{
      type: 'bar', barWidth: '85%', data,
      itemStyle: {
        color: (p) => p.value < 3.30 ? '#ef4444' : p.value < 3.33 ? '#f59e0b' : p.value > 3.38 ? '#06b6d4' : '#015eea'
      }
    }]
  })
}

function renderHeat() {
  if (!heatChart) return
  const arr = []
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) arr.push([x, y, tempGridAt.value[y * 4 + x]])
  heatChart.setOption({
    textStyle: { fontFamily: 'PingFang SC, -apple-system, "Segoe UI", system-ui, sans-serif' },
    animation: false,
    tooltip: {
      backgroundColor: 'rgba(16,21,46,0.92)', borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (p) => `T${p.value[1]*4+p.value[0]+1}<br/>${p.value[2].toFixed(1)}℃`
    },
    grid: { left: 40, right: 12, top: 14, bottom: 32 },
    xAxis: { type: 'category', data: ['L1','L2','L3','L4'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#525c75', fontSize: 12 } },
    yAxis: { type: 'category', data: ['前','中前','中后','后'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#525c75', fontSize: 12 } },
    visualMap: {
      min: 25, max: 70, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#22d3a0', '#06b6d4', '#015eea', '#f59e0b', '#ef4444'] },
      textStyle: { color: '#525c75', fontSize: 11 }, itemWidth: 10, itemHeight: 80
    },
    series: [{
      type: 'heatmap', data: arr,
      label: { show: true, formatter: (p) => p.value[2].toFixed(1), color: '#fff', fontSize: 12, fontWeight: 600 },
      itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: '#fff' }
    }]
  })
}

function renderAll() { renderTrend(); renderCells(); renderHeat() }

// 游标变化只更新 markLine + 单体 + 温度场（不重建趋势全量）
watch(cursor, () => { renderCells(); renderHeat(); updateTrendCursor() })

function onResize() { trendChart?.resize(); cellChart?.resize(); heatChart?.resize() }

onMounted(() => {
  // 显式提高 DPR，防止高分屏 canvas 字体糊；renderer 锁定 canvas
  const initOpts = {
    renderer: 'canvas',
    devicePixelRatio: Math.max(2, window.devicePixelRatio || 1)
  }
  trendChart = echarts.init(trendEl.value, null, initOpts)
  cellChart  = echarts.init(cellEl.value,  null, initOpts)
  heatChart  = echarts.init(heatEl.value,  null, initOpts)
  renderAll()
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  pause()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKey)
  trendChart?.dispose(); cellChart?.dispose(); heatChart?.dispose()
})

/* ---------- 拖拽进度条 ---------- */
function onSliderInput(v) { cursor.value = Math.round(v) }

/* ---------- KPI 项定义 ---------- */
const kpiItems = [
  { key: 'voltage',      label: 'PACK 电压',  unit: 'V',  color: '#015eea' },
  { key: 'current',      label: 'PACK 电流',  unit: 'A',  color: '#6366f1' },
  { key: 'tempMax',      label: '最高温度',   unit: '℃', color: '#ef4444' },
  { key: 'tempDelta',    label: '温差',       unit: '℃', color: '#f59e0b' },
  { key: 'voltageDelta', label: '压差',       unit: 'mV', color: '#f59e0b' },
  { key: 'insulation',   label: '绝缘电阻',   unit: 'kΩ', color: '#22d3a0' },
  { key: 'soc',          label: 'SOC',        unit: '%',  color: '#22d3a0' }
]
function kpiValue(k) {
  const c = cur.value
  if (k === 'tempDelta') return (c.tempMax - c.tempMin).toFixed(1)
  if (k === 'voltage')   return c.voltage
  if (k === 'soc')       return c.soc
  return c[k]
}
function kpiClass(k) {
  const c = cur.value
  if (k === 'current')      return c.current < 0 ? 'neg' : ''
  if (k === 'tempMax')      return c.tempMax > 45 ? 'err' : c.tempMax > 35 ? 'warn' : ''
  if (k === 'tempDelta')    return (c.tempMax - c.tempMin) > 5 ? 'warn' : ''
  if (k === 'voltageDelta') return c.voltageDelta > 80 ? 'err' : c.voltageDelta > 50 ? 'warn' : ''
  if (k === 'insulation')   return c.insulation < 500 ? 'err' : ''
  if (k === 'soc')          return 'ok'
  return ''
}
</script>

<template>
  <div class="replay">
    <PageHeader
      tag="REPLAY"
      title="历史数据回放"
      desc="选定时间窗口 · 1Hz 全量数据回放 · 多维度同步 · 关键事件标注 · 可作司法采信"
    >
      <template #actions>
        <el-button :icon="MagicStick">载入事故案例</el-button>
        <el-button type="primary" :icon="Download">导出回放数据</el-button>
      </template>
    </PageHeader>

    <!-- 顶部选择条 + 快速跳转 -->
    <div class="bar">
      <el-select v-model="stationId" placeholder="站点" style="width:200px">
        <el-option v-for="s in stations" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select v-model="packLabel" style="width:130px">
        <el-option v-for="n in 16" :key="n" :label="`PACK-${String(n).padStart(2,'0')}`" :value="`PACK-${String(n).padStart(2,'0')}`" />
      </el-select>
      <el-date-picker
        v-model="range"
        type="datetimerange"
        range-separator="→"
        start-placeholder="开始时间"
        end-placeholder="结束时间"
        style="width:380px"
      />
      <div class="quick-jump">
        <span class="qj-l">快速定位</span>
        <el-button-group>
          <el-button size="small" :icon="ArrowLeftBold" @click="jumpBefore5min">事故前 5min</el-button>
          <el-button size="small" type="danger" plain :icon="Aim" @click="jumpAtIncident">事故时刻</el-button>
          <el-button size="small" @click="jumpAfter2min">事故后 2min<el-icon style="margin-left:4px"><ArrowRightBold /></el-icon></el-button>
        </el-button-group>
      </div>
      <div class="bar-tip">
        <el-icon><Clock /></el-icon>
        共 {{ totalSec }} 秒 / {{ history.length }} 数据点 · 1Hz
      </div>
    </div>

    <!-- 当前帧 KPI（每项带 ±30s sparkline） -->
    <div class="cur-card">
      <div class="cur-time">
        <div class="ct-l">回放时刻</div>
        <div class="ct-v">{{ curTime }}</div>
        <div class="ct-pos">{{ cursor + 1 }} / {{ totalSec }}</div>
      </div>
      <div class="cur-divider" />
      <div class="cur-grid">
        <div
          v-for="k in kpiItems" :key="k.key"
          class="cur-item"
        >
          <div class="ci-l">{{ k.label }}</div>
          <div class="ci-v" :class="kpiClass(k.key)">
            {{ kpiValue(k.key) }} <span>{{ k.unit }}</span>
          </div>
          <svg class="ci-spark" :viewBox="`0 0 ${SPARK_W} ${SPARK_H}`" preserveAspectRatio="none">
            <path :d="sparkAreaPath(k.key)" :fill="k.color" fill-opacity="0.08" />
            <path :d="sparkPath(k.key)" :stroke="k.color" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            <circle :cx="sparkDot(k.key).x" :cy="sparkDot(k.key).y" r="1.8" :fill="k.color" stroke="#fff" stroke-width="0.8" />
          </svg>
        </div>
      </div>
    </div>

    <!-- 主体: 趋势(2/3) + 单体(1/3) -->
    <div class="row">
      <div class="card col-2">
        <div class="card-head">
          <div class="ch-title">多通道时序数据 · 含事件标注</div>
          <div class="ch-legend">
            <span><i class="d err" />事故</span>
            <span><i class="d warn" />预警</span>
            <span><i class="d info" />操作</span>
            <span><i class="d ok" />恢复</span>
          </div>
        </div>
        <div class="chart" ref="trendEl" />
      </div>

      <div class="card">
        <div class="card-head">
          <div class="ch-title">104 节单体电压 · {{ curTime }}</div>
        </div>
        <div class="chart h160" ref="cellEl" />
        <div class="ch-title small mt">16 路温度场</div>
        <div class="chart h160" ref="heatEl" />
      </div>
    </div>

    <!-- 控制台 + 时间轴 -->
    <div class="player">
      <div class="player-controls">
        <el-tooltip content="后退 10s ( ← )" placement="top" effect="dark">
          <el-button circle :icon="ArrowLeftBold" @click="rewind(10)" />
        </el-tooltip>
        <el-tooltip :content="playing ? '暂停 ( Space )' : '播放 ( Space )'" placement="top" effect="dark">
          <el-button
            size="large" circle type="primary"
            :icon="playing ? VideoPause : VideoPlay"
            @click="toggle"
          />
        </el-tooltip>
        <el-tooltip content="前进 10s ( → )" placement="top" effect="dark">
          <el-button circle :icon="ArrowRightBold" @click="forward(10)" />
        </el-tooltip>
        <el-tooltip content="回到起点" placement="top" effect="dark">
          <el-button circle :icon="Refresh" @click="cursor = 0; pause()" />
        </el-tooltip>
      </div>
      <div class="player-track">
        <div class="track-info">
          <span class="tk-time">{{ curTime }}</span>
          <span class="tk-meta">{{ cursorPct.toFixed(1) }}% · {{ cursor + 1 }} / {{ totalSec }}</span>
        </div>
        <el-slider
          :model-value="cursor"
          @update:model-value="onSliderInput"
          :min="0" :max="totalSec - 1"
          :show-tooltip="false"
        />
        <div class="track-marks">
          <el-tooltip
            v-for="(e, i) in incidents" :key="i"
            :content="`${e.time} · ${e.label}`"
            placement="bottom"
            effect="dark"
          >
            <div
              class="mark" :class="e.level"
              :style="{ left: (e.idx / (totalSec - 1) * 100) + '%' }"
              @click="jumpTo(e.idx)"
            >
              <div class="mk-dot" />
            </div>
          </el-tooltip>
        </div>
      </div>
      <div class="player-speed">
        <span class="ps-l">倍速 ( +/- )</span>
        <div class="ps-options">
          <button
            v-for="s in speeds" :key="s"
            :class="{ active: speed === s }"
            @click="speed = s"
          >{{ s }}x</button>
        </div>
      </div>
    </div>

    <!-- 事件流 -->
    <div class="card">
      <div class="card-head">
        <div class="ch-title">关键事件序列 · 点击跳转</div>
        <div class="hk-hint">
          <kbd>Space</kbd> 播放 <kbd>←</kbd>/<kbd>→</kbd> ±10s <kbd>+</kbd>/<kbd>-</kbd> 倍速
        </div>
      </div>
      <div class="ev-flow">
        <div
          class="ev" v-for="(e, i) in incidents" :key="i"
          :class="[e.level, { current: cursor >= e.idx && (i === incidents.length - 1 || cursor < incidents[i + 1].idx) }]"
          @click="jumpTo(e.idx)"
        >
          <div class="ev-time">{{ e.time }}</div>
          <div class="ev-label">{{ e.label }}</div>
          <Warning v-if="e.level === 'err'" class="ev-icon" style="color:#ef4444" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.replay { padding-bottom: 24px; }

.bar {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 12px 16px; margin-bottom: 16px; box-shadow: $shadow-card;
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
}
.bar-tip { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: $text-muted; }
.quick-jump {
  display: inline-flex; align-items: center; gap: 8px;
  padding-left: 12px; border-left: 1px dashed $border-soft;
  .qj-l { font-size: 12px; color: $text-muted; }
}

/* === 当前帧 KPI === */
.cur-card {
  background: linear-gradient(135deg, $bg-card 0%, #eff6ff 100%);
  border: 1px solid $border-soft; border-radius: $radius;
  padding: 14px 18px; margin-bottom: 16px; box-shadow: $shadow-card;
  display: flex; gap: 20px; align-items: stretch;
}
.cur-time { padding-right: 20px; flex-shrink: 0; }
.ct-l { font-size: 12px; color: $text-muted; line-height: 1.2; }
.ct-v { font-family: $font-num; font-variant-numeric: tabular-nums; font-size: 36px; font-weight: 600; color: $brand-blue; letter-spacing: -1px; line-height: 1.1; margin-top: 2px; }
.ct-pos { font-family: $font-num; font-size: 12px; color: $text-muted; margin-top: 2px; }
.cur-divider { width: 1px; background: $border-soft; flex-shrink: 0; }
.cur-grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 16px; align-items: stretch; }
.cur-item { display: flex; flex-direction: column; min-width: 0; }
.ci-l { font-size: 12px; color: $text-muted; line-height: 1.2; }
.ci-v {
  font-family: $font-num; font-variant-numeric: tabular-nums;
  font-size: 26px; font-weight: 600; color: $text-primary; margin-top: 2px; line-height: 1.1;
  span { font-size: 12px; color: $text-muted; font-weight: 400; margin-left: 2px; }
  &.neg { color: #015eea; }
  &.warn { color: #f59e0b; }
  &.err { color: #ef4444; }
  &.ok { color: #22d3a0; }
}
.ci-spark {
  display: block; width: 100%; height: 18px;
  margin-top: 6px;
}

/* === Cards === */
.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.col-2 { grid-column: span 2; }
.card {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 16px 18px; box-shadow: $shadow-card;
  margin-bottom: 16px;
}
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ch-title { font-size: 14px; font-weight: 600; &.small { font-size: 12px; color: $text-secondary; } &.mt { margin-top: 8px; } }
.ch-legend { display: flex; gap: 14px; font-size: 11px; color: $text-secondary; }
.ch-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 5px; vertical-align: middle; }
.d.err { background: #ef4444; } .d.warn { background: #f59e0b; } .d.info { background: #015eea; } .d.ok { background: #22d3a0; }

.chart { width: 100%; height: 340px; }
.chart.h160 { height: 160px; }

/* === Player（浅色重构） === */
.player {
  background: linear-gradient(135deg, #ffffff 0%, #eff6ff 60%, #e0ecff 100%);
  border: 1px solid $border-soft;
  border-radius: $radius;
  padding: 16px 22px 20px;
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 24px; align-items: center;
  box-shadow: $shadow-card;
  position: relative; overflow: hidden;
  &::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
    background: $grad-cyan;
  }
}
.player-controls { display: flex; gap: 8px; align-items: center; padding-left: 4px; }
.player-controls :deep(.el-button) {
  background: #fff; border-color: $border-soft; color: $text-primary;
  box-shadow: 0 1px 3px rgba(16,21,46,0.04);
}
.player-controls :deep(.el-button:hover) {
  background: #fff; border-color: $brand-blue; color: $brand-blue;
}
.player-controls :deep(.el-button--primary) {
  background: $grad-cyan; border-color: transparent; color: #fff;
  box-shadow: 0 4px 14px rgba(6,182,212,0.4);
}
.player-controls :deep(.el-button--primary:hover) {
  background: linear-gradient(135deg, #0891b2 0%, #1e40af 100%);
}

.player-track { min-width: 0; padding: 0 4px; }
.track-info { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; font-family: $font-num; }
.tk-time { font-size: 20px; font-weight: 600; color: $brand-blue; letter-spacing: -0.5px; }
.tk-meta { font-size: 12px; color: $text-muted; }
.player-track :deep(.el-slider__runway) { background: rgba(1,94,234,0.1); height: 6px; }
.player-track :deep(.el-slider__bar) { background: $grad-cyan; height: 6px; }
.player-track :deep(.el-slider__button) { background: #fff; border: 2px solid $brand-cyan; width: 16px; height: 16px; box-shadow: 0 2px 8px rgba(6,182,212,0.35); }
.track-marks { position: relative; height: 16px; margin-top: 6px; }
.mark {
  position: absolute; top: 0; transform: translateX(-50%);
  cursor: pointer; padding: 2px;
  &:hover .mk-dot {
    transform: scale(1.5);
    box-shadow: 0 0 0 4px rgba(255,255,255,0.7), 0 2px 6px rgba(0,0,0,0.2);
  }
  &.err .mk-dot { background: #ef4444; }
  &.warn .mk-dot { background: #f59e0b; }
  &.info .mk-dot { background: #015eea; }
  &.ok .mk-dot { background: #22d3a0; }
}
.mk-dot {
  width: 10px; height: 10px; border-radius: 50%;
  box-shadow: 0 0 0 3px #fff, 0 1px 3px rgba(0,0,0,0.15);
  transition: transform 0.2s, box-shadow 0.2s;
}

.player-speed { text-align: right; }
.ps-l { font-size: 11px; color: $text-muted; display: block; margin-bottom: 6px; letter-spacing: 0.3px; }
.ps-options { display: inline-flex; gap: 2px; background: rgba(255,255,255,0.7); padding: 3px; border-radius: 8px; border: 1px solid $border-soft; }
.ps-options button {
  background: transparent; border: none;
  color: $text-secondary; font-size: 12px; padding: 5px 10px;
  border-radius: 5px; cursor: pointer; font-family: $font-num; font-weight: 500;
  transition: all 0.15s;
  &:hover:not(.active) { background: rgba(1,94,234,0.06); color: $brand-blue; }
  &.active { background: $grad-cyan; color: #fff; box-shadow: 0 2px 6px rgba(6,182,212,0.35); }
}

/* === 键盘提示 === */
.hk-hint {
  font-size: 11px; color: $text-muted;
  display: inline-flex; gap: 6px; align-items: center;
  kbd {
    display: inline-block; font-family: $font-num; font-size: 10.5px;
    padding: 1px 6px; border: 1px solid $border-soft; border-bottom-width: 2px;
    border-radius: 4px; background: $bg-soft; color: $text-secondary;
    line-height: 1.4;
  }
}

/* === 事件流 === */
.ev-flow { display: flex; flex-wrap: wrap; gap: 8px; padding: 4px 0; }
.ev {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  background: $bg-soft; border: 1px solid transparent;
  border-radius: 20px; font-size: 12px;
  cursor: pointer; transition: all 0.15s;
  &.current { box-shadow: 0 0 0 2px $brand-cyan; transform: scale(1.04); }
  &.err { color: #ef4444; }
  &.err.current { background: rgba(239,68,68,0.1); border-color: #ef4444; }
  &.warn { color: #f59e0b; }
  &.warn.current { background: rgba(245,158,11,0.1); border-color: #f59e0b; }
  &.info { color: $brand-blue; }
  &.info.current { background: rgba(1,94,234,0.08); border-color: $brand-blue; }
  &.ok { color: #22d3a0; }
  &.ok.current { background: rgba(34,211,160,0.1); border-color: #22d3a0; }
}
.ev-time { font-family: $font-num; font-weight: 600; }
.ev-icon { width: 12px; height: 12px; }

@media (max-width: 1400px) {
  .cur-grid { grid-template-columns: repeat(4, 1fr); }
}
@media (max-width: 1100px) {
  .row { grid-template-columns: 1fr; }
  .col-2 { grid-column: auto; }
  .player { grid-template-columns: 1fr; gap: 14px; }
  .cur-card { flex-wrap: wrap; }
  .hk-hint { display: none; }
}
</style>
