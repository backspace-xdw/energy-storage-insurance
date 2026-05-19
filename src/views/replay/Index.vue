<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as echarts from 'echarts'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import { stations } from '@/mock/data'
import {
  VideoPlay, VideoPause, ArrowLeftBold, ArrowRightBold, Refresh,
  Download, Clock, Warning, MagicStick
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
    // 距事故点的距离（秒），用于构造热失控峰
    const d = i - incidentOffset
    let temp, ins, vDelta
    if (d < -300) {
      temp = 28 + Math.sin(i / 40) * 1.5 + (Math.random() - 0.5) * 0.4
      ins = 4800 + (Math.random() - 0.5) * 100
      vDelta = 22 + (Math.random() - 0.5) * 6
    } else if (d < 0) {
      // 事故前 5 分钟：缓慢爬升
      const k = (d + 300) / 300
      temp = 28 + k * k * 12 + (Math.random() - 0.5) * 0.6
      ins = 4800 - k * k * 3500
      vDelta = 22 + k * k * 28
    } else if (d < 120) {
      // 事故后 2 分钟：峰值
      const k = Math.exp(-d / 30)
      temp = 28 + 36 * k + (Math.random() - 0.5) * 0.8
      ins = 60 + (1 - k) * 4700
      vDelta = 50 + 40 * k
    } else {
      // 恢复
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
  // 转成绝对时间戳的偏移（从 13:50 → 14:31，相对窗口起点）
  const baseTime = dayjs('2026-03-12 14:00')
  return events.map(e => {
    const t = baseTime.add(e.offset, 'second')
    const idx = Math.floor((t - base) / 1000)
    return { ...e, time: t.format('HH:mm:ss'), idx }
  }).filter(e => e.idx >= 0 && e.idx < totalSec.value)
})

/* ---------- 播放控制 ---------- */
const cursor = ref(0)        // 当前游标 (秒)
const playing = ref(false)
const speed = ref(5)         // 倍速 1/2/5/10/30
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

watch(speed, () => { if (playing.value) play() })
watch(range, () => { history.value = genHistory(); cursor.value = 0; pause(); renderAll() })

/* ---------- 当前帧 ---------- */
const cur = computed(() => history.value[cursor.value] || history.value[0])
const cursorPct = computed(() => (cursor.value / (totalSec.value - 1)) * 100)
const curTime = computed(() => cur.value.time)

/* ---------- 单体电压（随事故时刻变化） ---------- */
const cellsAt = computed(() => {
  const c = cur.value
  // 事故附近某些电芯异常偏低
  return Array.from({ length: 104 }, (_, i) => {
    let v = 3.35 + (Math.random() - 0.5) * 0.02
    if (i === 6 && c.voltageDelta > 50) {
      // PACK-07 异常电芯
      v -= c.voltageDelta / 1000
    }
    return v
  })
})

/* ---------- 温度场（4×4 随时刻） ---------- */
const tempGridAt = computed(() => {
  const c = cur.value
  return Array.from({ length: 16 }, (_, i) => {
    let base = c.tempMin + (c.tempMax - c.tempMin) * Math.random()
    if (i === 6 && c.tempMax > 40) base = c.tempMax - 1 + Math.random() * 2 // 中心区域热点
    return +base.toFixed(1)
  })
})

/* ---------- ECharts ---------- */
const trendEl = ref(null)
const cellEl = ref(null)
const heatEl = ref(null)
let trendChart, cellChart, heatChart

