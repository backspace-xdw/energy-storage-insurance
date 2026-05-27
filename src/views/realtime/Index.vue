<script setup>
import { onMounted, onBeforeUnmount, ref, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import echarts from '@/utils/echarts'
import PageHeader from '@/components/PageHeader.vue'
import { stations } from '@/mock/data'
import {
  VideoCamera, Refresh, FullScreen, Connection, Loading, Lightning,
  Sunny, Aim, Setting, CircleCheckFilled, Document, Warning, Search
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const router = useRouter()

/* ---------- 选择器 ---------- */
const stationId = ref(stations[0].id)
const cabinNo = ref(1)
const clusterNo = ref(1)
const packNo = ref(7)
const updating = ref(true)
const updateHz = ref(1) // Hz, 1Hz = 1秒/点

const currentStation = computed(() => stations.find(s => s.id === stationId.value) || stations[0])
const fullPath = computed(() => `${currentStation.value.name} / ${cabinNo.value}#舱 / ${clusterNo.value}#簇 / PACK-${String(packNo.value).padStart(2,'0')}`)

/* ---------- 实时 KPI ---------- */
const kpi = reactive({
  soc: 67.3,
  soh: 94.2,
  voltage: 47.32,
  current: -18.4,
  temperatureMax: 32.8,
  temperatureMin: 28.4,
  voltageDelta: 38,    // mV
  insulation: 5820,
  cycleCount: 312,
  power: -8.7
})

/* ---------- 时序数据池（保留 60 秒） ---------- */
const WINDOW = 60
const series = reactive({
  time: [],
  voltage: [],
  current: [],
  temperature: [],
  soc: []
})

// 初始化 60 个空槽
;(function initSeries() {
  const now = Date.now()
  for (let i = WINDOW - 1; i >= 0; i--) {
    series.time.push(dayjs(now - i * 1000).format('HH:mm:ss'))
    series.voltage.push(+(47 + Math.random() * 0.8).toFixed(2))
    series.current.push(+(-18 - Math.random() * 4).toFixed(1))
    series.temperature.push(+(29 + Math.random() * 4).toFixed(1))
    series.soc.push(+(67 + Math.random() * 1).toFixed(1))
  }
})()

/* ---------- 104 节电芯 ---------- */
const cellCount = 104
const cells = reactive(
  Array.from({ length: cellCount }, (_, i) => ({
    id: i + 1,
    voltage: +(3.30 + Math.random() * 0.08).toFixed(3),
    temperature: +(28 + Math.random() * 4).toFixed(1)
  }))
)

/* ---------- 16 路 PACK 温度（4×4） ---------- */
const tempGrid = reactive(
  Array.from({ length: 16 }, () => +(28 + Math.random() * 6).toFixed(1))
)

/* ---------- BMS 报文流 ---------- */
const messages = ref([])
const MSG_TYPES = [
  { id: '0x18FF50E5', name: 'PACK 总电压电流', proto: 'CAN-J1939' },
  { id: '0x18FF51E5', name: '单体电压上下限', proto: 'CAN-J1939' },
  { id: '0x18FF52E5', name: '单体温度上下限', proto: 'CAN-J1939' },
  { id: '0x18FF53E5', name: 'SOC/SOH', proto: 'CAN-J1939' },
  { id: '0x18FF54E5', name: '绝缘电阻', proto: 'CAN-J1939' },
  { id: 'ns=2;i=2008', name: '簇接触器状态', proto: 'OPC UA' },
  { id: 'fire/ev/smoke', name: '烟雾浓度', proto: 'MQTT' },
  { id: 'env/temp/cabin1', name: '舱温湿度', proto: 'MQTT' }
]

function pushMessage() {
  const type = MSG_TYPES[Math.floor(Math.random() * MSG_TYPES.length)]
  const hex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()).join(' ')
  messages.value.unshift({
    time: dayjs().format('HH:mm:ss.SSS'),
    proto: type.proto,
    id: type.id,
    name: type.name,
    data: hex,
    size: 8 + Math.floor(Math.random() * 16)
  })
  if (messages.value.length > 80) messages.value.length = 80
}

// 预填一些
for (let i = 0; i < 14; i++) pushMessage()

/* ---------- 接口状态 ---------- */
const ifaces = reactive([
  { name: 'BMS 电池管理', proto: 'CAN-J1939 → MQTT', latency: 28, last: '0.4s', status: 'ok', updates: 0 },
  { name: '簇控制器',     proto: 'Modbus RTU',      latency: 42, last: '1.1s', status: 'ok', updates: 0 },
  { name: '消防主机',     proto: 'OPC UA',         latency: 64, last: '0.8s', status: 'ok', updates: 0 },
  { name: '环境监测',     proto: 'MQTT',           latency: 38, last: '0.5s', status: 'ok', updates: 0 },
  { name: '视频云',       proto: 'WebRTC + HTTP',  latency: 156, last: '2.3s', status: 'warn', updates: 0 },
  { name: 'EMS 站控',     proto: 'DB-View',        latency: 12, last: '0.2s', status: 'ok', updates: 0 }
])

/* ---------- ECharts 实例 ---------- */
const trendEl = ref(null)
const cellEl = ref(null)
const heatEl = ref(null)
const histEl = ref(null)
let trendChart, cellChart, heatChart, histChart

function initCharts() {
  trendChart = echarts.init(trendEl.value)
  cellChart = echarts.init(cellEl.value)
  heatChart = echarts.init(heatEl.value)
  histChart = echarts.init(histEl.value)
  renderAll()
  // 单体电压条形图点击钻取
  cellChart.on('click', (p) => {
    const sorted = [...cells].sort((a, b) => a.voltage - b.voltage)
    const c = sorted[p.dataIndex]
    if (c) {
      const orig = cells.find(x => x.id === c.id)
      if (orig) { cellDetail.value = orig; cellDrawer.value = true }
    }
  })
}

function renderTrend() {
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 8, textStyle: { fontSize: 12 } },
    grid: { left: 50, right: 56, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: series.time, axisLabel: { color: '#525c75', fontSize: 10, interval: 9 } },
    yAxis: [
      { type: 'value', name: 'V / A / ℃', position: 'left', splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { color: '#8a93a8', fontSize: 11 } },
      { type: 'value', name: 'SOC %', position: 'right', min: 0, max: 100, splitLine: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { color: '#8a93a8', fontSize: 11 } }
    ],
    series: [
      { name: 'PACK 电压(V)', type: 'line', smooth: true, showSymbol: false, data: series.voltage, lineStyle: { color: '#015eea', width: 2 }, itemStyle: { color: '#015eea' }, areaStyle: { color: 'rgba(1,94,234,0.1)' } },
      { name: '电流(A)',     type: 'line', smooth: true, showSymbol: false, data: series.current, lineStyle: { color: '#6366f1', width: 2 }, itemStyle: { color: '#6366f1' } },
      { name: '最高温(℃)',   type: 'line', smooth: true, showSymbol: false, data: series.temperature, lineStyle: { color: '#ef4444', width: 2 }, itemStyle: { color: '#ef4444' } },
      { name: 'SOC(%)',     type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: series.soc, lineStyle: { color: '#22d3a0', width: 2.5 }, itemStyle: { color: '#22d3a0' } }
    ]
  })
}

