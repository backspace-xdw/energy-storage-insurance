<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import echarts from '@/utils/echarts'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import { stations } from '@/mock/data'
import {
  Link, Connection, Refresh, Download, Search,
  CircleCheckFilled, Warning, CloseBold, Clock,
  VideoPause, VideoPlay
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

/* ===== 接口与协议配置 ===== */
const PROTOCOLS = [
  { key: 'CAN-J1939', color: '#015eea' },
  { key: 'OPC UA',    color: '#6366f1' },
  { key: 'MQTT',      color: '#06b6d4' },
  { key: 'Modbus',    color: '#22d3a0' },
  { key: 'HTTP/API',  color: '#f59e0b' },
  { key: 'DB-View',   color: '#8b5cf6' }
]

const INTERFACE_TYPES = [
  { name: 'BMS 电池管理',  proto: 'CAN-J1939', port: 'mqtt://bms.{sid}.local:1883', tagsPerStation: 1280, freq: 1 },
  { name: '簇控制器',     proto: 'Modbus',    port: 'modbus://cluster.{sid}:502',    tagsPerStation: 240,  freq: 0.5 },
  { name: '消防主机',     proto: 'OPC UA',    port: 'opc.tcp://fire.{sid}:4840',     tagsPerStation: 96,   freq: 0.5 },
  { name: '环境监测',     proto: 'MQTT',      port: 'mqtt://env.{sid}.iot:1883',     tagsPerStation: 32,   freq: 1 },
  { name: '视频云',       proto: 'HTTP/API',  port: 'https://video.{sid}.cloud/api', tagsPerStation: 16,   freq: 0.2 },
  { name: 'EMS 站控',     proto: 'DB-View',   port: 'mysql://ems-{sid}:3306',        tagsPerStation: 380,  freq: 0.5 }
]

function genInterfaces() {
  const list = []
  stations.forEach((s) => {
    INTERFACE_TYPES.forEach((it, idx) => {
      const baseLatency = { 'CAN-J1939': 28, 'Modbus': 42, 'OPC UA': 64, 'MQTT': 38, 'HTTP/API': 156, 'DB-View': 12 }[it.proto] + Math.floor(Math.random() * 20)
      // 偶发故障/降级
      const fault = Math.random()
      let status = 'ok'
      if (fault < 0.04) status = 'down'
      else if (fault < 0.12) status = 'warn'
      list.push({
        id: `${s.id}-IF${idx}`,
        sid: s.id,
        station: s.name,
        name: it.name,
        proto: it.proto,
        port: it.port.replace('{sid}', s.id.toLowerCase()),
        freq: it.freq,
        tags: it.tagsPerStation,
        latency: baseLatency + (status === 'warn' ? 150 : 0),
        last: status === 'down' ? dayjs().subtract(8 + Math.floor(Math.random() * 60), 'minute').format('HH:mm:ss') : dayjs().subtract(Math.floor(Math.random() * 3), 'second').format('HH:mm:ss'),
        framesPerSec: status === 'down' ? 0 : Math.floor(it.freq * it.tagsPerStation * 0.85 * (status === 'warn' ? 0.5 : 1)),
        totalFrames24h: status === 'down' ? Math.floor(it.freq * it.tagsPerStation * 60 * 60 * Math.random() * 18) : Math.floor(it.freq * it.tagsPerStation * 60 * 60 * 22),
        lossRate: status === 'down' ? 100 : status === 'warn' ? +(Math.random() * 4).toFixed(2) : +(Math.random() * 0.6).toFixed(2),
        status
      })
    })
  })
  return list
}

const interfaces = ref(genInterfaces())

/* ===== 过滤 ===== */
const filterStation = ref('')
const filterProto = ref('')
const filterStatus = ref('')
const search = ref('')

const filtered = computed(() =>
  interfaces.value.filter(i =>
    (!filterStation.value || i.sid === filterStation.value) &&
    (!filterProto.value || i.proto === filterProto.value) &&
    (!filterStatus.value || i.status === filterStatus.value) &&
    (!search.value || i.station.includes(search.value) || i.name.includes(search.value) || i.port.includes(search.value))
  )
)
const hasFilter = computed(() => !!(filterStation.value || filterProto.value || filterStatus.value || search.value))
function clearFilters() {
  filterStation.value = ''
  filterProto.value = ''
  filterStatus.value = ''
  search.value = ''
}
function rowClass({ row }) {
  if (row.status === 'down') return 'row-down'
  if (row.lossRate > 2) return 'row-warn'
  return ''
}

const tableEl = ref(null)
function scrollToTable() {
  nextTick(() => {
    tableEl.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}
function applyProtoFilter(proto) {
  filterProto.value = filterProto.value === proto ? '' : proto
  scrollToTable()
}
function applyHeatFilter(station, ifaceName) {
  filterStation.value = station.id
  search.value = ifaceName
  filterProto.value = ''
  filterStatus.value = ''
  scrollToTable()
}

/* ===== KPI ===== */
const kpi = computed(() => {
  const all = interfaces.value
  return {
    stationCount: stations.length,
    ifaceTotal: all.length,
    ifaceOnline: all.filter(i => i.status === 'ok').length,
    ifaceWarn: all.filter(i => i.status === 'warn').length,
    ifaceDown: all.filter(i => i.status === 'down').length,
    tagsTotal: all.reduce((a, b) => a + b.tags, 0),
    framesPerSec: all.reduce((a, b) => a + b.framesPerSec, 0),
    totalFrames24h: all.reduce((a, b) => a + b.totalFrames24h, 0),
    avgLatency: Math.round(all.reduce((a, b) => a + b.latency, 0) / all.length),
    healthRate: +(all.filter(i => i.status === 'ok').length / all.length * 100).toFixed(1)
  }
})

/* ===== 流量趋势（24h 累计帧/分钟） ===== */
const flowEl = ref(null)
const protoEl = ref(null)
const heatEl = ref(null)
let flowChart, protoChart, heatChart

function genFlowSeries() {
  // 24 小时 × 12 个 5 分钟点 = 288 点
  const points = 288
  const labels = []
  const now = dayjs()
  for (let i = 0; i < points; i++) {
    labels.push(now.subtract((points - i) * 5, 'minute').format('HH:mm'))
  }
  // 多协议堆叠
  const byProto = {}
  PROTOCOLS.forEach(p => {
    byProto[p.key] = Array.from({ length: points }, (_, i) => {
      // 模拟日周期：早晚高峰
      const t = i / points * 24
      const base = 100 + 60 * Math.sin((t - 6) / 24 * Math.PI * 2)
      const proto = interfaces.value.filter(x => x.proto === p.key).reduce((a, b) => a + b.framesPerSec, 0)
      return Math.max(0, Math.floor(base * proto / 1500 + (Math.random() - 0.5) * proto / 30))
    })
  })
  return { labels, byProto }
}

function renderFlow() {
  const { labels, byProto } = genFlowSeries()
  flowChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, right: 0, textStyle: { fontSize: 12 } },
    grid: { left: 50, right: 24, top: 36, bottom: 28 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: '#525c75', fontSize: 11, interval: Math.floor(labels.length / 8) },
      axisLine: { lineStyle: { color: '#dadfeb' } }
    },
    yAxis: {
      type: 'value', name: '帧/秒', nameTextStyle: { color: '#8a93a8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#eef0f7' } },
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    series: PROTOCOLS.map(p => ({
      name: p.key, type: 'line', stack: 'a', smooth: true, showSymbol: false,
      data: byProto[p.key],
      lineStyle: { color: p.color, width: 0 },
      areaStyle: { color: p.color, opacity: 0.78 },
      emphasis: { focus: 'series' }
    }))
  })
}