function renderTrend() {
  if (!trendChart) return
  const labels = history.value.map(d => d.time)
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 60, top: 36, bottom: 30 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: '#525c75', fontSize: 11, interval: Math.floor(labels.length / 8) },
      axisLine: { lineStyle: { color: '#dadfeb' } }
    },
    yAxis: [
      { type: 'value', name: '电压 V / 温度 ℃', position: 'left',
        splitLine: { lineStyle: { color: '#eef0f7' } },
        axisLabel: { color: '#525c75', fontSize: 11 },
        nameTextStyle: { color: '#8a93a8', fontSize: 11 }
      },
      { type: 'value', name: '电流 A / SOC %', position: 'right',
        splitLine: { show: false },
        axisLabel: { color: '#525c75', fontSize: 11 },
        nameTextStyle: { color: '#8a93a8', fontSize: 11 }
      }
    ],
    series: [
      { name: 'PACK 电压', type: 'line', smooth: true, showSymbol: false, data: history.value.map(d => d.voltage), lineStyle: { color: '#015eea', width: 2 }, areaStyle: { color: 'rgba(1,94,234,0.1)' } },
      { name: '最高温(℃)', type: 'line', smooth: true, showSymbol: false, data: history.value.map(d => d.tempMax), lineStyle: { color: '#ef4444', width: 2.5 } },
      { name: '电流(A)', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: history.value.map(d => d.current), lineStyle: { color: '#6366f1', width: 2 } },
      { name: 'SOC(%)', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: history.value.map(d => d.soc), lineStyle: { color: '#22d3a0', width: 2 } },
      // 游标
      { type: 'line', data: [], markLine: {
        symbol: 'none',
        animation: false,
        data: [{
          xAxis: cursor.value,
          lineStyle: { color: '#06b6d4', width: 2, type: 'solid' },
          label: { show: true, position: 'end', formatter: '当前', color: '#06b6d4', fontSize: 11 }
        }]
      } },
      // 事件标注
      { type: 'line', data: [], markPoint: {
        symbol: 'pin', symbolSize: 30,
        label: { show: false },
        data: incidents.value.map(e => ({
          xAxis: e.idx, yAxis: history.value[e.idx]?.tempMax || 30,
          itemStyle: { color: e.level === 'err' ? '#ef4444' : e.level === 'warn' ? '#f59e0b' : e.level === 'ok' ? '#22d3a0' : '#015eea' },
          name: e.label
        }))
      } }
    ]
  })
}

function renderCells() {
  if (!cellChart) return
  const data = cellsAt.value
  cellChart.setOption({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p) => `电芯 #${p[0].dataIndex + 1}<br/>电压 <b>${p[0].value.toFixed(3)} V</b>`
    },
    grid: { left: 42, right: 14, top: 24, bottom: 24 },
    xAxis: { type: 'category', data: data.map((_, i) => i + 1), axisLabel: { color: '#8a93a8', fontSize: 9, interval: 12 } },
    yAxis: { type: 'value', min: 3.20, max: 3.40, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 10 } },
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
    tooltip: { formatter: (p) => `T${p.value[1]*4+p.value[0]+1}<br/>${p.value[2].toFixed(1)}℃` },
    grid: { left: 36, right: 12, top: 22, bottom: 30 },
    xAxis: { type: 'category', data: ['L1','L2','L3','L4'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 } },
    yAxis: { type: 'category', data: ['前','中前','中后','后'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 } },
    visualMap: {
      min: 25, max: 70, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#22d3a0', '#06b6d4', '#015eea', '#f59e0b', '#ef4444'] },
      textStyle: { color: '#525c75', fontSize: 10 }, itemWidth: 8, itemHeight: 80
    },
    series: [{
      type: 'heatmap', data: arr,
      label: { show: true, formatter: (p) => p.value[2].toFixed(1), color: '#fff', fontSize: 10, fontWeight: 600 },
      itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: '#fff' }
    }]
  })
}

function renderAll() { renderTrend(); renderCells(); renderHeat() }

watch(cursor, () => { renderCells(); renderHeat(); renderTrend() })

function onResize() { trendChart?.resize(); cellChart?.resize(); heatChart?.resize() }

onMounted(() => {
  trendChart = echarts.init(trendEl.value)
  cellChart = echarts.init(cellEl.value)
  heatChart = echarts.init(heatEl.value)
  renderAll()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  pause()
  window.removeEventListener('resize', onResize)
  trendChart?.dispose(); cellChart?.dispose(); heatChart?.dispose()
})