function renderCells() {
  const sorted = [...cells].sort((a, b) => a.voltage - b.voltage)
  const min = sorted[0].voltage
  const max = sorted[sorted.length - 1].voltage
  cellChart.setOption({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p) => {
        const d = p[0]
        return `电芯 #${d.dataIndex + 1}<br/>电压 <b>${d.value.toFixed(3)} V</b>`
      }
    },
    grid: { left: 44, right: 16, top: 28, bottom: 26 },
    xAxis: {
      type: 'category',
      data: sorted.map(c => c.id),
      axisLabel: { color: '#8a93a8', fontSize: 9, interval: 9 },
      axisLine: { lineStyle: { color: '#dadfeb' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      min: 3.28, max: 3.40,
      splitLine: { lineStyle: { color: '#eef0f7' } },
      axisLabel: { color: '#525c75', fontSize: 10 }
    },
    series: [{
      name: '电芯电压', type: 'bar', data: sorted.map(c => c.voltage),
      barWidth: '85%',
      itemStyle: {
        color: (p) => {
          // 单体偏离度 → 颜色
          const v = p.value
          if (v < 3.31) return '#ef4444'
          if (v < 3.33) return '#f59e0b'
          if (v > 3.38) return '#06b6d4'
          return '#015eea'
        }
      },
      markLine: {
        symbol: 'none', label: { show: false },
        data: [{ type: 'average', name: '均值', lineStyle: { color: '#22d3a0', type: 'dashed', width: 1.5 }, label: { show: true, position: 'end', formatter: '均值', color: '#22d3a0', fontSize: 10 } }]
      }
    }]
  })
}