function renderProto() {
  const data = PROTOCOLS.map(p => ({
    name: p.key,
    value: interfaces.value.filter(i => i.proto === p.key).reduce((a, b) => a + b.framesPerSec, 0),
    itemStyle: { color: p.color }
  }))
  protoChart.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p) => `${p.name}<br/>${p.marker} ${p.value.toLocaleString()} 帧/秒 (${p.percent}%)`
    },
    legend: { type: 'scroll', bottom: 0, icon: 'circle', textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['52%', '76%'], center: ['50%', '46%'],
      avoidLabelOverlap: false,
      label: { show: false }, labelLine: { show: false },
      data
    }]
  })
}

function bindProtoClick() {
  protoChart.off('click')
  protoChart.on('click', (p) => {
    if (p.name) applyProtoFilter(p.name)
  })
}

function bindHeatClick() {
  heatChart.off('click')
  heatChart.on('click', (p) => {
    const iface = p.value?.[4]
    const station = iface && stations.find(s => s.id === iface.sid)
    if (iface && station) applyHeatFilter(station, iface.name)
  })
}

function renderHeat() {
  // 站点 × 接口 × 状态颜色（24x6）
  const data = []
  stations.forEach((s, y) => {
    INTERFACE_TYPES.forEach((it, x) => {
      const iface = interfaces.value.find(i => i.sid === s.id && i.name === it.name)
      const val = !iface ? 0 : iface.status === 'down' ? 0 : iface.status === 'warn' ? 50 : 100 - iface.lossRate
      data.push([x, y, +val.toFixed(1), iface?.status, iface])
    })
  })
  heatChart.setOption({
    tooltip: {
      formatter: (p) => {
        const iface = p.value[4]
        if (!iface) return ''
        return `<b>${iface.station}</b><br/>${iface.name} (${iface.proto})<br/>状态: ${iface.status === 'ok' ? '✓ 正常' : iface.status === 'warn' ? '⚠ 延迟高' : '✗ 离线'}<br/>健康度: ${p.value[2]}%`
      }
    },
    grid: { left: 130, right: 20, top: 32, bottom: 36 },
    xAxis: {
      type: 'category',
      data: INTERFACE_TYPES.map(it => it.name),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    yAxis: {
      type: 'category',
      data: stations.map(s => s.name.length > 8 ? s.name.slice(0, 7) + '…' : s.name),
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    visualMap: {
      min: 0, max: 100,
      calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#ef4444', '#f59e0b', '#06b6d4', '#22d3a0'] },
      textStyle: { color: '#525c75', fontSize: 11 },
      itemWidth: 12, itemHeight: 110, text: ['100', '0']
    },
    series: [{
      type: 'heatmap', data,
      label: {
        show: true, color: '#fff', fontSize: 10, fontWeight: 600,
        formatter: (p) => p.value[3] === 'down' ? '✗' : p.value[3] === 'warn' ? '⚠' : '✓'
      },
      itemStyle: { borderRadius: 6, borderWidth: 2, borderColor: '#fff' }
    }]
  })
}

/* ===== 异常事件 ===== */
const events = ref([
  { time: dayjs().subtract(4, 'minute').format('HH:mm:ss'), level: 'err',  station: '昆山光储一体站', name: '视频云', proto: 'HTTP/API',  msg: '上游 HTTPS 端点 504，重试 3 次失败', status: '处置中' },
  { time: dayjs().subtract(12, 'minute').format('HH:mm:ss'), level: 'warn', station: '常熟新材料园储能站', name: '环境监测', proto: 'MQTT',  msg: 'MQTT 心跳延迟 320ms，超过阈值 200ms', status: '观察' },
  { time: dayjs().subtract(28, 'minute').format('HH:mm:ss'), level: 'err',  station: '徐州矿区储能调峰站', name: 'BMS 电池管理', proto: 'CAN-J1939', msg: 'CAN 网关 RX 队列溢出，丢帧 1.8%', status: '已恢复' },
  { time: dayjs().subtract(1, 'hour').format('HH:mm:ss'), level: 'info',    station: '苏州工业园储能电站', name: '消防主机', proto: 'OPC UA', msg: '订阅会话超时自动重连成功', status: '已恢复' },
  { time: dayjs().subtract(2, 'hour').format('HH:mm:ss'), level: 'warn',    station: '南通滨海风储一体站', name: '簇控制器', proto: 'Modbus', msg: '寄存器 40021 读取超时 5 次', status: '已恢复' },
  { time: dayjs().subtract(3, 'hour').format('HH:mm:ss'), level: 'info',    station: '无锡惠山工商储项目', name: 'EMS 站控', proto: 'DB-View', msg: '副本库 binlog 延迟 4s，已自动切主', status: '已恢复' }
])

/* ===== 数据点位健康度 ===== */
const tagsHealth = computed(() => {
  const total = kpi.value.tagsTotal
  return {
    healthy: Math.round(total * 0.978),
    degraded: Math.round(total * 0.018),
    failed: Math.round(total * 0.004),
    total
  }
})

/* ===== 模拟实时刷新 ===== */
let timer = null
const live = ref(true)
function tick() {
  if (!live.value) return
  interfaces.value.forEach(i => {
    if (i.status !== 'down') {
      i.latency = Math.max(8, i.latency + (Math.random() - 0.5) * 6)
      i.framesPerSec = Math.max(0, Math.floor(i.framesPerSec + (Math.random() - 0.5) * 4))
      i.last = dayjs().subtract(Math.floor(Math.random() * 3), 'second').format('HH:mm:ss')
    }
  })
  // 详情抽屉打开时同步迷你图
  if (drawerVisible.value && drawerIface.value) {
    const cur = interfaces.value.find(i => i.id === drawerIface.value.id)
    if (cur) {
      drawerIface.value = cur
      pushDrawerPoint(cur.framesPerSec)
    }
  }
}
function startTimer() { stopTimer(); timer = setInterval(tick, 1500) }
function stopTimer() { if (timer) { clearInterval(timer); timer = null } }
function toggleLive() {
  live.value = !live.value
  ElMessage.success(live.value ? '已恢复实时采集' : '已暂停实时采集')
}

/* ===== 详情抽屉 ===== */
const drawerVisible = ref(false)
const drawerIface = ref(null)
const drawerHistory = ref([])     // 最近 60 个 framesPerSec 点
const drawerEl = ref(null)
let drawerChart = null
const PAYLOAD_SAMPLES = {
  'CAN-J1939': '{"id":"0CF00400","data":"FF FF 8A 7E 00 00 FF FF","sa":0,"pgn":61444}',
  'Modbus':    '{"slave":1,"fn":3,"addr":40021,"qty":8,"resp":[16384,2031,...]}',
  'OPC UA':    '{"node":"ns=2;s=Fire.Detector.07","val":0,"q":192,"src":"2026-05-19T14:23:18Z"}',
  'MQTT':      '{"topic":"env/cabin1/h2","payload":{"ppm":12.4,"ts":1716181398}}',
  'HTTP/API':  '{"camId":"C-031","streamUrl":"rtsp://...","status":"online","bitrate":"2.4Mbps"}',
  'DB-View':   "SELECT pcs_id, p_act, q_act, soc FROM v_pcs_realtime WHERE station='LFWLW';"
}
function openDetail(row) {
  drawerIface.value = row
  drawerHistory.value = Array.from({ length: 60 }, () =>
    Math.max(0, Math.floor(row.framesPerSec * (0.9 + Math.random() * 0.2)))
  )
  drawerVisible.value = true
  nextTick(() => {
    if (drawerEl.value) {
      drawerChart?.dispose()
      drawerChart = echarts.init(drawerEl.value)
      renderDrawerChart()
    }
  })
}
function pushDrawerPoint(v) {
  drawerHistory.value.push(v)
  if (drawerHistory.value.length > 60) drawerHistory.value.shift()
  renderDrawerChart()
}
function renderDrawerChart() {
  if (!drawerChart) return
  drawerChart.setOption({
    grid: { left: 36, right: 12, top: 16, bottom: 24 },
    xAxis: { type: 'category', data: drawerHistory.value.map((_, i) => `-${60 - i}s`), axisLabel: { interval: 14, color: '#8a93a8', fontSize: 10 }, axisLine: { lineStyle: { color: '#dadfeb' } } },
    yAxis: { type: 'value', name: '帧/s', nameTextStyle: { color: '#8a93a8', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 10 } },
    series: [{
      type: 'line', smooth: true, showSymbol: false,
      data: drawerHistory.value,
      lineStyle: { color: '#015eea', width: 2 },
      areaStyle: { color: 'rgba(1,94,234,0.12)' }
    }]
  })
}
function closeDrawer() {
  drawerVisible.value = false
  drawerChart?.dispose(); drawerChart = null
}

/* ===== 测试连接 ===== */
const testingId = ref(null)
async function testConnect(row) {
  testingId.value = row.id
  ElMessage.info(`正在测试 ${row.station} / ${row.name} ...`)
  const start = Date.now()
  await new Promise(r => setTimeout(r, 900 + Math.random() * 800))
  const latency = Date.now() - start
  testingId.value = null
  if (row.status === 'down') {
    ElMessage.error(`✗ 连接失败：端点 ${row.port} 无响应（耗时 ${latency}ms）`)
  } else if (row.status === 'warn') {
    ElMessage.warning(`⚠ 连接成功但延迟偏高：${latency}ms（阈值 200ms）`)
  } else {
    ElMessage.success(`✓ 连接成功，往返延迟 ${latency}ms`)
  }
}

function onResize() { flowChart?.resize(); protoChart?.resize(); heatChart?.resize(); drawerChart?.resize() }

/* ===== 事件过滤 ===== */
const eventTab = ref('all')
const eventCounts = computed(() => ({
  all: events.value.length,
  alert: events.value.filter(e => e.level === 'err' || e.level === 'warn').length,
  active: events.value.filter(e => e.status === '处置中' || e.status === '观察').length,
  recovered: events.value.filter(e => e.status === '已恢复').length
}))
const filteredEvents = computed(() => {
  switch (eventTab.value) {
    case 'alert':     return events.value.filter(e => e.level === 'err' || e.level === 'warn')
    case 'active':    return events.value.filter(e => e.status === '处置中' || e.status === '观察')
    case 'recovered': return events.value.filter(e => e.status === '已恢复')
    default:          return events.value
  }
})

onMounted(() => {
  flowChart = echarts.init(flowEl.value)
  protoChart = echarts.init(protoEl.value)
  heatChart = echarts.init(heatEl.value)
  renderFlow(); renderProto(); renderHeat()
  bindProtoClick(); bindHeatClick()
  window.addEventListener('resize', onResize)
  startTimer()
})

onBeforeUnmount(() => {
  stopTimer()
  window.removeEventListener('resize', onResize)
  flowChart?.dispose(); protoChart?.dispose(); heatChart?.dispose()
  drawerChart?.dispose()
})

const fmt = (n) => n.toLocaleString()
</script>

<template>
  <div class="ingest">
    <PageHeader
      tag="INGEST"
      title="数据采集网关"
      desc="非侵入接口接入监控 · 协议解析 · 数据点位健康度 · 异常断流告警"
    >
      <template #actions>
        <el-button
          :icon="live ? VideoPause : VideoPlay"
          :type="live ? 'danger' : 'success'"
          plain
          @click="toggleLive"
        >{{ live ? '暂停采集' : '继续采集' }}</el-button>
        <el-button :icon="Refresh" @click="renderFlow(); renderProto(); renderHeat()">刷新</el-button>
        <el-button type="primary" :icon="Download">导出接入清单</el-button>
      </template>
    </PageHeader>

    <!-- KPI 行 -->
    <div class="kpi-row">
      <div class="kp kp-blue">
        <div class="kp-l"><el-icon><Link /></el-icon> 接入站点</div>
        <div class="kp-v">{{ kpi.stationCount }}<span>座</span></div>
        <div class="kp-s">承保运营储能站点</div>
      </div>
      <div class="kp">
        <div class="kp-l"><el-icon><Connection /></el-icon> 接口总数</div>
        <div class="kp-v">{{ kpi.ifaceTotal }}<span>路</span></div>
        <div class="kp-s">
          <span class="ok">{{ kpi.ifaceOnline }} 正常</span>
          <span class="warn">{{ kpi.ifaceWarn }} 异常</span>
          <span class="err">{{ kpi.ifaceDown }} 离线</span>
        </div>
      </div>
      <div class="kp">
        <div class="kp-l">数据点位</div>
        <div class="kp-v">{{ fmt(kpi.tagsTotal) }}<span>个</span></div>
        <div class="kp-s">健康率 <b>{{ ((tagsHealth.healthy / tagsHealth.total) * 100).toFixed(1) }}%</b></div>
      </div>
      <div class="kp">
        <div class="kp-l">实时流量</div>
        <div class="kp-v">{{ fmt(kpi.framesPerSec) }}<span>帧/秒</span></div>
        <div class="kp-s">24h 累计 <b>{{ (kpi.totalFrames24h / 1e6).toFixed(1) }} M</b></div>
      </div>
      <div class="kp">
        <div class="kp-l">平均延迟</div>
        <div class="kp-v">{{ kpi.avgLatency }}<span>ms</span></div>
        <div class="kp-s">SLA 阈值 200ms</div>
      </div>
      <div class="kp">
        <div class="kp-l">异常事件 (24h)</div>
        <div class="kp-v" style="color:#ef4444">{{ events.filter(e => e.level === 'err').length + events.filter(e => e.level === 'warn').length }}<span>起</span></div>
        <div class="kp-s">已自动恢复 <b>{{ events.filter(e => e.status === '已恢复').length }}</b></div>
      </div>
    </div>

    <!-- 行 1: 流量(2/3) + 协议(1/3) -->
    <div class="row">
      <div class="card col-2">
        <div class="card-head">
          <div class="ch-title">24 小时实时接入流量</div>
          <div class="ch-sub">5 分钟粒度 · 协议堆叠</div>
        </div>
        <div class="chart" ref="flowEl" />
      </div>
      <div class="card">
        <div class="card-head">
          <div class="ch-title">协议流量占比</div>
          <div class="ch-sub">点击切片 · 筛选表格</div>
        </div>
        <div class="chart clickable" ref="protoEl" />
      </div>
    </div>

    <!-- 行 2: 心跳热力图(2/3) + 数据点位健康(1/3) -->
    <div class="row">
      <div class="card col-2">
        <div class="card-head">
          <div class="ch-title">站点 × 接口接入健康度</div>
          <div class="ch-sub">点击格子 · 定位到接口</div>
        </div>
        <div class="chart h280 clickable" ref="heatEl" />
      </div>
      <div class="card">
        <div class="card-head">
          <div class="ch-title">数据点位健康度</div>
          <div class="ch-sub">{{ fmt(tagsHealth.total) }} 个采集点</div>
        </div>
        <div class="tags-health">
          <div class="th-bar">
            <div class="th-seg ok" :style="{ flex: tagsHealth.healthy }" />
            <div class="th-seg warn" :style="{ flex: tagsHealth.degraded }" />
            <div class="th-seg err" :style="{ flex: tagsHealth.failed }" />
          </div>
          <div class="th-list">
            <div class="th-row">
              <span class="th-dot ok" /><span>正常采集</span>
              <span class="th-n">{{ fmt(tagsHealth.healthy) }}</span>
              <span class="th-p">{{ ((tagsHealth.healthy / tagsHealth.total) * 100).toFixed(1) }}%</span>
            </div>
            <div class="th-row">
              <span class="th-dot warn" /><span>降级（高延迟/丢点）</span>
              <span class="th-n">{{ fmt(tagsHealth.degraded) }}</span>
              <span class="th-p">{{ ((tagsHealth.degraded / tagsHealth.total) * 100).toFixed(1) }}%</span>
            </div>
            <div class="th-row">
              <span class="th-dot err" /><span>采集失败</span>
              <span class="th-n">{{ fmt(tagsHealth.failed) }}</span>
              <span class="th-p">{{ ((tagsHealth.failed / tagsHealth.total) * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div class="th-tip">
            <el-icon><CircleCheckFilled /></el-icon>
            异常点位自动重试 · 平均恢复时间 <b>1.4 min</b>
          </div>
        </div>
      </div>
    </div>

    <!-- 行 3: 接口大表 -->
    <div class="card big" ref="tableEl">
      <div class="card-head">
        <div class="ch-title">
          全量接入接口
          <span class="ch-tip" v-if="hasFilter">已筛选 {{ filtered.length }} / {{ interfaces.length }} 路</span>
        </div>
        <div class="filters">
          <el-input v-model="search" placeholder="搜索 站点 / 接口 / 端点" clearable :prefix-icon="Search" size="default" style="width:240px" />
          <el-select v-model="filterStation" placeholder="全部站点" clearable size="default" style="width:160px">
            <el-option v-for="s in stations" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-select v-model="filterProto" placeholder="全部协议" clearable size="default" style="width:140px">
            <el-option v-for="p in PROTOCOLS" :key="p.key" :label="p.key" :value="p.key" />
          </el-select>
          <el-select v-model="filterStatus" placeholder="全部状态" clearable size="default" style="width:120px">
            <el-option label="正常" value="ok" />
            <el-option label="延迟高" value="warn" />
            <el-option label="离线" value="down" />
          </el-select>
          <el-button v-if="hasFilter" text type="primary" @click="clearFilters">清空筛选</el-button>
        </div>
      </div>
      <el-table
        :data="filtered"
        stripe
        size="default"
        max-height="460"
        :row-class-name="rowClass"
        :default-sort="{ prop: 'latency', order: 'descending' }"
      >
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <span class="st-pill" :class="row.status">
              <span class="st-dot" />
              {{ row.status === 'ok' ? '正常' : row.status === 'warn' ? '延迟高' : '离线' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="station" label="所属站点" min-width="160" />
        <el-table-column prop="name" label="接口名称" min-width="130" />
        <el-table-column label="协议" width="110">
          <template #default="{ row }">
            <el-tag size="small" :color="PROTOCOLS.find(p => p.key === row.proto)?.color" effect="dark" style="border:none;color:#fff">{{ row.proto }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="端点地址" min-width="240">
          <template #default="{ row }">
            <code class="endpoint">{{ row.port }}</code>
          </template>
        </el-table-column>
        <el-table-column prop="tags" label="点位数" width="90" align="right" sortable>
          <template #default="{ row }">
            <span class="num">{{ fmt(row.tags) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="framesPerSec" label="实时帧率" width="110" align="right" sortable>
          <template #default="{ row }">
            <span class="num">{{ row.framesPerSec }}</span>
            <span class="unit"> 帧/s</span>
          </template>
        </el-table-column>
        <el-table-column prop="latency" label="延迟" width="100" align="right" sortable>
          <template #default="{ row }">
            <span :class="row.latency > 200 ? 'warn' : row.latency > 100 ? 'mid' : 'ok'">{{ Math.round(row.latency) }} ms</span>
          </template>
        </el-table-column>
        <el-table-column prop="lossRate" label="丢包率" width="90" align="right" sortable>
          <template #default="{ row }">
            <span :class="row.lossRate > 2 ? 'err' : row.lossRate > 0.5 ? 'warn' : 'ok'">{{ row.lossRate.toFixed(2) }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="last" label="最近更新" width="110" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" size="small" @click="openDetail(row)">详情</el-button>
            <el-button
              text
              type="primary"
              size="small"
              :loading="testingId === row.id"
              @click="testConnect(row)"
            >测试</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="tb-empty">
            <div>当前筛选无匹配接口</div>
            <el-button v-if="hasFilter" text type="primary" @click="clearFilters">清空筛选</el-button>
          </div>
        </template>
      </el-table>
    </div>

    <!-- 行 4: 异常事件时间线 -->
    <div class="card">
      <div class="card-head">
        <div class="ch-title">最近接入异常事件</div>
        <el-radio-group v-model="eventTab" size="small">
          <el-radio-button value="all">全部 ({{ eventCounts.all }})</el-radio-button>
          <el-radio-button value="alert">异常 ({{ eventCounts.alert }})</el-radio-button>
          <el-radio-button value="active">未恢复 ({{ eventCounts.active }})</el-radio-button>
          <el-radio-button value="recovered">已恢复 ({{ eventCounts.recovered }})</el-radio-button>
        </el-radio-group>
      </div>
      <div class="evlist" v-if="filteredEvents.length">
        <div class="ev" v-for="(e, i) in filteredEvents" :key="i" :class="e.level">
          <div class="ev-dot">
            <el-icon>
              <component :is="e.level === 'err' ? CloseBold : e.level === 'warn' ? Warning : Clock" />
            </el-icon>
          </div>
          <div class="ev-time">{{ e.time }}</div>
          <div class="ev-meta">
            <el-tag size="small" effect="plain">{{ e.proto }}</el-tag>
            <span class="ev-station">{{ e.station }}</span>
            <span class="ev-iface">{{ e.name }}</span>
          </div>
          <div class="ev-msg">{{ e.msg }}</div>
          <el-tag size="small" :type="e.status === '已恢复' ? 'success' : e.status === '处置中' ? 'warning' : 'info'">{{ e.status }}</el-tag>
        </div>
      </div>
      <div class="ev-empty" v-else>当前分组无事件</div>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      :title="drawerIface ? `${drawerIface.station} · ${drawerIface.name}` : '接口详情'"
      size="520"
      direction="rtl"
      @close="closeDrawer"
    >
      <div v-if="drawerIface" class="drawer">
        <div class="d-grid">
          <div class="d-cell">
            <div class="d-l">协议</div>
            <el-tag size="small" :color="PROTOCOLS.find(p => p.key === drawerIface.proto)?.color" effect="dark" style="border:none;color:#fff">{{ drawerIface.proto }}</el-tag>
          </div>
          <div class="d-cell">
            <div class="d-l">状态</div>
            <span class="st-pill" :class="drawerIface.status">
              <span class="st-dot" />
              {{ drawerIface.status === 'ok' ? '正常' : drawerIface.status === 'warn' ? '延迟高' : '离线' }}
            </span>
          </div>
          <div class="d-cell">
            <div class="d-l">点位数</div>
            <div class="d-v">{{ fmt(drawerIface.tags) }} 个</div>
          </div>
          <div class="d-cell">
            <div class="d-l">采集频率</div>
            <div class="d-v">{{ drawerIface.freq }} Hz</div>
          </div>
          <div class="d-cell">
            <div class="d-l">实时帧率</div>
            <div class="d-v">{{ drawerIface.framesPerSec }} 帧/s</div>
          </div>
          <div class="d-cell">
            <div class="d-l">延迟</div>
            <div class="d-v" :class="drawerIface.latency > 200 ? 'warn' : drawerIface.latency > 100 ? 'mid' : 'ok'">{{ Math.round(drawerIface.latency) }} ms</div>
          </div>
        </div>

        <div class="d-section">
          <div class="d-section-title">端点地址</div>
          <code class="endpoint d-endpoint">{{ drawerIface.port }}</code>
        </div>

        <div class="d-section">
          <div class="d-section-title">最近 60 秒帧率趋势</div>
          <div class="d-chart" ref="drawerEl" />
        </div>

        <div class="d-section">
          <div class="d-section-title">最近一帧示例 (脱敏)</div>
          <pre class="d-payload">{{ PAYLOAD_SAMPLES[drawerIface.proto] || '—' }}</pre>
        </div>

        <div class="d-actions">
          <el-button
            type="primary"
            :icon="Connection"
            :loading="testingId === drawerIface.id"
            @click="testConnect(drawerIface)"
          >测试连接</el-button>
          <el-button @click="closeDrawer">关闭</el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.ingest { padding-bottom: 24px; }

/* === KPI === */
.kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 16px; }
.kp {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 16px 18px; box-shadow: $shadow-card; position: relative; overflow: hidden;
  &::after { content: ''; position: absolute; left: 0; bottom: 0; right: 0; height: 2px; background: $grad-cyan; }
  &.kp-blue { background: linear-gradient(135deg, #fff 0%, #eff6ff 100%); }
  &.kp-blue::after { background: linear-gradient(90deg, #015eea, #06b6d4); }
}
.kp-l { font-size: 12px; color: $text-muted; display: inline-flex; align-items: center; gap: 6px; }
.kp-l .el-icon { color: $brand-blue; font-size: 14px; }
.kp-v {
  font-family: $font-num; font-variant-numeric: tabular-nums lining-nums;
  font-size: 26px; font-weight: 600; margin: 4px 0;
  letter-spacing: -0.3px;
  span { font-size: 12px; color: $text-muted; font-weight: 400; margin-left: 4px; }
}
.kp-s { font-size: 11px; color: $text-muted; display: flex; gap: 8px; flex-wrap: wrap; }
.kp-s b { color: $text-primary; }
.kp-s .ok { color: #22d3a0; }
.kp-s .warn { color: #f59e0b; }
.kp-s .err { color: #ef4444; }

/* === Cards === */
.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.col-2 { grid-column: span 2; }
.card {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 18px 20px; box-shadow: $shadow-card;
  margin-bottom: 16px;
  display: flex; flex-direction: column;
  &.big { padding: 18px 20px; }
}
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.ch-title { font-size: 15px; font-weight: 600; }
.ch-sub { font-size: 12px; color: $text-muted; }
.chart { width: 100%; height: 280px; }
.chart.h280 { height: 280px; }
.chart.clickable { cursor: pointer; }
.ch-tip { font-size: 11px; color: $brand-blue; font-weight: 500; margin-left: 8px;
  padding: 2px 8px; background: rgba(1,94,234,0.08); border-radius: 8px;
}

/* === Tags health === */
.tags-health { padding: 8px 0; flex: 1; display: flex; flex-direction: column; gap: 16px; }
.th-bar { display: flex; height: 18px; border-radius: 10px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.05); }
.th-seg.ok   { background: linear-gradient(90deg, #22d3a0, #06b6d4); }
.th-seg.warn { background: #f59e0b; }
.th-seg.err  { background: #ef4444; }
.th-list { display: flex; flex-direction: column; gap: 12px; }
.th-row { display: grid; grid-template-columns: 18px 1fr auto auto; align-items: center; gap: 10px; font-size: 13px; }
.th-dot { width: 12px; height: 12px; border-radius: 50%;
  &.ok { background: #22d3a0; }
  &.warn { background: #f59e0b; }
  &.err { background: #ef4444; }
}
.th-n { font-family: $font-num; font-weight: 600; color: $text-primary; }
.th-p { font-size: 12px; color: $text-muted; min-width: 50px; text-align: right; }
.th-tip {
  margin-top: auto; padding: 10px 14px; background: $bg-soft; border-radius: 8px;
  font-size: 12px; color: $text-secondary; display: flex; align-items: center; gap: 6px;
  .el-icon { color: #22d3a0; }
  b { color: $brand-blue; }
}

/* === Table === */
.filters { display: flex; gap: 10px; }
.st-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;
  &.ok { background: rgba(34,211,160,0.12); color: #16a085; }
  &.warn { background: rgba(245,158,11,0.14); color: #d97706; }
  &.down { background: rgba(239,68,68,0.12); color: #ef4444; }
}
.st-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.endpoint { background: $bg-soft; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: $brand-blue; font-family: monospace; }
:deep(.el-table .row-down) { background: rgba(239,68,68,0.05) !important; }
:deep(.el-table .row-warn) { background: rgba(245,158,11,0.05) !important; }
.tb-empty { padding: 32px 0; color: $text-muted; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.num { font-family: $font-num; font-variant-numeric: tabular-nums; font-weight: 500; }
.unit { font-size: 11px; color: $text-muted; }
.ok { color: #22d3a0; }
.mid { color: #015eea; }
.warn { color: #f59e0b; }
.err { color: #ef4444; }

/* === Event list === */
.evlist { display: flex; flex-direction: column; gap: 8px; }
.ev {
  display: grid; grid-template-columns: 30px 70px 220px 1fr auto;
  gap: 14px; align-items: center;
  padding: 12px 16px;
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  border-left-width: 3px;
  font-size: 13px;
  &.err  { border-left-color: #ef4444; background: linear-gradient(90deg, rgba(239,68,68,0.04) 0%, transparent 60%); }
  &.warn { border-left-color: #f59e0b; }
  &.info { border-left-color: #015eea; }
}
.ev-dot {
  width: 24px; height: 24px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 12px;
  .ev.err & { background: #ef4444; }
  .ev.warn & { background: #f59e0b; }
  .ev.info & { background: #015eea; }
}
.ev.err .ev-dot { background: #ef4444; }
.ev.warn .ev-dot { background: #f59e0b; }
.ev.info .ev-dot { background: #015eea; }
.ev-time { font-family: $font-num; color: $text-muted; font-size: 12px; }
.ev-meta { display: flex; gap: 8px; align-items: center; font-size: 12px; }
.ev-station { font-weight: 600; color: $text-primary; }
.ev-iface { color: $text-secondary; }
.ev-msg { color: $text-secondary; }
.ev-empty { padding: 32px 0; text-align: center; color: $text-muted; font-size: 13px; }

/* === Drawer === */
.drawer { padding: 0 4px; display: flex; flex-direction: column; gap: 20px; }
.d-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 18px; }
.d-cell { display: flex; flex-direction: column; gap: 4px; }
.d-l { font-size: 11px; color: $text-muted; }
.d-v { font-family: $font-num; font-weight: 600; font-size: 15px; color: $text-primary;
  &.ok { color: #22d3a0; } &.mid { color: #015eea; } &.warn { color: #f59e0b; }
}
.d-section-title { font-size: 12px; color: $text-muted; margin-bottom: 6px; font-weight: 500; }
.d-endpoint { font-size: 12px; padding: 6px 10px; display: block; word-break: break-all; }
.d-chart { width: 100%; height: 160px; background: $bg-soft; border-radius: 6px; }
.d-payload {
  background: #10152e; color: #b3c5ff; padding: 12px 14px; border-radius: 6px;
  font-family: 'JetBrains Mono', Menlo, monospace; font-size: 11px; line-height: 1.55;
  overflow-x: auto; margin: 0;
}
.d-actions { display: flex; gap: 8px; margin-top: 4px; }

@media (max-width: 1400px) {
  .kpi-row { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1100px) {
  .row { grid-template-columns: 1fr; }
  .col-2 { grid-column: auto; }
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .ev { grid-template-columns: 30px 70px 1fr; .ev-msg, .ev-meta { grid-column: 2 / -1; } }
}
</style>