/* ---------- 拖拽进度条 ---------- */
function onSliderInput(v) { cursor.value = Math.round(v) }
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

    <!-- 顶部选择条 -->
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
      <div class="bar-tip">
        <el-icon><Clock /></el-icon>
        共 {{ totalSec }} 秒 / {{ history.length }} 数据点 · 1Hz 采样
      </div>
    </div>

    <!-- 当前帧 KPI -->
    <div class="cur-card">
      <div class="cur-time">
        <div class="ct-l">回放时刻</div>
        <div class="ct-v">{{ curTime }}</div>
        <div class="ct-pos">{{ cursor + 1 }} / {{ totalSec }}</div>
      </div>
      <div class="cur-divider" />
      <div class="cur-grid">
        <div class="cur-item"><div class="ci-l">PACK 电压</div><div class="ci-v">{{ cur.voltage }} <span>V</span></div></div>
        <div class="cur-item"><div class="ci-l">PACK 电流</div><div class="ci-v" :class="{neg:cur.current<0}">{{ cur.current }} <span>A</span></div></div>
        <div class="cur-item"><div class="ci-l">最高温度</div><div class="ci-v" :class="{warn:cur.tempMax>35,err:cur.tempMax>45}">{{ cur.tempMax }} <span>℃</span></div></div>
        <div class="cur-item"><div class="ci-l">温差</div><div class="ci-v" :class="{warn:cur.tempMax-cur.tempMin>5}">{{ (cur.tempMax-cur.tempMin).toFixed(1) }} <span>℃</span></div></div>
        <div class="cur-item"><div class="ci-l">压差</div><div class="ci-v" :class="{warn:cur.voltageDelta>50,err:cur.voltageDelta>80}">{{ cur.voltageDelta }} <span>mV</span></div></div>
        <div class="cur-item"><div class="ci-l">绝缘电阻</div><div class="ci-v" :class="{err:cur.insulation<500}">{{ cur.insulation }} <span>kΩ</span></div></div>
        <div class="cur-item"><div class="ci-l">SOC</div><div class="ci-v" style="color:#22d3a0">{{ cur.soc }} <span>%</span></div></div>
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
        <el-button circle :icon="ArrowLeftBold" @click="rewind(10)" />
        <el-button
          size="large" circle type="primary"
          :icon="playing ? VideoPause : VideoPlay"
          @click="toggle"
        />
        <el-button circle :icon="ArrowRightBold" @click="forward(10)" />
        <el-button circle :icon="Refresh" @click="cursor = 0; pause()" />
      </div>
      <div class="player-track">
        <div class="track-info">
          <span class="tk-time">{{ curTime }}</span>
          <span class="tk-pct">{{ cursorPct.toFixed(1) }}%</span>
        </div>
        <el-slider
          :model-value="cursor"
          @update:model-value="onSliderInput"
          :min="0" :max="totalSec - 1"
          :show-tooltip="false"
          :marks="incidents.reduce((acc, e) => { acc[e.idx] = ''; return acc }, {})"
        />
        <div class="track-marks">
          <div
            v-for="(e, i) in incidents" :key="i"
            class="mark" :class="e.level"
            :style="{ left: (e.idx / (totalSec - 1) * 100) + '%' }"
            @click="jumpTo(e.idx)"
            :title="`${e.time} · ${e.label}`"
          >
            <div class="mk-dot" />
            <div class="mk-label">{{ e.label }}</div>
            <div class="mk-time">{{ e.time }}</div>
          </div>
        </div>
      </div>
      <div class="player-speed">
        <span class="ps-l">倍速</span>
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
        <el-tag size="small" effect="light">{{ incidents.length }} 条</el-tag>
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
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
}
.bar-tip { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: $text-muted; }