function renderHeat() {
  const data = []
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      data.push([x, y, tempGrid[y * 4 + x]])
    }
  }
  heatChart.setOption({
    tooltip: {
      formatter: (p) => `温度传感器 T${p.value[1]*4+p.value[0]+1}<br/>当前 <b>${p.value[2].toFixed(1)}℃</b>`
    },
    grid: { left: 44, right: 16, top: 30, bottom: 36 },
    xAxis: { type: 'category', data: ['L1','L2','L3','L4'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 } },
    yAxis: { type: 'category', data: ['前','中前','中后','后'], axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 } },
    visualMap: {
      min: 25, max: 38, calculable: true,
      orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#22d3a0', '#06b6d4', '#015eea', '#f59e0b', '#ef4444'] },
      textStyle: { color: '#525c75', fontSize: 11 },
      itemWidth: 12, itemHeight: 110, text: ['38℃', '25℃']
    },
    series: [{
      type: 'heatmap', data,
      label: { show: true, formatter: (p) => p.value[2].toFixed(1) + '℃', color: '#fff', fontSize: 11, fontWeight: 600 },
      itemStyle: { borderRadius: 8, borderWidth: 2, borderColor: '#fff' }
    }]
  })
}

function renderHist() {
  // 单体电压分布直方图
  const bins = 12
  const min = 3.28, max = 3.40
  const counts = Array(bins).fill(0)
  cells.forEach(c => {
    const idx = Math.min(bins - 1, Math.floor((c.voltage - min) / (max - min) * bins))
    counts[idx]++
  })
  const labels = Array.from({ length: bins }, (_, i) => (min + (i + 0.5) * (max - min) / bins).toFixed(3))
  histChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 16, top: 24, bottom: 30 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#525c75', fontSize: 10 }, axisLine: { lineStyle: { color: '#dadfeb' } } },
    yAxis: { type: 'value', name: '电芯数', nameTextStyle: { color: '#8a93a8', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75' } },
    series: [{
      type: 'bar', data: counts, barWidth: '70%',
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#015eea' }] },
        borderRadius: [4, 4, 0, 0]
      }
    }]
  })
}

function renderAll() { renderTrend(); renderCells(); renderHeat(); renderHist() }

/* ---------- 数据流模拟 ---------- */
let timer = null
function tick() {
  // 推一个新点 + 弹出最早
  const now = Date.now()
  series.time.push(dayjs(now).format('HH:mm:ss'))
  series.time.shift()

  // 电压在 46.8-48.0 范围内布朗运动
  const v = Math.max(46.8, Math.min(48.0, series.voltage[series.voltage.length-1] + (Math.random() - 0.5) * 0.15))
  series.voltage.push(+v.toFixed(2)); series.voltage.shift()

  // 电流跟随充放电波动
  const c = Math.max(-25, Math.min(25, series.current[series.current.length-1] + (Math.random() - 0.5) * 1.2))
  series.current.push(+c.toFixed(1)); series.current.shift()

  // 温度缓慢上升
  const t = Math.max(28, Math.min(36, series.temperature[series.temperature.length-1] + (Math.random() - 0.45) * 0.18))
  series.temperature.push(+t.toFixed(1)); series.temperature.shift()

  // SOC 缓慢变化（基于电流积分）
  const soc = Math.max(0, Math.min(100, series.soc[series.soc.length-1] - c * 0.0015))
  series.soc.push(+soc.toFixed(1)); series.soc.shift()

  // 更新 KPI
  kpi.voltage = v
  kpi.current = c
  kpi.temperatureMax = t
  kpi.temperatureMin = +(t - 2.4 - Math.random() * 1.2).toFixed(1)
  kpi.soc = soc
  kpi.power = +(v * c / 1000).toFixed(2)

  // 单体电压微抖
  cells.forEach(cell => {
    cell.voltage = Math.max(3.28, Math.min(3.40, cell.voltage + (Math.random() - 0.5) * 0.004))
  })
  const vs = cells.map(c => c.voltage)
  kpi.voltageDelta = Math.round((Math.max(...vs) - Math.min(...vs)) * 1000)

  // 温度网格微抖
  for (let i = 0; i < tempGrid.length; i++) {
    tempGrid[i] = +Math.max(26, Math.min(38, tempGrid[i] + (Math.random() - 0.5) * 0.3)).toFixed(1)
  }

  // 报文流：每 tick 推 2-4 条 (msgPaused 时不推)
  if (!msgPaused.value) {
    const n = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < n; i++) pushMessage()
  }

  // 接口 latency 微抖
  ifaces.forEach(f => {
    f.latency = Math.max(8, Math.min(280, f.latency + (Math.random() - 0.5) * 6))
    f.updates++
    f.last = '0.' + Math.floor(Math.random() * 9 + 1) + 's'
  })

  // 重绘
  renderTrend(); renderCells(); renderHeat(); renderHist()
}

function startTimer() {
  stopTimer()
  if (updating.value) {
    timer = setInterval(tick, 1000 / updateHz.value)
  }
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null } }
function toggleUpdate() { updating.value = !updating.value; startTimer() }

watch(updateHz, startTimer)

