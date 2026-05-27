<script setup>
import { ref, computed, reactive } from 'vue'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import { incidents as seedIncidents, stations, alarms, evidences } from '@/mock/data'
import {
  Search, Document, Clock, Warning, MagicStick,
  VideoCamera, Folder, Edit, CircleCheckFilled, Loading
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useIncidentStore } from '@/stores/incident'

const store = useIncidentStore()

/* ---------- 合并 mock + 用户创建 ---------- */
const allIncidents = computed(() => [...store.userIncidents, ...seedIncidents])

/* ---------- 列表搜索过滤 ---------- */
const search = ref('')
const filterSeverity = ref('')
const filterStatusType = ref('')   // 综合 status：使用 store 决策状态优先，回退到 mock
const filteredIncidents = computed(() =>
  allIncidents.value.filter(i => {
    const s = String(i.id + ' ' + i.stationName + ' ' + i.type + ' ' + i.location).toLowerCase()
    if (search.value && !s.includes(search.value.toLowerCase())) return false
    if (filterSeverity.value && i.severity !== filterSeverity.value) return false
    if (filterStatusType.value) {
      const eff = effectiveStatus(i)
      if (filterStatusType.value !== eff) return false
    }
    return true
  })
)
const hasFilter = computed(() => !!(search.value || filterSeverity.value || filterStatusType.value))
function clearFilters() { search.value = ''; filterSeverity.value = ''; filterStatusType.value = '' }

const selected = ref(allIncidents.value[0])
function pickIncident(it) { selected.value = it }

/* ---------- 状态合并：决策 store 优先 ---------- */
const STATUS_META = {
  pending:  { label: '待溯源', color: '#8a93a8', tag: 'info' },
  tracing:  { label: '溯源中', color: '#f59e0b', tag: 'warning' },
  traced:   { label: '已溯源', color: '#06b6d4', tag: 'primary' },
  closed:   { label: '已结案', color: '#22d3a0', tag: 'success' },
  claimed:  { label: '已理赔', color: '#015eea', tag: 'primary' },
  // mock status fallback
  '已结案': { label: '已结案', color: '#22d3a0', tag: 'success' },
  '已溯源': { label: '已溯源', color: '#06b6d4', tag: 'primary' },
  '溯源中': { label: '溯源中', color: '#f59e0b', tag: 'warning' },
  '理赔中': { label: '理赔中', color: '#015eea', tag: 'primary' },
  '已理赔': { label: '已理赔', color: '#015eea', tag: 'primary' }
}
function effectiveStatus(it) {
  const d = store.getDecision(it.id)
  if (d.status && d.status !== 'pending') return d.status
  // 把 mock 的中文映射回标准 key
  const map = { '已结案': 'closed', '已溯源': 'traced', '溯源中': 'tracing', '理赔中': 'claimed', '已理赔': 'claimed' }
  return map[it.status] || 'pending'
}
function statusOf(it) {
  const eff = effectiveStatus(it)
  return STATUS_META[eff] || STATUS_META.pending
}
const currentStatus = computed(() => statusOf(selected.value))

/* ---------- 哈希 / 稳定随机 ---------- */
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

/* ---------- 事件链按类型 ---------- */
function buildEvents(inc) {
  const t0 = dayjs(inc.time)
  const fmt = (off) => t0.add(off, 'minute').format('HH:mm:ss')
  if (inc.templateKey === 'thermal') {
    return [
      { time: fmt(-5),    label: '簇电流异常波动',           color: '#06b6d4' },
      { time: fmt(-2),    label: 'PACK 单体压差 > 50mV 一级预警', color: '#f59e0b' },
      { time: fmt(-1),    label: '温度梯度 4.8℃ 二级预警',  color: '#f59e0b' },
      { time: fmt(0),     label: '热失控早期预警',           color: '#ef4444' },
      { time: fmt(0.12),  label: '消防联动启动 / 灭火释放',  color: '#ef4444' },
      { time: fmt(0.75),  label: '运维远程拉闸',             color: '#015eea' },
      { time: fmt(7.9),   label: '温度回落、绝缘恢复',       color: '#22d3a0' }
    ]
  }
  if (inc.templateKey === 'insulation') {
    return [
      { time: fmt(-15),   label: '簇绝缘缓慢下降至 4500 kΩ', color: '#06b6d4' },
      { time: fmt(-8),    label: '绝缘 < 2000 kΩ 一级预警',  color: '#f59e0b' },
      { time: fmt(-2),    label: '绝缘 < 500 kΩ 二级预警',   color: '#f59e0b' },
      { time: fmt(0),     label: '绝缘事件触发 / 高压断开',  color: '#ef4444' },
      { time: fmt(0.5),   label: '人员到场排查',             color: '#015eea' },
      { time: fmt(40),    label: '受潮元件更换，绝缘恢复',   color: '#22d3a0' }
    ]
  }
  // fire
  return [
    { time: fmt(-1),    label: '探测器 1 号触发烟雾信号',   color: '#06b6d4' },
    { time: fmt(0),     label: '消防主机告警',              color: '#ef4444' },
    { time: fmt(0.1),   label: '联动停机 / 切电',           color: '#f59e0b' },
    { time: fmt(2),     label: '人员到达现场',              color: '#015eea' },
    { time: fmt(10),    label: '现场无明火，排除误报',      color: '#22d3a0' },
    { time: fmt(15),    label: '复位电源，恢复运行',        color: '#22d3a0' }
  ]
}