/* === 当前帧 KPI === */
.cur-card {
  background: linear-gradient(135deg, $bg-card 0%, #eff6ff 100%);
  border: 1px solid $border-soft; border-radius: $radius;
  padding: 18px 22px; margin-bottom: 16px; box-shadow: $shadow-card;
  display: flex; gap: 24px; align-items: stretch;
}
.cur-time { padding-right: 24px; }
.ct-l { font-size: 12px; color: $text-muted; }
.ct-v { font-family: $font-num; font-variant-numeric: tabular-nums; font-size: 34px; font-weight: 600; color: $brand-blue; letter-spacing: -1px; line-height: 1.1; margin-top: 2px; }
.ct-pos { font-family: $font-num; font-size: 12px; color: $text-muted; margin-top: 4px; }
.cur-divider { width: 1px; background: $border-soft; }
.cur-grid { flex: 1; display: grid; grid-template-columns: repeat(7, 1fr); gap: 18px; align-items: center; }
.cur-item { }
.ci-l { font-size: 12px; color: $text-muted; }
.ci-v {
  font-family: $font-num; font-variant-numeric: tabular-nums;
  font-size: 22px; font-weight: 600; color: $text-primary; margin-top: 4px;
  span { font-size: 12px; color: $text-muted; font-weight: 400; }
  &.neg { color: #015eea; }
  &.warn { color: #f59e0b; }
  &.err { color: #ef4444; }
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

/* === Player === */
.player {
  background: linear-gradient(135deg, $nav-bg 0%, #0a0f24 100%);
  border-radius: $radius;
  padding: 18px 22px;
  margin-bottom: 16px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 22px; align-items: center;
  color: #fff;
}
.player-controls { display: flex; gap: 8px; align-items: center; }
.player-controls :deep(.el-button) { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); color: #fff; }
.player-controls :deep(.el-button:hover) { background: rgba(255,255,255,0.16); }
.player-controls :deep(.el-button--primary) { background: $grad-cyan; border-color: transparent; }

.player-track { min-width: 0; }
.track-info { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-family: $font-num; }
.tk-time { font-size: 16px; font-weight: 600; color: $brand-cyan; }
.tk-pct { font-size: 12px; color: rgba(255,255,255,0.6); }
.player-track :deep(.el-slider__runway) { background: rgba(255,255,255,0.12); height: 6px; }
.player-track :deep(.el-slider__bar) { background: $grad-cyan; height: 6px; }
.player-track :deep(.el-slider__button) { background: $brand-cyan; border-color: #fff; width: 14px; height: 14px; }
.player-track :deep(.el-slider__marks-text) { color: rgba(255,255,255,0.3); font-size: 10px; }
.track-marks { position: relative; height: 32px; margin-top: 6px; }
.mark {
  position: absolute; top: 0; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: pointer; font-size: 9px;
  white-space: nowrap;
  &:hover .mk-label { color: $brand-cyan; }
  &.err .mk-dot { background: #ef4444; }
  &.warn .mk-dot { background: #f59e0b; }
  &.info .mk-dot { background: #015eea; }
  &.ok .mk-dot { background: #22d3a0; }
}
.mk-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 0 3px rgba(255,255,255,0.15); }
.mk-label { color: rgba(255,255,255,0.55); }
.mk-time { color: rgba(255,255,255,0.35); font-family: $font-num; }

.player-speed { text-align: right; }
.ps-l { font-size: 11px; color: rgba(255,255,255,0.55); display: block; margin-bottom: 6px; }
.ps-options { display: flex; gap: 4px; }
.ps-options button {
  background: transparent; border: 1px solid rgba(255,255,255,0.18);
  color: rgba(255,255,255,0.7); font-size: 12px; padding: 5px 12px;
  border-radius: 4px; cursor: pointer; font-family: $font-num;
  &:hover { background: rgba(255,255,255,0.08); }
  &.active { background: $grad-cyan; color: #fff; border-color: transparent; }
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
}
</style>