/* ---------- 生命周期 ---------- */
function onResize() {
  trendChart?.resize(); cellChart?.resize(); heatChart?.resize(); histChart?.resize()
}

onMounted(() => {
  initCharts()
  startTimer()
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  stopTimer()
  window.removeEventListener('resize', onResize)
  trendChart?.dispose(); cellChart?.dispose(); heatChart?.dispose(); histChart?.dispose()
})

/* ---------- helpers ---------- */
const fmt = (n, d = 2) => Number(n).toFixed(d)
const cabinOpts = computed(() => Array.from({ length: currentStation.value.cabins }, (_, i) => i + 1))
const clusterOpts = [1, 2, 3, 4]
const packOpts = Array.from({ length: 16 }, (_, i) => i + 1)

function fullscreen() {
  const el = document.documentElement
  if (!document.fullscreenElement) el.requestFullscreen?.()
  else document.exitFullscreen?.()
}

/* ---------- 报文流详情 + 过滤 + 导出 ---------- */
const msgFilterProto = ref('')
const msgPaused = ref(false)
const msgDetail = ref(null)
const msgDrawer = ref(false)
const filteredMessages = computed(() =>
  messages.value.filter(m => !msgFilterProto.value || m.proto === msgFilterProto.value).slice(0, 14)
)
const protoStats = computed(() => {
  const stats = {}
  messages.value.forEach(m => { stats[m.proto] = (stats[m.proto] || 0) + 1 })
  return stats
})
function openMsgDetail(m) {
  msgDetail.value = m
  msgDrawer.value = true
}
function exportMessages() {
  const header = ['time', 'proto', 'id', 'name', 'data', 'size']
  const csv = [header.join(',')]
  messages.value.forEach(m => {
    csv.push(header.map(f => {
      const v = m[f]; const s = v == null ? '' : String(v).replace(/"/g, '""')
      return /[,"\n]/.test(s) ? `"${s}"` : s
    }).join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `BMS-报文-${dayjs().format('YYYYMMDD-HHmmss')}.csv`; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${messages.value.length} 条报文`)
}

/* ---------- 电芯点击钻取 ---------- */
const cellDetail = ref(null)
const cellDrawer = ref(false)
function openCellDetail(idx) {
  const c = cells[idx]
  if (!c) return
  cellDetail.value = c
  cellDrawer.value = true
}

/* ---------- KPI 阈值告警 ---------- */
const kpiAlerts = computed(() => {
  const list = []
  if (kpi.temperatureMax > 35) list.push({ key: 'temp', level: 'warn', msg: `最高温 ${kpi.temperatureMax.toFixed(1)}℃ 接近告警阈值 38℃` })
  if (kpi.temperatureMax > 38) list.push({ key: 'temp', level: 'err', msg: `最高温 ${kpi.temperatureMax.toFixed(1)}℃ 已超阈值！` })
  if (kpi.voltageDelta > 50) list.push({ key: 'vd', level: 'warn', msg: `单体压差 ${kpi.voltageDelta} mV > 50 mV 阈值` })
  if (kpi.voltageDelta > 80) list.push({ key: 'vd', level: 'err', msg: `单体压差 ${kpi.voltageDelta} mV 严重超阈！` })
  if (kpi.insulation < 500) list.push({ key: 'ins', level: 'err', msg: `绝缘电阻 ${kpi.insulation} kΩ 低于安全线 500 kΩ` })
  return list
})

</script>

<template>
  <div class="realtime">
    <PageHeader
      tag="REALTIME"
      title="实时监控大屏"
      desc="PACK 级秒级数据流 · 单体电芯可视化 · 温度场热力 · 协议报文实时流"
    >
      <template #actions>
        <el-button :icon="FullScreen" @click="fullscreen">全屏</el-button>
        <el-button :icon="Refresh" @click="renderAll">立即刷新</el-button>
        <el-button
          :type="updating ? 'danger' : 'primary'"
          :icon="updating ? Loading : VideoCamera"
          @click="toggleUpdate"
        >
          {{ updating ? '暂停采集' : '开始采集' }}
        </el-button>
      </template>
    </PageHeader>

    <!-- 选择器 -->
    <div class="bar">
      <div class="bar-left">
        <el-select v-model="stationId" placeholder="站点" style="width:200px">
          <el-option v-for="s in stations" :key="s.id" :label="s.name" :value="s.id" />
        </el-select>
        <el-select v-model="cabinNo" style="width:90px">
          <el-option v-for="n in cabinOpts" :key="n" :label="`${n}#舱`" :value="n" />
        </el-select>
        <el-select v-model="clusterNo" style="width:90px">
          <el-option v-for="n in clusterOpts" :key="n" :label="`${n}#簇`" :value="n" />
        </el-select>
        <el-select v-model="packNo" style="width:110px">
          <el-option v-for="n in packOpts" :key="n" :label="`PACK-${String(n).padStart(2,'0')}`" :value="n" />
        </el-select>
        <el-divider direction="vertical" />
        <span class="path">{{ fullPath }}</span>
      </div>
      <div class="bar-right">
        <div class="live">
          <span class="live-dot" :class="{ on: updating }" />
          {{ updating ? '实时采集中' : '已暂停' }}
        </div>
        <el-segmented v-model="updateHz" :options="[{value:1,label:'1Hz'},{value:2,label:'2Hz'},{value:5,label:'5Hz'}]" />
      </div>
    </div>

    <!-- KPI 阈值告警条 -->
    <transition-group name="alert-fade" tag="div" class="kpi-alerts" v-if="kpiAlerts.length">
      <el-alert
        v-for="a in kpiAlerts" :key="a.key + a.level"
        :type="a.level === 'err' ? 'error' : 'warning'"
        :title="a.msg"
        show-icon
        :closable="false"
      >
        <template #default>
          <span>{{ a.msg }}</span>
          <el-button text type="primary" size="small" @click="router.push('/app/rules')" style="margin-left:8px">
            查看规则
          </el-button>
        </template>
      </el-alert>
    </transition-group>

    <!-- KPI -->
    <div class="kpi-grid">
      <div class="kpi-cell kpi-soc">
        <div class="kc-label">SOC 荷电量</div>
        <div class="kc-val">{{ fmt(kpi.soc, 1) }}<span>%</span></div>
        <div class="kc-bar"><div :style="{ width: kpi.soc + '%' }" /></div>
      </div>
      <div class="kpi-cell">
        <div class="kc-label">SOH 健康度</div>
        <div class="kc-val">{{ fmt(kpi.soh, 1) }}<span>%</span></div>
        <div class="kc-sub">循环 {{ kpi.cycleCount }} 次</div>
      </div>
      <div class="kpi-cell">
        <div class="kc-label">PACK 电压</div>
        <div class="kc-val">{{ fmt(kpi.voltage) }}<span>V</span></div>
        <div class="kc-sub">压差 <b :class="{ warn: kpi.voltageDelta > 50 }">{{ kpi.voltageDelta }} mV</b></div>
      </div>
      <div class="kpi-cell">
        <div class="kc-label">PACK 电流</div>
        <div class="kc-val" :class="{ neg: kpi.current < 0 }">{{ fmt(kpi.current, 1) }}<span>A</span></div>
        <div class="kc-sub">{{ kpi.current < 0 ? '放电中' : '充电中' }} · {{ fmt(kpi.power) }} kW</div>
      </div>
      <div class="kpi-cell">
        <div class="kc-label">最高温度</div>
        <div class="kc-val" :class="{ warn: kpi.temperatureMax > 35 }">{{ fmt(kpi.temperatureMax, 1) }}<span>℃</span></div>
        <div class="kc-sub">温差 {{ fmt(kpi.temperatureMax - kpi.temperatureMin, 1) }}℃</div>
      </div>
      <div class="kpi-cell">
        <div class="kc-label">绝缘电阻</div>
        <div class="kc-val">{{ kpi.insulation }}<span>kΩ</span></div>
        <div class="kc-sub ok">正常 (≥500 kΩ)</div>
      </div>
    </div>

    <!-- 行 1: 多通道曲线(2/3) + 报文流(1/3) -->
    <div class="row">
      <div class="card col-2">
        <div class="card-head">
          <div class="ch-title"><el-icon><Lightning /></el-icon> 多通道实时趋势</div>
          <div class="ch-sub">最近 {{ WINDOW }} 秒数据 · 1Hz 采样</div>
        </div>
        <div class="chart" ref="trendEl" />
      </div>
      <div class="card msg">
        <div class="card-head">
          <div class="ch-title"><el-icon><Connection /></el-icon> BMS 报文流</div>
          <div class="msg-tools">
            <el-button
              size="small" text
              :type="msgPaused ? 'primary' : 'danger'"
              @click="msgPaused = !msgPaused"
            >{{ msgPaused ? '继续' : '暂停' }}</el-button>
            <el-button size="small" text type="primary" :icon="Document" @click="exportMessages">导出</el-button>
          </div>
        </div>
        <div class="msg-filter">
          <el-radio-group v-model="msgFilterProto" size="small">
            <el-radio-button value="">全部 {{ messages.length }}</el-radio-button>
            <el-radio-button v-for="(c, p) in protoStats" :key="p" :value="p">{{ p }} {{ c }}</el-radio-button>
          </el-radio-group>
        </div>
        <div class="msg-list">
          <div
            class="msg-item" v-for="(m, i) in filteredMessages" :key="m.time + i"
            :class="{ fresh: i === 0 }"
            @click="openMsgDetail(m)"
          >
            <div class="mi-row">
              <span class="mi-time">{{ m.time }}</span>
              <span class="mi-proto" :class="m.proto.toLowerCase().replace(/[^a-z]/g,'')">{{ m.proto }}</span>
              <span class="mi-id">{{ m.id }}</span>
              <span class="mi-name">{{ m.name }}</span>
            </div>
            <div class="mi-data">{{ m.data }}</div>
          </div>
          <div v-if="!filteredMessages.length" class="msg-empty">无该协议报文</div>
        </div>
      </div>
    </div>

    <!-- 行 2: 单体电压 104(2/3) + 温度热力 16(1/3) -->
    <div class="row">
      <div class="card col-2">
        <div class="card-head">
          <div class="ch-title"><el-icon><Aim /></el-icon> 104 节电芯电压（已排序）</div>
          <div class="ch-legend">
            <span class="lg-dot" style="background:#ef4444" />偏低
            <span class="lg-dot" style="background:#f59e0b" />预警
            <span class="lg-dot" style="background:#015eea" />正常
            <span class="lg-dot" style="background:#06b6d4" />偏高
          </div>
        </div>
        <div class="chart h220" ref="cellEl" />
      </div>
      <div class="card">
        <div class="card-head">
          <div class="ch-title"><el-icon><Sunny /></el-icon> 16 路 PACK 温度场 (4×4)</div>
          <div class="ch-sub">单位 ℃</div>
        </div>
        <div class="chart h220" ref="heatEl" />
      </div>
    </div>

    <!-- 报文详情 drawer -->
    <el-drawer v-model="msgDrawer" :title="`报文详情 - ${msgDetail?.id || ''}`" size="460" direction="rtl">
      <template v-if="msgDetail">
        <div class="md-grid">
          <div><div class="md-l">时间</div><div class="md-v mono">{{ msgDetail.time }}</div></div>
          <div><div class="md-l">协议</div><el-tag size="small" effect="plain">{{ msgDetail.proto }}</el-tag></div>
          <div><div class="md-l">报文 ID</div><div class="md-v mono">{{ msgDetail.id }}</div></div>
          <div><div class="md-l">报文名称</div><div class="md-v">{{ msgDetail.name }}</div></div>
          <div><div class="md-l">长度</div><div class="md-v">{{ msgDetail.size }} 字节</div></div>
        </div>
        <div class="md-section">
          <div class="md-l">原始数据 (HEX)</div>
          <pre class="md-payload">{{ msgDetail.data }}</pre>
        </div>
        <div class="md-section">
          <div class="md-l">字段解析（示例）</div>
          <table class="md-fields">
            <tr><th>字节</th><th>字段</th><th>值</th></tr>
            <tr><td>0-1</td><td>电压</td><td>{{ kpi.voltage }} V</td></tr>
            <tr><td>2-3</td><td>电流</td><td>{{ kpi.current }} A</td></tr>
            <tr><td>4</td><td>SOC</td><td>{{ kpi.soc.toFixed(0) }} %</td></tr>
            <tr><td>5</td><td>最高温</td><td>{{ kpi.temperatureMax.toFixed(1) }} ℃</td></tr>
            <tr><td>6-7</td><td>状态字</td><td><code class="mono">0x{{ msgDetail.data.split(' ').slice(6, 8).join('') }}</code></td></tr>
          </table>
        </div>
      </template>
    </el-drawer>

    <!-- 电芯详情 drawer -->
    <el-drawer v-model="cellDrawer" :title="`电芯 #${cellDetail?.id || ''} 详情`" size="400" direction="rtl">
      <template v-if="cellDetail">
        <div class="cd-num">
          <span>{{ cellDetail.voltage.toFixed(3) }}</span><small>V</small>
        </div>
        <div class="cd-grid">
          <div><div class="md-l">温度</div><div class="md-v">{{ cellDetail.temperature.toFixed(1) }} ℃</div></div>
          <div><div class="md-l">偏离均值</div><div class="md-v">{{ ((cellDetail.voltage - cells.reduce((s,c)=>s+c.voltage,0)/cells.length) * 1000).toFixed(0) }} mV</div></div>
          <div><div class="md-l">所在 PACK</div><div class="md-v">PACK-{{ String(packNo).padStart(2,'0') }}</div></div>
          <div><div class="md-l">所在位置</div><div class="md-v">{{ Math.floor((cellDetail.id - 1) / 26) + 1 }} 排 {{ ((cellDetail.id - 1) % 26) + 1 }} 节</div></div>
          <div><div class="md-l">健康度</div><div class="md-v">{{ (97 + Math.random() * 2).toFixed(1) }} %</div></div>
          <div><div class="md-l">累计循环</div><div class="md-v">{{ kpi.cycleCount }} 次</div></div>
        </div>
        <el-alert
          v-if="cellDetail.voltage < 3.31"
          type="warning"
          title="该单体电压偏低，建议关注一致性"
          show-icon :closable="false"
          style="margin-top:14px"
        />
      </template>
    </el-drawer>

    <!-- 行 3: 单体分布直方图 + 接口接入状态 -->
    <div class="row">
      <div class="card">
        <div class="card-head">
          <div class="ch-title"><el-icon><Setting /></el-icon> 单体电压分布</div>
          <div class="ch-sub">12 个区间</div>
        </div>
        <div class="chart h200" ref="histEl" />
      </div>
      <div class="card col-2">
        <div class="card-head">
          <div class="ch-title"><el-icon><Connection /></el-icon> 接口接入状态</div>
          <el-tag size="small" effect="light" type="success">{{ ifaces.filter(f=>f.status==='ok').length }} / {{ ifaces.length }} 在线</el-tag>
        </div>
        <table class="ifaces">
          <thead>
            <tr><th>接口</th><th>协议</th><th>延迟</th><th>最近更新</th><th>累计帧</th><th>状态</th></tr>
          </thead>
          <tbody>
            <tr v-for="f in ifaces" :key="f.name">
              <td><strong>{{ f.name }}</strong></td>
              <td><span class="tag-proto">{{ f.proto }}</span></td>
              <td><span :style="{ color: f.latency > 200 ? '#f59e0b' : f.latency > 100 ? '#015eea' : '#22d3a0' }">{{ Math.round(f.latency) }} ms</span></td>
              <td>{{ f.last }}</td>
              <td class="num">{{ f.updates }}</td>
              <td>
                <span class="status" :class="f.status">
                  <el-icon><CircleCheckFilled /></el-icon>
                  {{ f.status === 'ok' ? '正常' : '延迟高' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.realtime { padding-bottom: 24px; }

/* === Bar === */
.bar {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 12px 16px; margin-bottom: 16px; box-shadow: $shadow-card;
  display: flex; justify-content: space-between; align-items: center; gap: 16px;
  flex-wrap: wrap;
}
.bar-left { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.bar-right { display: flex; gap: 16px; align-items: center; }
.path { font-size: 13px; color: $text-secondary; }

.live { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: $text-secondary; }
.live-dot {
  width: 8px; height: 8px; border-radius: 50%; background: #ccc;
  &.on {
    background: #22d3a0;
    animation: pulseLive 1.4s infinite;
  }
}
@keyframes pulseLive {
  0% { box-shadow: 0 0 0 0 rgba(34,211,160,0.6); }
  100% { box-shadow: 0 0 0 8px rgba(34,211,160,0); }
}

/* === KPI === */
.kpi-grid {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 16px;
}
.kpi-cell {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 14px 16px;
  box-shadow: $shadow-card;
  position: relative; overflow: hidden;
  &::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: $grad-cyan; opacity: 0.7; }
}
.kpi-soc { background: linear-gradient(135deg, #fff 0%, #f0fdf9 100%); }
.kpi-soc::after { background: linear-gradient(90deg, #22d3a0, #06b6d4); opacity: 1; }
.kc-label { font-size: 13px; color: $text-muted; line-height: 1.2; }
.kc-val {
  font-family: $font-num; font-variant-numeric: tabular-nums lining-nums;
  font-size: 34px; font-weight: 600; color: $text-primary;
  margin-top: 2px; line-height: 1.1;
  letter-spacing: -0.5px;
  span { font-size: 13px; color: $text-muted; font-weight: 400; margin-left: 4px; }
  &.warn { color: #ef4444; }
  &.neg { color: #015eea; }
}
.kc-sub { font-size: 12px; color: $text-muted; margin-top: 4px; line-height: 1.2; }
.kc-sub b { color: $text-primary; }
.kc-sub b.warn { color: #ef4444; }
.kc-sub.ok { color: #22d3a0; }
.kc-bar { margin-top: 6px; height: 4px; background: rgba(34,211,160,0.15); border-radius: 2px; overflow: hidden; }
.kc-bar > div { height: 100%; background: linear-gradient(90deg, #22d3a0, #06b6d4); transition: width 0.4s; }

/* === Cards === */
.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.col-2 { grid-column: span 2; }
.card {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 16px 18px; box-shadow: $shadow-card;
  display: flex; flex-direction: column;
}
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ch-title { font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; color: $text-primary; }
.ch-title .el-icon { color: $brand-blue; }
.ch-sub { font-size: 12px; color: $text-muted; }
.ch-legend { font-size: 11px; color: $text-muted; display: flex; gap: 12px; align-items: center; }
.lg-dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 4px; vertical-align: middle; }

.chart { width: 100%; height: 260px; }
.chart.h220 { height: 220px; }
.chart.h200 { height: 200px; }

/* === 报文流 === */
.msg-list {
  flex: 1; min-height: 0;
  display: flex; flex-direction: column; gap: 4px;
  font-family: $font-num;
  overflow-y: auto;
  max-height: 260px;
  margin: 0 -4px; padding: 0 4px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-thumb { background: rgba(0,0,0,.12); border-radius: 2px; }
}
.msg-item {
  display: flex; flex-direction: column; gap: 2px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.35;
  border-radius: 6px;
  border-left: 2px solid transparent;
  transition: background 0.3s;
  &.fresh { background: rgba(6,182,212,0.1); animation: msgFlash 1s ease; border-left-color: #06b6d4; }
}
@keyframes msgFlash { 0% { background: rgba(34,211,160,0.25); } 100% { background: rgba(6,182,212,0.1); } }
.mi-row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; min-width: 0; }
.mi-time { color: $text-muted; font-size: 11.5px; flex-shrink: 0; }
.mi-proto { font-weight: 600; font-size: 10.5px; padding: 1px 6px; border-radius: 3px; text-align: center; flex-shrink: 0;
  &.canj1939 { background: rgba(1,94,234,0.12); color: #015eea; }
  &.opcua { background: rgba(99,102,241,0.12); color: #6366f1; }
  &.mqtt { background: rgba(6,182,212,0.12); color: #0891b2; }
}
.mi-id { color: $brand-blue; font-weight: 500; font-size: 11.5px; flex-shrink: 0; }
.mi-name { color: $text-secondary; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
.mi-data { color: $text-muted; font-size: 11px; letter-spacing: 0.5px; padding-left: 0; }

/* === Iface table === */
.ifaces { width: 100%; border-collapse: collapse; font-size: 13px; }
.ifaces th, .ifaces td { padding: 8px 12px; border-bottom: 1px solid $border-soft; text-align: left; }
.ifaces th { color: $text-muted; font-weight: 500; font-size: 12px; background: $bg-soft; }
.ifaces tr:last-child td { border-bottom: none; }
.ifaces tr:hover td { background: $bg-soft; }
.ifaces td.num { font-family: $font-num; color: $brand-blue; font-weight: 500; }
.tag-proto { font-size: 11px; padding: 2px 8px; background: $bg-soft; border-radius: 4px; color: $text-secondary; }
.status { display: inline-flex; align-items: center; gap: 4px; font-size: 13px;
  &.ok { color: #22d3a0; }
  &.warn { color: #f59e0b; }
}

/* === KPI 阈值告警条 === */
.kpi-alerts { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; }
.alert-fade-enter-active, .alert-fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.alert-fade-enter-from, .alert-fade-leave-to { opacity: 0; transform: translateY(-6px); }

/* === 报文流过滤/操作 === */
.msg-tools { display: flex; gap: 4px; }
.msg-filter { padding: 0 4px 10px; overflow-x: auto;
  :deep(.el-radio-group) { white-space: nowrap; }
}
.msg-item { cursor: pointer; }
.msg-empty { padding: 24px; text-align: center; color: #8a93a8; font-size: 12px; }

/* === 报文详情 drawer === */
.md-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e7eaf3; }
.md-l { font-size: 11px; color: #8a93a8; }
.md-v { font-size: 13px; font-weight: 500; margin-top: 2px; }
.mono { font-family: monospace; }
.md-section { margin-bottom: 18px; }
.md-payload { background: #10152e; color: #b3c5ff;
  padding: 10px 14px; border-radius: 6px;
  font-family: 'JetBrains Mono', Menlo, monospace; font-size: 12px; line-height: 1.7;
  margin: 6px 0 0; overflow-x: auto;
}
.md-fields { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px;
  th, td { padding: 6px 10px; border-bottom: 1px solid #eef0f7; text-align: left; }
  th { color: #8a93a8; font-weight: 500; background: #f5f7fb; }
}

/* === 电芯详情 drawer === */
.cd-num { text-align: center; padding: 24px 0; border-bottom: 1px solid #e7eaf3;
  span { font-size: 48px; font-weight: 600; color: #015eea; font-family: tabular-nums; }
  small { font-size: 16px; color: #8a93a8; margin-left: 6px; }
}
.cd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 18px; margin-top: 16px; }

@media (max-width: 1400px) {
  .kpi-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1100px) {
  .row { grid-template-columns: 1fr; }
  .col-2 { grid-column: auto; }
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