/* ---------- 曲线按类型 ---------- */
function buildTempData(inc) {
  const rnd = mulberry32(hashSeed(inc.id + ':temp'))
  if (inc.templateKey === 'thermal') {
    // 7 分钟前到 22 分钟后，T0 在 index 7
    return [28.2, 28.3, 28.4, 28.6, 28.9, 29.5, 30.2, 31.4, 33.1, 35.7, 38.9, 42.5, 46.8, 52.1, 58.4, 63.2, 61.5, 55.8, 48.2, 42.1, 37.5, 34.2, 32.1, 30.8, 29.9, 29.2, 28.8, 28.5, 28.3, 28.2]
      .map(v => +(v + (rnd() - 0.5) * 0.6).toFixed(1))
  }
  if (inc.templateKey === 'insulation') {
    // 绝缘事故温度变化不大，但有小幅波动
    return Array.from({ length: 30 }, (_, i) => +(26 + Math.sin(i / 6) + (rnd() - 0.5) * 0.6).toFixed(1))
  }
  // 消防误动作：温度基本平稳，喷洒后小幅下降
  return Array.from({ length: 30 }, (_, i) => {
    const base = 27.5
    const drop = i >= 8 && i < 14 ? -(i - 8) * 0.4 : 0
    return +(base + drop + (rnd() - 0.5) * 0.4).toFixed(1)
  })
}
function buildSecondaryData(inc) {
  // 对比数据
  const rnd = mulberry32(hashSeed(inc.id + ':peer'))
  if (inc.templateKey === 'thermal') {
    return Array.from({ length: 30 }, () => +(27.8 + rnd() * 1.5).toFixed(1))
  }
  if (inc.templateKey === 'insulation') {
    return Array.from({ length: 30 }, () => +(26 + rnd() * 0.8).toFixed(1))
  }
  return Array.from({ length: 30 }, () => +(27 + rnd() * 1).toFixed(1))
}
function buildInsulationData(inc) {
  if (inc.templateKey === 'insulation') {
    // 缓慢下降 → 急跌 → 修复恢复
    return [4820, 4790, 4700, 4520, 4280, 3950, 3520, 3010, 2480, 1920, 1380, 880, 480, 240, 120, 80, 60, 50, 60, 120, 380, 920, 1820, 2680, 3320, 3780, 4120, 4380, 4580, 4720]
  }
  if (inc.templateKey === 'thermal') {
    return [4820, 4815, 4800, 4760, 4710, 4520, 4180, 3620, 2810, 1840, 920, 420, 180, 80, 35, 18, 42, 180, 560, 1240, 2380, 3120, 3680, 4020, 4280, 4460, 4580, 4680, 4760, 4820]
  }
  // fire 消防误动作：绝缘几乎无变化
  const rnd = mulberry32(hashSeed(inc.id + ':ins'))
  return Array.from({ length: 30 }, () => Math.round(4700 + rnd() * 200))
}

const events = computed(() => buildEvents(selected.value))
const tempOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 0 },
  grid: { left: 50, right: 25, top: 36, bottom: 36 },
  xAxis: {
    type: 'category',
    data: Array.from({ length: 30 }, (_, i) => {
      const m = i - 7
      const sign = m < 0 ? '-' : '+'
      return `T${sign}${Math.abs(m)}min`
    }),
    axisLabel: { color: '#525c75', fontSize: 11 }
  },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f7' } } },
  series: [
    {
      name: `${selected.value.location.split('/').pop().trim()} 最高温`, type: 'line', smooth: true,
      data: buildTempData(selected.value),
      lineStyle: { color: '#ef4444', width: 2.5 },
      itemStyle: { color: '#ef4444' },
      markLine: {
        symbol: 'none',
        data: [
          { xAxis: 7, label: { formatter: 'T0', color: '#ef4444' }, lineStyle: { color: '#ef4444' } }
        ]
      }
    },
    {
      name: '同舱其他PACK均温', type: 'line', smooth: true,
      data: buildSecondaryData(selected.value),
      lineStyle: { color: '#06b6d4', width: 2, type: 'dashed' },
      itemStyle: { color: '#06b6d4' }
    }
  ]
}))
const insulationOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 50, right: 25, top: 30, bottom: 30 },
  xAxis: {
    type: 'category',
    data: Array.from({ length: 30 }, (_, i) => `T${i-7 < 0 ? '-' : '+'}${Math.abs(i-7)}m`),
    axisLabel: { color: '#525c75', fontSize: 11 }
  },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f7' } }, name: 'kΩ' },
  series: [{
    type: 'line', smooth: true, name: '簇绝缘电阻',
    data: buildInsulationData(selected.value),
    lineStyle: { color: '#015eea', width: 2.5 },
    itemStyle: { color: '#015eea' },
    areaStyle: { color: 'rgba(1,94,234,0.12)' }
  }]
}))

/* ---------- 关联告警/证据 ---------- */
const relatedAlarms = computed(() =>
  alarms.filter(a => a.stationName === selected.value.stationName).slice(0, 5)
)
const relatedEvidences = computed(() =>
  evidences.filter(e => e.stationName === selected.value.stationName).slice(0, 3)
)

/* ---------- 启动溯源进度 ---------- */
const traceDialog = ref(false)
const tracing = reactive({
  steps: [],
  done: false
})
const TRACE_STEPS = [
  { key: 'fetch',  label: '拉取事故前 72h BMS / 消防 / 环境 / 运维全量数据', ms: 700 },
  { key: 'align',  label: '多系统时钟毫秒级对齐',                            ms: 500 },
  { key: 'cmp',    label: '与设备基线 / 阈值规则比对',                      ms: 700 },
  { key: 'gen',    label: '识别事件链并生成根因报告',                       ms: 800 }
]
async function startTrace() {
  traceDialog.value = true
  tracing.done = false
  tracing.steps = TRACE_STEPS.map(s => ({ ...s, status: 'pending' }))
  store.setDecision(selected.value.id, { status: 'tracing' })
  for (let i = 0; i < tracing.steps.length; i++) {
    tracing.steps[i].status = 'running'
    await new Promise(r => setTimeout(r, tracing.steps[i].ms))
    tracing.steps[i].status = 'ok'
  }
  tracing.done = true
  store.setDecision(selected.value.id, { status: 'traced', tracedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') })
  ElMessage.success(`溯源完成：${selected.value.id}`)
}

/* ---------- 责任界定 ---------- */
const liabDialog = ref(false)
const liabForm = reactive({
  responsibility: '设备厂商', ratio: 100, note: ''
})
function openLiability() {
  const d = store.getDecision(selected.value.id)
  liabForm.responsibility = d.responsibility || '设备厂商'
  liabForm.ratio = d.ratio ?? 100
  liabForm.note = d.note || ''
  liabDialog.value = true
}
function saveLiability() {
  store.setDecision(selected.value.id, {
    responsibility: liabForm.responsibility,
    ratio: liabForm.ratio,
    note: liabForm.note,
    decidedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    by: '当前用户'
  })
  liabDialog.value = false
  ElMessage.success('责任界定已保存')
}

/* ---------- 状态推进 ---------- */
async function closeCase() {
  try {
    await ElMessageBox.confirm(`确认结案 ${selected.value.id}？结案后将进入归档流程`, '结案', { type: 'success', confirmButtonText: '确认结案' })
  } catch { return }
  store.setDecision(selected.value.id, { status: 'closed', closedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') })
  ElMessage.success('已结案')
}
async function claim() {
  try {
    const { value } = await ElMessageBox.prompt('请输入理赔金额（万元）', '提交理赔', { confirmButtonText: '提交' })
    const n = parseFloat(value)
    if (isNaN(n) || n < 0) { ElMessage.error('金额无效'); return }
    store.setDecision(selected.value.id, { status: 'claimed', claim: n, claimedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') })
    ElMessage.success(`已记录理赔 ${n} 万元`)
  } catch {}
}
function resetState() {
  store.clearDecision(selected.value.id)
  ElMessage.success('状态已重置')
}

/* ---------- 手动创建新事故 ---------- */
const createDialog = ref(false)
const createForm = reactive({
  stationName: '', location: '', type: '电芯热失控预警', time: dayjs().format('YYYY-MM-DD HH:mm:ss'), severity: '中'
})
function openCreate() {
  createForm.stationName = stations[0].name
  createForm.location = '2#舱 / 1#簇'
  createForm.type = '电芯热失控预警'
  createForm.time = dayjs().format('YYYY-MM-DD HH:mm:ss')
  createForm.severity = '中'
  createDialog.value = true
}
function submitCreate() {
  const tplMap = { '电芯热失控预警': 'thermal', '绝缘下降': 'insulation', '消防误动作': 'fire' }
  const last = allIncidents.value.reduce((a, i) => {
    const m = i.id.match(/INC-\d+-(\d+)/)
    return m ? Math.max(a, +m[1]) : a
  }, 0)
  const inc = {
    id: `INC-${dayjs(createForm.time).format('YYYY')}-${String(last + 1).padStart(3, '0')}`,
    stationName: createForm.stationName,
    location: createForm.location,
    type: createForm.type,
    templateKey: tplMap[createForm.type] || 'thermal',
    time: createForm.time,
    severity: createForm.severity,
    duration: '—',
    status: '待溯源',
    loss: '待评估',
    root: '待溯源后确定',
    _user: true
  }
  store.addIncident(inc)
  selected.value = inc
  createDialog.value = false
  ElMessage.success(`已创建 ${inc.id}，可启动溯源`)
}

/* ---------- 数据包 drawer ---------- */
const packageDrawer = ref(false)

/* ---------- 视频证据 dialog ---------- */
const videoDialog = ref(false)
const videoSources = computed(() => [
  { cam: '舱外全景', uri: `rtsp://video.cam01.local/${selected.value.id}` },
  { cam: '舱内主干道', uri: `rtsp://video.cam02.local/${selected.value.id}` },
  { cam: '电池簇正面', uri: `rtsp://video.cam03.local/${selected.value.id}` },
  { cam: '消防设施', uri: `rtsp://video.cam04.local/${selected.value.id}` }
])

/* ---------- 报告下载 ---------- */
function downloadJson(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
function exportTraceReport() {
  const c = selected.value
  const d = store.getDecision(c.id)
  const r = {
    reportId: 'TR-' + c.id + '-' + dayjs().format('YYYYMMDD-HHmm'),
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    incident: { ...c },
    status: STATUS_META[effectiveStatus(c)]?.label,
    timeline: events.value,
    rootCause: c.root,
    liability: d.responsibility ? { responsibility: d.responsibility, ratio: d.ratio + '%', note: d.note, by: d.by, at: d.decidedAt } : null,
    relatedAlarms: relatedAlarms.value.map(a => ({ id: a.id, time: a.time, type: a.type, level: a.level })),
    relatedEvidences: relatedEvidences.value.map(e => ({ id: e.id, hash: e.hash, chainHeight: e.chainHeight })),
    claim: d.claim != null ? { amount: d.claim + ' 万元', at: d.claimedAt } : null
  }
  downloadJson(`事故溯源报告-${c.id}-${dayjs().format('YYYYMMDD-HHmm')}.json`, r)
  ElMessage.success('已导出事故溯源报告')
}
function exportClaimReport() {
  const c = selected.value
  const d = store.getDecision(c.id)
  const r = {
    claimReportId: 'CL-' + c.id + '-' + dayjs().format('YYYYMMDD-HHmm'),
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    incident: { id: c.id, stationName: c.stationName, location: c.location, type: c.type, time: c.time, severity: c.severity, duration: c.duration, loss: c.loss },
    rootCause: c.root,
    liability: { responsibility: d.responsibility || '—', ratio: (d.ratio ?? '—') + (d.ratio != null ? '%' : ''), note: d.note || '' },
    evidenceChain: relatedEvidences.value.map(e => ({ id: e.id, type: e.type, hash: e.hash, chainHeight: e.chainHeight, timestamp: e.timestamp })),
    claim: { amount: d.claim != null ? d.claim + ' 万元' : '待定', date: d.claimedAt || '—' },
    legalNote: '本报告所附数据已通过 SHA-256 哈希固化并上链存证，可作司法采信。'
  }
  downloadJson(`理赔证据报告-${c.id}-${dayjs().format('YYYYMMDD-HHmm')}.json`, r)
  ElMessage.success('已导出理赔证据报告')
}

/* ---------- 模拟原始数据包 ---------- */
function fakeData(inc, dimension) {
  const rnd = mulberry32(hashSeed(inc.id + ':' + dimension))
  if (dimension === 'bms') {
    return Array.from({ length: 8 }, (_, i) => ({
      t: dayjs(inc.time).subtract(7 - i, 'minute').format('HH:mm:ss'),
      packV: +(47 + (rnd() - 0.5) * 0.4).toFixed(2),
      cellMax: +(3.35 + rnd() * 0.05).toFixed(3),
      cellMin: +(3.30 + rnd() * 0.03).toFixed(3),
      tempMax: inc.templateKey === 'thermal' ? +(28 + i * 4 + rnd() * 2).toFixed(1) : +(27 + rnd()).toFixed(1)
    }))
  }
  if (dimension === 'fire') {
    return Array.from({ length: 6 }, (_, i) => ({
      t: dayjs(inc.time).subtract(5 - i, 'minute').format('HH:mm:ss'),
      smokeMg: +(0.1 + rnd() * (i >= 3 ? 3 : 0.1)).toFixed(2),
      h2Ppm: Math.floor(5 + rnd() * (i >= 3 ? 80 : 10)),
      pressure: +(12.1 + (rnd() - 0.5) * 0.2).toFixed(2),
      detectorAlarm: i >= 4 ? 1 : 0
    }))
  }
  if (dimension === 'env') {
    return Array.from({ length: 6 }, (_, i) => ({
      t: dayjs(inc.time).subtract(5 - i, 'minute').format('HH:mm:ss'),
      cabinTempC: +(26 + (rnd() - 0.5) * 1).toFixed(1),
      humidityPct: Math.floor(45 + rnd() * 10),
      vocPpm: Math.floor(rnd() * 60)
    }))
  }
  // ops
  return [
    { t: dayjs(inc.time).format('HH:mm:ss'), op: '远程拉闸', by: '运维-张三', result: 'OK' },
    { t: dayjs(inc.time).add(2, 'minute').format('HH:mm:ss'), op: '现场抵达', by: '运维-李四', result: 'OK' },
    { t: dayjs(inc.time).add(10, 'minute').format('HH:mm:ss'), op: '巡查', by: '运维-李四', result: '无明火' }
  ]
}
</script>

<template>
  <div class="incident">
    <PageHeader
      tag="INCIDENT"
      title="事故全维度数据溯源"
      desc="一键回溯事故前 72 小时全维度数据 · 完整还原事故链 · 自动生成溯源报告"
    >
      <template #actions>
        <el-button :icon="MagicStick" @click="openCreate">手动选时段</el-button>
        <el-button type="primary" :icon="Document" @click="exportTraceReport">生成事故溯源报告</el-button>
      </template>
    </PageHeader>

    <!-- 查询/筛选条 -->
    <div class="query card">
      <el-input
        v-model="search"
        placeholder="搜索 编号 / 站点 / 位置 / 类型"
        clearable
        :prefix-icon="Search"
        style="width: 280px"
      />
      <el-select v-model="filterSeverity" placeholder="严重等级" clearable style="width: 120px">
        <el-option label="高" value="高" />
        <el-option label="中" value="中" />
        <el-option label="低" value="低" />
      </el-select>
      <el-select v-model="filterStatusType" placeholder="状态" clearable style="width: 130px">
        <el-option v-for="k in ['pending','tracing','traced','closed','claimed']" :key="k" :label="STATUS_META[k].label" :value="k" />
      </el-select>
      <el-button v-if="hasFilter" text type="primary" @click="clearFilters">清空筛选</el-button>
      <div class="qt">
        <el-icon><Clock /></el-icon>
        共 {{ filteredIncidents.length }} / {{ allIncidents.length }} 起事故 · 平均溯源耗时 <b>28 秒</b>
      </div>
    </div>

    <div class="layout">
      <!-- 事故列表 -->
      <div class="case card">
        <div class="title">历史事故 ({{ filteredIncidents.length }})</div>
        <div
          class="case-item"
          v-for="it in filteredIncidents"
          :key="it.id"
          :class="{ active: selected.id === it.id }"
          @click="pickIncident(it)"
        >
          <div class="ci-row">
            <span class="ci-id">{{ it.id }}</span>
            <el-tag size="small"
              :type="it.severity === '高' ? 'danger' : it.severity === '中' ? 'warning' : 'info'">
              {{ it.severity }}
            </el-tag>
          </div>
          <div class="ci-name">{{ it.type }}</div>
          <div class="ci-meta">{{ it.stationName }}</div>
          <div class="ci-foot">
            <span class="ci-time">{{ it.time }}</span>
            <span class="ci-status" :style="{ background: statusOf(it).color }">{{ statusOf(it).label }}</span>
          </div>
        </div>
        <div class="case-empty" v-if="filteredIncidents.length === 0">
          <div>无匹配事故</div>
          <el-button v-if="hasFilter" text type="primary" size="small" @click="clearFilters">清空筛选</el-button>
        </div>
      </div>

      <!-- 溯源主体 -->
      <div class="main">
        <div class="case-head card">
          <div class="ch-left">
            <div class="ch-id">{{ selected.id }}</div>
            <div class="ch-title">
              <el-icon class="warn"><Warning /></el-icon>
              {{ selected.type }} · {{ selected.location }}
            </div>
            <div class="ch-sub">
              {{ selected.stationName }}
              · <span :style="{ color: currentStatus.color, fontWeight: 600 }">{{ currentStatus.label }}</span>
            </div>
          </div>
          <div class="ch-stats">
            <div class="ch-stat"><div class="cs-l">事故时间</div><div class="cs-v">{{ selected.time }}</div></div>
            <div class="ch-stat"><div class="cs-l">事故等级</div><div class="cs-v">{{ selected.severity }}</div></div>
            <div class="ch-stat"><div class="cs-l">持续时长</div><div class="cs-v">{{ selected.duration }}</div></div>
            <div class="ch-stat"><div class="cs-l">损失评估</div><div class="cs-v">{{ selected.loss }}</div></div>
            <div class="ch-stat"><div class="cs-l">案件状态</div><div class="cs-v">{{ currentStatus.label }}</div></div>
          </div>
          <!-- 状态推进按钮组 -->
          <div class="ch-ops">
            <el-button
              v-if="effectiveStatus(selected) === 'pending' || effectiveStatus(selected) === 'tracing'"
              type="primary" :icon="Search"
              @click="startTrace"
            >启动溯源</el-button>
            <el-button
              v-if="effectiveStatus(selected) === 'traced'"
              type="success" @click="closeCase"
            >确认结案</el-button>
            <el-button
              v-if="['traced','closed'].includes(effectiveStatus(selected))"
              type="primary" plain
              @click="claim"
            >提交理赔</el-button>
            <el-button :icon="Edit" @click="openLiability">编辑责任界定</el-button>
            <el-button
              v-if="effectiveStatus(selected) !== 'pending'"
              plain @click="resetState"
            >重置状态</el-button>
          </div>
        </div>

        <!-- 时间线 -->
        <div class="card">
          <div class="title">关键事件时间线（按事故类型自动还原）</div>
          <div class="timeline" :style="{ gridTemplateColumns: `repeat(${events.length}, 1fr)` }">
            <div class="tl-item" v-for="(e, i) in events" :key="i">
              <div class="tl-dot" :style="{ background: e.color, boxShadow: `0 0 0 4px ${e.color}33` }" />
              <div class="tl-time">{{ e.time }}</div>
              <div class="tl-label" :style="{ color: e.color }">{{ e.label }}</div>
            </div>
          </div>
        </div>

        <!-- 曲线对齐 -->
        <div class="dual">
          <ChartCard title="温度对齐曲线" desc="对齐至事故触发点 T0" :option="tempOption" height="300px" />
          <ChartCard title="绝缘电阻变化" desc="事故前后 30 分钟" :option="insulationOption" height="300px" />
        </div>

        <!-- 关联告警/证据 -->
        <div class="related card">
          <div class="title">关联告警与证据</div>
          <div class="rel-grid">
            <div class="rel-col">
              <div class="rc-h">触发告警 ({{ relatedAlarms.length }})</div>
              <div class="rc-list" v-if="relatedAlarms.length">
                <div class="rc-item" v-for="a in relatedAlarms" :key="a.id">
                  <el-tag :type="a.level === '严重' ? 'danger' : a.level === '重要' ? 'warning' : 'info'" size="small">{{ a.level }}</el-tag>
                  <span class="rc-type">{{ a.type }}</span>
                  <span class="rc-loc">{{ a.location }}</span>
                  <span class="rc-t">{{ a.time.slice(11, 19) }}</span>
                </div>
              </div>
              <div class="rc-empty" v-else>暂无关联告警</div>
            </div>
            <div class="rel-col">
              <div class="rc-h">上链证据 ({{ relatedEvidences.length }})</div>
              <div class="rc-list" v-if="relatedEvidences.length">
                <div class="rc-item ev" v-for="e in relatedEvidences" :key="e.id">
                  <code class="rc-evid">{{ e.id }}</code>
                  <el-tag size="small" effect="plain">{{ e.type }}</el-tag>
                  <code class="rc-hash">{{ e.hash.slice(0, 18) }}…</code>
                  <span class="rc-block">#{{ e.chainHeight.toLocaleString() }}</span>
                </div>
              </div>
              <div class="rc-empty" v-else>暂无关联证据</div>
            </div>
          </div>
        </div>

        <!-- 责任界定 + 结论 -->
        <div class="card root">
          <div class="title">事故诱因分析与责任依据</div>
          <div class="root-grid">
            <div>
              <div class="rg-l">根因定位</div>
              <div class="rg-v">{{ selected.root }}</div>
            </div>
            <div>
              <div class="rg-l">数据来源</div>
              <div class="rg-v">BMS · 消防 · 环境 · 运维 全链路对齐</div>
            </div>
            <div>
              <div class="rg-l">时间精度</div>
              <div class="rg-v">毫秒级 · 多系统时钟对齐</div>
            </div>
            <div>
              <div class="rg-l">证据采信</div>
              <div class="rg-v">已固化、上链、可司法采信</div>
            </div>
          </div>
          <el-alert
            type="success" :closable="false" show-icon class="root-alert"
            v-if="store.getDecision(selected.id).responsibility"
          >
            <strong>责任界定：</strong>{{ store.getDecision(selected.id).responsibility }}
            责任比例 <b>{{ store.getDecision(selected.id).ratio }}%</b>
            {{ store.getDecision(selected.id).note ? '· ' + store.getDecision(selected.id).note : '' }}
            <div style="font-size:11px;color:#8a93a8;margin-top:4px">{{ store.getDecision(selected.id).by }} · {{ store.getDecision(selected.id).decidedAt }}</div>
          </el-alert>
          <el-alert
            v-else
            type="info" :closable="false" show-icon class="root-alert"
            title="尚未进行责任界定，点击「编辑责任界定」完善"
          />
          <div class="root-actions">
            <el-button :icon="Folder" @click="packageDrawer = true">查看完整数据包</el-button>
            <el-button :icon="VideoCamera" @click="videoDialog = true">查看视频证据</el-button>
            <el-button type="primary" :icon="Document" @click="exportClaimReport">生成理赔证据报告</el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 溯源进度对话框 -->
    <el-dialog v-model="traceDialog" :title="`正在溯源 ${selected.id}`" width="500" :close-on-click-modal="false">
      <div class="vf-list">
        <div v-for="s in tracing.steps" :key="s.key" class="vf-step" :class="s.status">
          <div class="vf-icon">
            <el-icon v-if="s.status === 'pending'" color="#c4cad8"><Loading /></el-icon>
            <el-icon v-else-if="s.status === 'running'" color="#015eea" class="vf-spin"><Loading /></el-icon>
            <el-icon v-else color="#22d3a0"><CircleCheckFilled /></el-icon>
          </div>
          <div class="vf-l">{{ s.label }}</div>
          <div class="vf-t">{{ s.status === 'ok' ? '✓ 完成' : s.status === 'running' ? '进行中…' : '等待' }}</div>
        </div>
      </div>
      <div class="vf-result" v-if="tracing.done">
        <el-icon style="color:#22d3a0;font-size:18px"><CircleCheckFilled /></el-icon>
        溯源完成，已生成事件链与根因分析
      </div>
      <template #footer>
        <el-button :disabled="!tracing.done" type="primary" @click="traceDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 责任界定对话框 -->
    <el-dialog v-model="liabDialog" title="责任界定" width="500">
      <el-form label-width="86px" label-position="left">
        <el-form-item label="责任主体">
          <el-radio-group v-model="liabForm.responsibility">
            <el-radio value="设备厂商">设备厂商</el-radio>
            <el-radio value="运维方">运维方</el-radio>
            <el-radio value="第三方">第三方</el-radio>
            <el-radio value="不可抗力">不可抗力</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="责任比例">
          <el-slider v-model="liabForm.ratio" :min="0" :max="100" :step="5" show-input />
        </el-form-item>
        <el-form-item label="备注说明">
          <el-input v-model="liabForm.note" type="textarea" :rows="3" placeholder="例：电芯一致性差，设备批次问题" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="liabDialog = false">取消</el-button>
        <el-button type="primary" @click="saveLiability">保存</el-button>
      </template>
    </el-dialog>

    <!-- 新建事故对话框 -->
    <el-dialog v-model="createDialog" title="手动选时段创建事故" width="520">
      <el-form label-width="90px" label-position="left">
        <el-form-item label="站点">
          <el-select v-model="createForm.stationName" style="width:100%">
            <el-option v-for="s in stations" :key="s.id" :label="s.name" :value="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备位置">
          <el-input v-model="createForm.location" placeholder="如 2#舱 / 3#簇 / PACK-07" />
        </el-form-item>
        <el-form-item label="事故类型">
          <el-select v-model="createForm.type" style="width:100%">
            <el-option label="电芯热失控预警" value="电芯热失控预警" />
            <el-option label="绝缘下降" value="绝缘下降" />
            <el-option label="消防误动作" value="消防误动作" />
          </el-select>
        </el-form-item>
        <el-form-item label="事故时间">
          <el-date-picker v-model="createForm.time" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" />
        </el-form-item>
        <el-form-item label="严重等级">
          <el-radio-group v-model="createForm.severity">
            <el-radio value="高">高</el-radio>
            <el-radio value="中">中</el-radio>
            <el-radio value="低">低</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" @click="submitCreate">创建并开始溯源</el-button>
      </template>
    </el-dialog>

    <!-- 数据包 drawer -->
    <el-drawer v-model="packageDrawer" :title="`完整数据包 - ${selected.id}`" size="640" direction="rtl">
      <div class="pk-section">
        <div class="pk-h">BMS · 电压/电流/温度 (事故前 7 min)</div>
        <el-table :data="fakeData(selected, 'bms')" size="small" stripe>
          <el-table-column prop="t" label="时刻" width="90" />
          <el-table-column prop="packV" label="PACK V" align="right" />
          <el-table-column prop="cellMax" label="电芯最高 V" align="right" />
          <el-table-column prop="cellMin" label="电芯最低 V" align="right" />
          <el-table-column prop="tempMax" label="最高温 ℃" align="right" />
        </el-table>
      </div>
      <div class="pk-section">
        <div class="pk-h">消防 · 烟雾/氢气/灭火剂压力</div>
        <el-table :data="fakeData(selected, 'fire')" size="small" stripe>
          <el-table-column prop="t" label="时刻" width="90" />
          <el-table-column prop="smokeMg" label="烟雾 mg/m³" align="right" />
          <el-table-column prop="h2Ppm" label="H₂ ppm" align="right" />
          <el-table-column prop="pressure" label="灭火剂 MPa" align="right" />
          <el-table-column prop="detectorAlarm" label="探测器" align="center" />
        </el-table>
      </div>
      <div class="pk-section">
        <div class="pk-h">环境 · 舱内温湿度/VOC</div>
        <el-table :data="fakeData(selected, 'env')" size="small" stripe>
          <el-table-column prop="t" label="时刻" width="90" />
          <el-table-column prop="cabinTempC" label="舱温 ℃" align="right" />
          <el-table-column prop="humidityPct" label="湿度 %" align="right" />
          <el-table-column prop="vocPpm" label="VOC ppm" align="right" />
        </el-table>
      </div>
      <div class="pk-section">
        <div class="pk-h">运维操作记录</div>
        <el-table :data="fakeData(selected, 'ops')" size="small" stripe>
          <el-table-column prop="t" label="时刻" width="90" />
          <el-table-column prop="op" label="操作" />
          <el-table-column prop="by" label="操作员" />
          <el-table-column prop="result" label="结果" width="120" />
        </el-table>
      </div>
    </el-drawer>

    <!-- 视频证据 dialog -->
    <el-dialog v-model="videoDialog" :title="`视频证据 - ${selected.id}`" width="720">
      <div class="vid-tip">事故前后 ±5 分钟视频录像（已固化）· 点击复制 RTSP 拉流地址</div>
      <div class="vid-grid">
        <div class="vid-cell" v-for="v in videoSources" :key="v.cam">
          <div class="vid-thumb">
            <el-icon><VideoCamera /></el-icon>
            <div class="vid-overlay">{{ selected.time }}</div>
          </div>
          <div class="vid-meta">
            <div class="vid-cam">{{ v.cam }}</div>
            <code class="vid-uri" @click="navigator.clipboard?.writeText(v.uri); ElMessage.success('已复制')">{{ v.uri }}</code>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.query {
  display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;
}
.qt {
  margin-left: auto; display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: $text-muted;
  b { color: $brand-blue; }
}
.card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px; box-shadow: $shadow-card;
}
.title { font-size: 14px; font-weight: 600; margin-bottom: 14px; }

.layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; align-items: flex-start; }

.case { max-height: calc(100vh - 220px); overflow: auto; }
.case-item {
  padding: 12px 14px; border-radius: 8px; cursor: pointer; margin-bottom: 8px;
  border-left: 3px solid transparent;
  transition: background 0.15s;
  &:hover { background: $bg-soft; }
  &.active { background: rgba(239, 68, 68, 0.06); border-left-color: #ef4444; }
}
.ci-row { display: flex; justify-content: space-between; align-items: center; }
.ci-id { font-family: monospace; font-size: 12px; color: $text-muted; }
.ci-name { font-size: 14px; font-weight: 600; margin: 6px 0 4px; }
.ci-meta { font-size: 12px; color: $text-secondary; }
.ci-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 6px; }
.ci-time { font-size: 11px; color: $text-muted; }
.ci-status { font-size: 10px; padding: 2px 7px; border-radius: 9px; color: #fff; font-weight: 500; }
.case-empty { padding: 24px; text-align: center; color: $text-muted; font-size: 13px;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
}

.main { display: flex; flex-direction: column; gap: 16px; }

.case-head { background: linear-gradient(135deg, #fff 0%, #fff5f5 100%); }
.ch-left { margin-bottom: 16px; }
.ch-id { font-family: monospace; font-size: 12px; color: $text-muted; }
.ch-title { display: flex; align-items: center; gap: 8px; font-size: 20px; font-weight: 600; margin: 4px 0; }
.ch-title .warn { color: #ef4444; }
.ch-sub { font-size: 13px; color: $text-secondary; }
.ch-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; padding-top: 16px; border-top: 1px solid $border-soft; }
.cs-l { font-size: 12px; color: $text-muted; }
.cs-v { font-size: 14px; font-weight: 600; margin-top: 4px; }
.ch-ops { display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap; }

.timeline {
  display: grid; gap: 0;
  position: relative;
  &::before {
    content: '';
    position: absolute; top: 12px; left: 4%; right: 4%; height: 2px;
    background: linear-gradient(90deg, $brand-cyan, #ef4444, $brand-blue, #22d3a0);
  }
}
.tl-item { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; position: relative; padding: 0 4px; }
.tl-dot {
  width: 16px; height: 16px; border-radius: 50%;
  position: relative; z-index: 2;
  border: 3px solid #fff;
}
.tl-time { font-family: monospace; font-size: 12px; color: $text-secondary; font-weight: 600; }
.tl-label { font-size: 11px; line-height: 1.4; max-width: 110px; }

.dual { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* === 关联 === */
.rel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
.rc-h { font-size: 12px; color: $text-muted; margin-bottom: 10px; font-weight: 600; }
.rc-list { display: flex; flex-direction: column; gap: 6px; }
.rc-item {
  display: flex; align-items: center; gap: 8px; padding: 8px 10px;
  background: $bg-soft; border-radius: 6px; font-size: 12px;
}
.rc-type { font-weight: 500; }
.rc-loc { color: $text-muted; font-size: 11px; flex: 1; }
.rc-t { font-family: $font-num; color: $text-muted; font-size: 11px; }
.rc-item.ev .rc-evid { font-family: $font-num; color: $brand-blue; min-width: 70px; }
.rc-hash { font-family: monospace; color: $brand-blue; font-size: 11px; flex: 1; }
.rc-block { font-family: monospace; color: $text-muted; font-size: 11px; }
.rc-empty { padding: 16px; text-align: center; color: $text-muted; font-size: 12px; background: $bg-soft; border-radius: 6px; }

.root-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.rg-l { font-size: 12px; color: $text-muted; }
.rg-v { font-size: 14px; margin-top: 6px; font-weight: 500; }
.root-alert { margin-bottom: 16px; }
.root-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }

/* === 进度对话框 === */
.vf-list { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.vf-step {
  display: grid; grid-template-columns: 28px 1fr auto;
  align-items: center; gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-soft; border-radius: 8px;
  background: $bg-card;
  transition: background 0.2s, border-color 0.2s;
  &.running { background: rgba(1,94,234,0.04); border-color: rgba(1,94,234,0.3); }
  &.ok      { background: rgba(34,211,160,0.04); border-color: rgba(34,211,160,0.25); }
}
.vf-icon { display: flex; align-items: center; justify-content: center; }
.vf-spin :deep(svg) { animation: vfspin 0.9s linear infinite; }
@keyframes vfspin { to { transform: rotate(360deg); } }
.vf-l { font-size: 13px; }
.vf-t { font-size: 11px; color: $text-muted;
  .vf-step.ok & { color: #22d3a0; font-weight: 600; }
  .vf-step.running & { color: #015eea; }
}
.vf-result {
  margin-top: 12px; padding: 10px 14px;
  background: rgba(34,211,160,0.08); border-radius: 8px;
  font-size: 13px; color: $text-secondary;
  display: flex; align-items: center; gap: 8px;
}

/* === 数据包 drawer === */
.pk-section { margin-bottom: 20px; }
.pk-h { font-size: 12px; color: $text-muted; margin-bottom: 8px; font-weight: 600; }

/* === Video dialog === */
.vid-tip { font-size: 12px; color: $text-muted; margin-bottom: 12px; }
.vid-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.vid-cell {
  background: $bg-card; border: 1px solid $border-soft; border-radius: 8px; overflow: hidden;
}
.vid-thumb {
  height: 140px; background: #10152e; color: #4a5276;
  display: flex; align-items: center; justify-content: center; position: relative;
  .el-icon { font-size: 40px; }
}
.vid-overlay { position: absolute; bottom: 8px; right: 10px; font-family: monospace; font-size: 11px; color: #4a5276; }
.vid-meta { padding: 8px 12px; }
.vid-cam { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
.vid-uri { font-family: monospace; font-size: 11px; color: $brand-blue; cursor: pointer;
  background: $bg-soft; padding: 2px 6px; border-radius: 4px; display: inline-block;
  &:hover { background: rgba(1,94,234,0.1); }
}

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .timeline { grid-template-columns: repeat(2, 1fr) !important; gap: 12px; &::before { display: none; } }
  .dual, .ch-stats, .root-grid, .rel-grid, .vid-grid { grid-template-columns: 1fr 1fr; }
}
</style>
