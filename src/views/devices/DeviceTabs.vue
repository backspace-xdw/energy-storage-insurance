<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import echarts from '@/utils/echarts'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { DataLine, Histogram, List, Refresh, Document, View, Grid, Star, StarFilled, Lock } from '@element-plus/icons-vue'
import { useDevicesPrefStore } from '@/stores/devicesPref'
import PackCompareDialog from './PackCompareDialog.vue'

const props = defineProps({
  detail: { type: Object, required: true },
  activeTab: { type: String, default: 'realtime' }
})
const emit = defineEmits(['update:activeTab'])

const prefStore = useDevicesPrefStore()
const activeTab = computed({
  get: () => props.activeTab,
  set: (v) => emit('update:activeTab', v)
})
const histRange = ref('24h')

/* ---------- PACK 列表（station/cabin/cluster 才有） ---------- */
const packList = computed(() => {
  const n = props.detail.node
  if (!n) return []
  const out = []
  function walk(node, path) {
    if (node.type === 'pack') {
      out.push({
        id: node.id,
        path,
        label: node.label,
        ...node.info,
        tempDelta: +(node.info.temperatureMax - node.info.temperatureMin).toFixed(1),
        voltDelta: Math.round((node.info.cellVoltageMax - node.info.cellVoltageMin) * 1000)
      })
      return
    }
    node.children?.forEach(c => walk(c, path ? path + ' / ' + node.label : node.label))
  }
  walk(n, '')
  return out
})
const hasPackList = computed(() => packList.value.length > 0 && props.detail.type !== 'pack')

function packHealth(p) {
  if (p.soh < 90 || p.temperatureMax > 38) return 'err'
  if (p.soh < 93 || p.temperatureMax > 35 || p.voltDelta > 50) return 'warn'
  return 'ok'
}
function rowClass({ row }) {
  return 'row-' + packHealth(row)
}

const packSearch = ref('')
const packFilter = ref('')
const onlyFav = ref(false)
const filteredPacks = computed(() =>
  packList.value.filter(p =>
    (!packSearch.value || p.label.includes(packSearch.value) || p.path.includes(packSearch.value)) &&
    (!packFilter.value || packHealth(p) === packFilter.value) &&
    (!onlyFav.value || prefStore.isFavorite(p.id))
  )
)

/* ---------- 多选 + 对比 ---------- */
const compareSelection = ref([])
const compareDialog = ref(false)
function handleSelectionChange(rows) {
  // 限制最多 4 个
  if (rows.length > 4) {
    ElMessage.warning('对比最多支持 4 个 PACK')
    // 不直接修改 selection，UI 上保留全部勾选；提示用户取消多余
  }
  compareSelection.value = rows
}
function openCompare() {
  if (compareSelection.value.length < 2) {
    ElMessage.info('请至少勾选 2 个 PACK')
    return
  }
  compareDialog.value = true
}

function exportPacks() {
  const rows = filteredPacks.value
  if (!rows.length) { ElMessage.warning('无可导出数据'); return }
  const fields = ['id', 'path', 'label', 'voltage', 'current', 'soc', 'soh', 'temperatureMax', 'temperatureMin', 'tempDelta', 'cellVoltageMax', 'cellVoltageMin', 'voltDelta', 'insulation', 'faultCode']
  const header = ['编号', '层级路径', '标签', 'PACK电压V', '电流A', 'SOC%', 'SOH%', '最高温℃', '最低温℃', '温差℃', '电芯最高V', '电芯最低V', '压差mV', '绝缘kΩ', '故障码']
  const csv = [header.join(',')]
  rows.forEach(r => {
    csv.push(fields.map(f => {
      const v = r[f]
      const s = v === undefined || v === null ? '' : String(v).replace(/"/g, '""')
      return /[,"\n]/.test(s) ? `"${s}"` : s
    }).join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.detail.label}-PACK清单-${dayjs().format('YYYY-MM-DD')}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${rows.length} 条 PACK 数据`)
}

/* ---------- 剩余寿命预测 (PACK) ---------- */
const ANNUAL_DEGRADATION = 1.5  // %/year，LFP 储能典型
const EOL_THRESHOLD = 80
const lifePrediction = computed(() => {
  if (props.detail.type !== 'pack') return null
  const info = props.detail.info
  if (!info) return null
  const soh = info.soh
  if (soh <= EOL_THRESHOLD) {
    return {
      soh, threshold: EOL_THRESHOLD,
      degRate: ANNUAL_DEGRADATION,
      remainingYears: 0,
      eolDate: '已达 EOL',
      level: 'err',
      hint: `健康度 ${soh}% 已低于 EOL 阈值 ${EOL_THRESHOLD}%，建议安排更换或退役评估`
    }
  }
  const remainingYears = (soh - EOL_THRESHOLD) / ANNUAL_DEGRADATION
  const eolDate = dayjs().add(remainingYears, 'year')
  const level = remainingYears < 2 ? 'err' : remainingYears < 5 ? 'warn' : 'ok'
  return {
    soh, threshold: EOL_THRESHOLD,
    degRate: ANNUAL_DEGRADATION,
    remainingYears: +remainingYears.toFixed(1),
    eolDate: eolDate.format('YYYY-MM'),
    level,
    hint: level === 'err'
      ? '剩余寿命较短，建议纳入近期续保重点评估'
      : level === 'warn'
        ? '寿命衰减进入中期，需关注循环深度'
        : '健康度良好，寿命充裕'
  }
})

/* ---------- 保单关联面板 ---------- */
const policyMeta = computed(() => {
  const info = props.detail.info
  if (props.detail.type !== 'station' || !info) return null
  const start = dayjs(info.onlineDate)
  const end = start.add(1, 'year')
  const now = dayjs()
  const days = end.diff(now, 'day')
  return {
    no: info.insurancePolicy,
    status: info.insuranceStatus,
    start: start.format('YYYY-MM-DD'),
    end: end.format('YYYY-MM-DD'),
    days,
    daysClass: days < 0 ? 'err' : days < 30 ? 'warn' : days < 90 ? 'mid' : 'ok',
    daysLabel: days < 0 ? `已过期 ${-days} 天` : `剩余 ${days} 天`,
    coverage: info.coverage,
    annualPremium: info.annualPremium,
    alarmCount30d: info.alarmCount30d,
    severeAlarm30d: info.severeAlarm30d,
    inspectionRate: info.inspectionRate,
    rectifyRate: info.rectifyRate
  }
})

function exportTrendCSV() {
  const { labels, series } = genSeries(histRange.value, props.detail.type)
  const header = ['时间', ...series.map(s => s.name)]
  const csv = [header.join(',')]
  labels.forEach((t, i) => {
    csv.push([t, ...series.map(s => s.data[i])].join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${props.detail.label}-${histRange.value}-${dayjs().format('YYYY-MM-DD-HHmm')}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${labels.length} 行历史数据`)
}

/* ---------- 详情字段映射 ---------- */
const typeLabel = (t) => ({ station: '站点', cabin: '舱级', cluster: '簇级', pack: 'PACK 级' }[t] || '设备')

/* ---------- 历史曲线 ---------- */
const trendEl = ref(null)
let trendChart = null

function genSeries(rangeKey, type) {
  const cfg = { '24h': { n: 96, step: 15, fmt: 'HH:mm' }, '7d': { n: 84, step: 120, fmt: 'MM-DD HH:mm' }, '30d': { n: 90, step: 480, fmt: 'MM-DD' } }[rangeKey]
  const baseTime = dayjs().subtract(cfg.n * cfg.step, 'minute')
  const labels = Array.from({ length: cfg.n }, (_, i) => baseTime.add(i * cfg.step, 'minute').format(cfg.fmt))
  const noise = (a) => a + (Math.random() - 0.5) * 0.4
  // 不同类型给不同维度
  if (type === 'pack') {
    return {
      labels,
      series: [
        { name: 'PACK 电压(V)', color: '#015eea', data: labels.map(() => +noise(47.3).toFixed(2)) },
        { name: '电芯最高(V)', color: '#06b6d4', data: labels.map(() => +noise(3.36).toFixed(3)) },
        { name: '电芯最低(V)', color: '#6366f1', data: labels.map(() => +noise(3.31).toFixed(3)) },
        { name: '最高温(℃)',   color: '#ef4444', data: labels.map((_, i) => +(29 + Math.sin(i / 12) * 3 + Math.random() * 0.8).toFixed(1)), yAxis: 1 },
        { name: 'SOC(%)',     color: '#22d3a0', data: labels.map((_, i) => +(50 + Math.sin(i / 8) * 28 + Math.random() * 2).toFixed(1)), yAxis: 1 }
      ]
    }
  }
  if (type === 'cluster') {
    return {
      labels,
      series: [
        { name: '簇电压(V)', color: '#015eea', data: labels.map(() => +noise(760).toFixed(1)) },
        { name: '簇电流(A)', color: '#6366f1', data: labels.map((_, i) => +(80 * Math.sin(i / 10) + (Math.random() - 0.5) * 8).toFixed(1)) },
        { name: '功率(kW)',  color: '#06b6d4', data: labels.map((_, i) => +(60 * Math.sin(i / 10) + (Math.random() - 0.5) * 6).toFixed(1)) },
        { name: '绝缘(kΩ)',  color: '#22d3a0', data: labels.map(() => Math.floor(4500 + Math.random() * 1000)), yAxis: 1 }
      ]
    }
  }
  if (type === 'cabin') {
    return {
      labels,
      series: [
        { name: '舱内温度(℃)', color: '#ef4444', data: labels.map((_, i) => +(25 + Math.sin(i / 14) * 2 + Math.random() * 0.6).toFixed(1)) },
        { name: '舱内湿度(%)', color: '#06b6d4', data: labels.map(() => Math.floor(40 + Math.random() * 12)) },
        { name: 'H₂(ppm)',    color: '#f59e0b', data: labels.map(() => Math.floor(Math.random() * 30)), yAxis: 1 },
        { name: 'VOC(ppm)',   color: '#6366f1', data: labels.map(() => Math.floor(Math.random() * 80)), yAxis: 1 }
      ]
    }
  }
  // station
  return {
    labels,
    series: [
      { name: '负荷功率(MW)', color: '#015eea', data: labels.map((_, i) => +(15 * Math.sin(i / 10) + (Math.random() - 0.5) * 3).toFixed(1)) },
      { name: '总告警数',     color: '#ef4444', data: labels.map(() => Math.floor(Math.random() * 4)), yAxis: 1 },
      { name: '风险指数',     color: '#22d3a0', data: labels.map(() => +(80 + (Math.random() - 0.5) * 8).toFixed(1)), yAxis: 1 }
    ]
  }
}

function renderTrend() {
  if (!trendChart) return
  const { labels, series } = genSeries(histRange.value, props.detail.type)
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { fontSize: 12 } },
    grid: { left: 50, right: 56, top: 36, bottom: 30 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#525c75', fontSize: 11, interval: Math.floor(labels.length / 10) } },
    yAxis: [
      { type: 'value', splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 11 } },
      { type: 'value', position: 'right', splitLine: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 } }
    ],
    series: series.map(s => ({
      name: s.name, type: 'line', smooth: true, showSymbol: false,
      yAxisIndex: s.yAxis || 0,
      data: s.data,
      lineStyle: { color: s.color, width: 2 },
      itemStyle: { color: s.color },
      areaStyle: s.name.includes('电压') || s.name.includes('功率') ? { color: s.color + '20' } : undefined
    }))
  }, true)
}

/* ---------- 单体分布 ---------- */
const distEl = ref(null)
let distChart = null

function getDistData() {
  const t = props.detail.type
  if (t === 'pack') {
    // 104 节电芯
    return Array.from({ length: 104 }, (_, i) => ({ id: 'C-' + String(i + 1).padStart(3, '0'), v: +(3.30 + Math.random() * 0.08).toFixed(3) }))
  }
  if (t === 'cluster') {
    // 16 个 PACK
    return Array.from({ length: 16 }, (_, i) => ({ id: 'PACK-' + String(i + 1).padStart(2, '0'), v: +(47 + Math.random() * 1.2).toFixed(2) }))
  }
  if (t === 'cabin') {
    // 4 个簇
    return Array.from({ length: 4 }, (_, i) => ({ id: `${i + 1}#簇`, v: +(750 + Math.random() * 30).toFixed(1) }))
  }
  // station: 各舱平均电压
  return Array.from({ length: props.detail.info?.cabins || 5 }, (_, i) => ({ id: `${i + 1}#舱`, v: +(48 + Math.random() * 6).toFixed(1) }))
}

const unitLabel = computed(() => ({ pack: 'V (单体)', cluster: 'V (PACK)', cabin: 'V (簇)', station: 'kW (舱)' }[props.detail.type]))

function renderDist() {
  if (!distChart) return
  const data = getDistData()
  const vs = data.map(d => d.v)
  const avg = vs.reduce((a, b) => a + b, 0) / vs.length
  const max = Math.max(...vs), min = Math.min(...vs)
  distChart.setOption({
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: (p) => `${data[p[0].dataIndex].id}<br/>${p[0].marker} <b>${p[0].value} ${unitLabel.value.split(' ')[0]}</b>`
    },
    grid: { left: 50, right: 24, top: 34, bottom: 30 },
    xAxis: {
      type: 'category', data: data.map(d => d.id),
      axisLabel: { color: '#8a93a8', fontSize: 10, interval: Math.max(0, Math.floor(data.length / 16)) },
      axisLine: { lineStyle: { color: '#dadfeb' } }
    },
    yAxis: {
      type: 'value', name: unitLabel.value, nameTextStyle: { color: '#8a93a8', fontSize: 11 },
      min: min - (max - min) * 0.2, max: max + (max - min) * 0.2,
      splitLine: { lineStyle: { color: '#eef0f7' } },
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    series: [{
      type: 'bar', barWidth: '85%', data: vs,
      itemStyle: {
        color: (p) => {
          const v = p.value
          if (v < avg - (max - min) * 0.4) return '#ef4444'
          if (v < avg - (max - min) * 0.2) return '#f59e0b'
          if (v > avg + (max - min) * 0.4) return '#06b6d4'
          return '#015eea'
        }
      },
      markLine: {
        symbol: 'none',
        data: [{ type: 'average', name: '平均', lineStyle: { color: '#22d3a0', type: 'dashed', width: 1.5 }, label: { formatter: '均值', color: '#22d3a0', position: 'end' } }]
      }
    }]
  }, true)
}

const distStats = computed(() => {
  const data = getDistData()
  const vs = data.map(d => d.v)
  const avg = vs.reduce((a, b) => a + b, 0) / vs.length
  const max = Math.max(...vs), min = Math.min(...vs)
  return {
    count: data.length,
    max: max.toFixed(3),
    min: min.toFixed(3),
    avg: avg.toFixed(3),
    delta: ((max - min) * (props.detail.type === 'pack' ? 1000 : 1)).toFixed(props.detail.type === 'pack' ? 0 : 2),
    unit: props.detail.type === 'pack' ? 'mV' : unitLabel.value.split(' ')[0]
  }
})

/* ---------- 事件日志 ---------- */
const events = computed(() => {
  const base = props.detail.label
  const types = {
    pack: [
      { t: 'warn', icon: '!', title: '单体压差告警', desc: 'PACK 内最大压差 52mV，超过预警阈值 50mV', time: '2026-05-17 14:08:23', status: '已恢复' },
      { t: 'info', icon: 'i', title: '健康度更新', desc: 'SOH 由 95.2% → 94.8%（年衰减率 4.5%）', time: '2026-05-15 02:00:00', status: '记录' },
      { t: 'ok',   icon: '✓', title: '完成均衡', desc: '主动均衡完成，压差由 48mV → 22mV', time: '2026-05-12 03:42:10', status: '正常' },
      { t: 'warn', icon: '!', title: '温度偏高', desc: '最高温 37.2℃ 接近告警阈值', time: '2026-05-08 16:21:55', status: '已恢复' }
    ],
    cluster: [
      { t: 'warn', icon: '!', title: '充电电流异常波动', desc: '簇电流 5 秒内从 85A → 32A → 78A，已自检', time: '2026-05-17 11:42:08', status: '已恢复' },
      { t: 'info', icon: 'i', title: '日报生成', desc: '日充放电量 62.4 MWh / 循环次数 1 次', time: '2026-05-17 00:05:00', status: '记录' },
      { t: 'ok',   icon: '✓', title: '巡检完成', desc: '运维人员张三完成簇级巡检，无异常', time: '2026-05-15 10:18:00', status: '正常' }
    ],
    cabin: [
      { t: 'warn', icon: '!', title: '舱内温度偏高', desc: '舱内温度 28.4℃ 超过设定值 27℃ 持续 12 分钟', time: '2026-05-17 13:35:00', status: '已恢复' },
      { t: 'err',  icon: '×', title: '消防探测器故障（已修）', desc: 'P3 烟感探测器通讯中断 → 已更换', time: '2026-05-10 09:18:42', status: '已修复' },
      { t: 'ok',   icon: '✓', title: '年度消防检查', desc: '灭火剂压力 12.3 MPa，瓶组完好', time: '2026-04-22 14:00:00', status: '正常' }
    ],
    station: [
      { t: 'info', icon: 'i', title: '保单生效', desc: `保单 ${props.detail.info?.insurancePolicy || ''} 已生效`, time: '2026-01-15 00:00:00', status: '记录' },
      { t: 'ok',   icon: '✓', title: '年度风险评估', desc: `风险评分 ${props.detail.info?.riskScore || 0}（低风险）`, time: '2026-04-01 10:00:00', status: '正常' },
      { t: 'warn', icon: '!', title: '隐患整改', desc: '舱外电缆桥架松动 → 已加固', time: '2026-03-28 15:22:00', status: '已闭环' },
      { t: 'info', icon: 'i', title: '巡检任务', desc: '本月完成例行巡检 4 次，合格率 100%', time: '2026-04-30 18:00:00', status: '记录' }
    ]
  }
  return types[props.detail.type] || []
})

/* ---------- 切换 / 生命周期 ---------- */
function initChartsIfNeeded() {
  nextTick(() => {
    if (activeTab.value === 'history' && trendEl.value && !trendChart) {
      trendChart = echarts.init(trendEl.value); renderTrend()
    }
    if (activeTab.value === 'dist' && distEl.value && !distChart) {
      distChart = echarts.init(distEl.value); renderDist()
    }
  })
}

watch(activeTab, () => initChartsIfNeeded())
watch(histRange, () => renderTrend())
watch(() => props.detail, () => {
  trendChart?.dispose(); trendChart = null
  distChart?.dispose(); distChart = null
  initChartsIfNeeded()
}, { deep: false })

function onResize() { trendChart?.resize(); distChart?.resize() }

onMounted(() => {
  window.addEventListener('resize', onResize)
  initChartsIfNeeded()
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  trendChart?.dispose(); distChart?.dispose()
})
</script>

<template>
  <div class="dt">
    <el-tabs v-model="activeTab" class="dt-tabs">
      <el-tab-pane name="realtime">
        <template #label>
          <span class="t-l"><el-icon><View /></el-icon> 实时数据</span>
        </template>
        <div class="tp">
          <template v-if="detail.type === 'station'">
            <div class="policy-card" v-if="policyMeta">
              <div class="pc-head">
                <div class="pc-title">
                  <el-icon style="color:#015eea"><Lock /></el-icon>
                  保单与承保信息
                </div>
                <el-tag :type="policyMeta.status === '已承保' ? 'success' : policyMeta.status === '待续保' ? 'warning' : 'info'" size="small">{{ policyMeta.status }}</el-tag>
              </div>
              <div class="pc-grid">
                <div class="pc-cell">
                  <div class="pc-l">保单编号</div>
                  <div class="pc-v mono">{{ policyMeta.no }}</div>
                </div>
                <div class="pc-cell">
                  <div class="pc-l">承保期间</div>
                  <div class="pc-v">{{ policyMeta.start }} → {{ policyMeta.end }}</div>
                </div>
                <div class="pc-cell">
                  <div class="pc-l">剩余天数</div>
                  <div class="pc-v" :class="policyMeta.daysClass">{{ policyMeta.daysLabel }}</div>
                </div>
                <div class="pc-cell">
                  <div class="pc-l">承保金额</div>
                  <div class="pc-v">{{ policyMeta.coverage }}</div>
                </div>
                <div class="pc-cell">
                  <div class="pc-l">年保费</div>
                  <div class="pc-v">{{ policyMeta.annualPremium }}</div>
                </div>
                <div class="pc-cell">
                  <div class="pc-l">30 天告警</div>
                  <div class="pc-v">{{ policyMeta.alarmCount30d }} 次<span v-if="policyMeta.severeAlarm30d > 0" class="severe">含严重 {{ policyMeta.severeAlarm30d }}</span></div>
                </div>
                <div class="pc-cell">
                  <div class="pc-l">巡检合格率</div>
                  <div class="pc-v ok">{{ policyMeta.inspectionRate }}%</div>
                </div>
                <div class="pc-cell">
                  <div class="pc-l">隐患整改率</div>
                  <div class="pc-v">{{ policyMeta.rectifyRate }}%</div>
                </div>
              </div>
            </div>
            <el-descriptions :column="3" border size="default" class="desc">
              <el-descriptions-item label="站点编号">{{ detail.info.id }}</el-descriptions-item>
              <el-descriptions-item label="所在位置">{{ detail.info.location }}</el-descriptions-item>
              <el-descriptions-item label="投运日期">{{ detail.info.onlineDate }}</el-descriptions-item>
              <el-descriptions-item label="总容量">{{ detail.info.capacityMWh }} MWh / {{ detail.info.powerMW }} MW</el-descriptions-item>
              <el-descriptions-item label="主设备厂家">{{ detail.info.vendor }}</el-descriptions-item>
              <el-descriptions-item label="消防配置">{{ detail.info.fireSystem }}</el-descriptions-item>
              <el-descriptions-item label="舱 / 簇 / PACK">{{ detail.info.cabins }} / {{ detail.info.clusters }} / {{ detail.info.packs }}</el-descriptions-item>
              <el-descriptions-item label="平均 SOH">{{ detail.info.soh }} %</el-descriptions-item>
              <el-descriptions-item label="风险评分">
                <el-tag :type="detail.info.riskScore >= 90 ? 'success' : detail.info.riskScore >= 75 ? 'primary' : 'warning'" size="small">{{ detail.info.riskScore }} 分</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="保单编号">{{ detail.info.insurancePolicy }}</el-descriptions-item>
              <el-descriptions-item label="保险状态">{{ detail.info.insuranceStatus }}</el-descriptions-item>
              <el-descriptions-item label="年保费">{{ detail.info.annualPremium }}</el-descriptions-item>
              <el-descriptions-item label="承保金额">{{ detail.info.coverage }}</el-descriptions-item>
              <el-descriptions-item label="30天告警">{{ detail.info.alarmCount30d }} 次（严重 {{ detail.info.severeAlarm30d }}）</el-descriptions-item>
              <el-descriptions-item label="巡检合格率">{{ detail.info.inspectionRate }} %</el-descriptions-item>
            </el-descriptions>
            <div class="sub-title">承保设备结构</div>
            <div class="hierarchy">
              <div class="hi-item"><div class="hi-icon" style="background:#015eea">站</div><div><div class="hi-l">站点</div><div class="hi-v">1</div></div></div>
              <div class="hi-arrow">→</div>
              <div class="hi-item"><div class="hi-icon" style="background:#06b6d4">舱</div><div><div class="hi-l">舱体</div><div class="hi-v">{{ detail.info.cabins }}</div></div></div>
              <div class="hi-arrow">→</div>
              <div class="hi-item"><div class="hi-icon" style="background:#6366f1">簇</div><div><div class="hi-l">电池簇</div><div class="hi-v">{{ detail.info.clusters }}</div></div></div>
              <div class="hi-arrow">→</div>
              <div class="hi-item"><div class="hi-icon" style="background:#22d3a0">P</div><div><div class="hi-l">PACK</div><div class="hi-v">{{ detail.info.packs }}</div></div></div>
            </div>
          </template>

          <template v-if="detail.type === 'cabin'">
            <el-descriptions :column="3" border class="desc">
              <el-descriptions-item label="舱内温度">{{ detail.info.temperature }} ℃</el-descriptions-item>
              <el-descriptions-item label="舱内湿度">{{ detail.info.humidity }} %</el-descriptions-item>
              <el-descriptions-item label="烟雾浓度">{{ detail.info.smoke }} mg/m³</el-descriptions-item>
              <el-descriptions-item label="H₂ 浓度">{{ detail.info.h2 }} ppm</el-descriptions-item>
              <el-descriptions-item label="VOC">{{ detail.info.voc }} ppm</el-descriptions-item>
              <el-descriptions-item label="灭火剂压力">{{ detail.info.gasPressure }} MPa</el-descriptions-item>
              <el-descriptions-item label="消防状态">
                <el-tag type="success" size="small">{{ detail.info.fireStatus }}</el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </template>

          <template v-if="detail.type === 'cluster'">
            <el-descriptions :column="3" border class="desc">
              <el-descriptions-item label="簇电压">{{ detail.info.voltage }} V</el-descriptions-item>
              <el-descriptions-item label="簇电流">{{ detail.info.current }} A</el-descriptions-item>
              <el-descriptions-item label="绝缘电阻">{{ detail.info.insulation }} kΩ</el-descriptions-item>
              <el-descriptions-item label="功率">{{ detail.info.power }} kW</el-descriptions-item>
              <el-descriptions-item label="日充放电">{{ detail.info.dailyEnergy }} MWh</el-descriptions-item>
              <el-descriptions-item label="断路器">{{ detail.info.breakerStatus }}</el-descriptions-item>
            </el-descriptions>
          </template>

          <template v-if="detail.type === 'pack'">
            <div class="life-card" v-if="lifePrediction" :class="lifePrediction.level">
              <div class="lc-head">
                <div class="lc-title">
                  <el-icon><DataLine /></el-icon>
                  剩余寿命预测
                </div>
                <div class="lc-tag" :class="lifePrediction.level">
                  {{ lifePrediction.level === 'err' ? '⚠ 临近 EOL' : lifePrediction.level === 'warn' ? '关注' : '健康' }}
                </div>
              </div>
              <div class="lc-body">
                <div class="lc-main">
                  <div class="lc-num">{{ lifePrediction.remainingYears }}</div>
                  <div class="lc-unit">年</div>
                </div>
                <div class="lc-sub">
                  <div>当前 SOH <b>{{ lifePrediction.soh }}%</b> · 年衰减按 {{ lifePrediction.degRate }}% 估算</div>
                  <div>预计达 {{ lifePrediction.threshold }}% (EOL)：<b>{{ lifePrediction.eolDate }}</b></div>
                  <div class="lc-hint">{{ lifePrediction.hint }}</div>
                </div>
              </div>
            </div>
            <el-descriptions :column="3" border class="desc">
              <el-descriptions-item label="PACK 电压">{{ detail.info.voltage }} V</el-descriptions-item>
              <el-descriptions-item label="PACK 电流">{{ detail.info.current }} A</el-descriptions-item>
              <el-descriptions-item label="最高温度">{{ detail.info.temperatureMax }} ℃</el-descriptions-item>
              <el-descriptions-item label="最低温度">{{ detail.info.temperatureMin }} ℃</el-descriptions-item>
              <el-descriptions-item label="电芯最高">{{ detail.info.cellVoltageMax }} V</el-descriptions-item>
              <el-descriptions-item label="电芯最低">{{ detail.info.cellVoltageMin }} V</el-descriptions-item>
              <el-descriptions-item label="SOC">{{ detail.info.soc }} %</el-descriptions-item>
              <el-descriptions-item label="SOH">{{ detail.info.soh }} %</el-descriptions-item>
              <el-descriptions-item label="绝缘电阻">{{ detail.info.insulation }} kΩ</el-descriptions-item>
              <el-descriptions-item label="故障代码">{{ detail.info.faultCode }}</el-descriptions-item>
            </el-descriptions>
          </template>
        </div>
      </el-tab-pane>

      <el-tab-pane name="history">
        <template #label>
          <span class="t-l"><el-icon><DataLine /></el-icon> 历史曲线</span>
        </template>
        <div class="tp">
          <div class="trend-head">
            <el-radio-group v-model="histRange" size="small">
              <el-radio-button value="24h">近 24 小时</el-radio-button>
              <el-radio-button value="7d">近 7 天</el-radio-button>
              <el-radio-button value="30d">近 30 天</el-radio-button>
            </el-radio-group>
            <div class="th-right">
              <el-button size="small" :icon="Refresh" @click="renderTrend">刷新</el-button>
              <el-button size="small" :icon="Document" @click="exportTrendCSV">导出 CSV</el-button>
            </div>
          </div>
          <div class="trend-chart" ref="trendEl" />
          <div class="trend-summary">
            <div class="ts-item">
              <span class="ts-l">数据点数</span>
              <span class="ts-v">{{ histRange === '24h' ? 96 : histRange === '7d' ? 84 : 90 }}</span>
            </div>
            <div class="ts-item">
              <span class="ts-l">采样频率</span>
              <span class="ts-v">{{ histRange === '24h' ? '15 分钟' : histRange === '7d' ? '2 小时' : '8 小时' }}</span>
            </div>
            <div class="ts-item">
              <span class="ts-l">数据完整率</span>
              <span class="ts-v ok">99.8%</span>
            </div>
            <div class="ts-item">
              <span class="ts-l">数据来源</span>
              <span class="ts-v">BMS · OPC UA · MQTT</span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="dist">
        <template #label>
          <span class="t-l"><el-icon><Histogram /></el-icon> 单体分布</span>
        </template>
        <div class="tp">
          <div class="dist-kpis">
            <div class="dk"><div class="dk-l">单元数</div><div class="dk-v">{{ distStats.count }}</div></div>
            <div class="dk"><div class="dk-l">最大值</div><div class="dk-v" style="color:#06b6d4">{{ distStats.max }}</div></div>
            <div class="dk"><div class="dk-l">最小值</div><div class="dk-v" style="color:#ef4444">{{ distStats.min }}</div></div>
            <div class="dk"><div class="dk-l">平均值</div><div class="dk-v">{{ distStats.avg }}</div></div>
            <div class="dk"><div class="dk-l">极差</div><div class="dk-v" style="color:#f59e0b">{{ distStats.delta }} <small>{{ distStats.unit }}</small></div></div>
          </div>
          <div class="dist-chart" ref="distEl" />
          <div class="dist-legend">
            <span><i style="background:#ef4444" />显著偏低</span>
            <span><i style="background:#f59e0b" />偏低预警</span>
            <span><i style="background:#015eea" />正常</span>
            <span><i style="background:#06b6d4" />偏高</span>
            <span><i style="background:#22d3a0" />均值参考线</span>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane name="packs" v-if="hasPackList">
        <template #label>
          <span class="t-l"><el-icon><Grid /></el-icon> PACK 清单 ({{ packList.length }})</span>
        </template>
        <div class="tp">
          <div class="pl-head">
            <el-input v-model="packSearch" placeholder="搜索 PACK 编号/层级" clearable size="default" style="width:220px" />
            <el-radio-group v-model="packFilter" size="small">
              <el-radio-button value="">全部</el-radio-button>
              <el-radio-button value="ok">正常</el-radio-button>
              <el-radio-button value="warn">警示</el-radio-button>
              <el-radio-button value="err">异常</el-radio-button>
            </el-radio-group>
            <el-checkbox v-model="onlyFav" size="default">
              <el-icon style="color:#f59e0b;vertical-align:-2px"><StarFilled /></el-icon>
              仅看关注 ({{ prefStore.favoriteCount }})
            </el-checkbox>
            <div class="pl-spacer" />
            <el-button
              v-if="compareSelection.length > 0"
              size="default"
              type="primary"
              plain
              :icon="DataLine"
              :disabled="compareSelection.length < 2 || compareSelection.length > 4"
              @click="openCompare"
            >对比 ({{ compareSelection.length }})</el-button>
            <el-button size="default" :icon="Document" @click="exportPacks">导出 CSV ({{ filteredPacks.length }})</el-button>
          </div>
          <el-table
            :data="filteredPacks"
            stripe
            size="default"
            max-height="520"
            :row-class-name="rowClass"
            :default-sort="{ prop: 'temperatureMax', order: 'descending' }"
            row-key="id"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="42" :selectable="(row) => compareSelection.length < 4 || compareSelection.some(r => r.id === row.id)" />
            <el-table-column label="" width="44" align="center">
              <template #default="{ row }">
                <el-icon
                  class="fav-toggle"
                  :class="{ on: prefStore.isFavorite(row.id) }"
                  @click.stop="prefStore.toggleFavorite(row.id)"
                >
                  <StarFilled v-if="prefStore.isFavorite(row.id)" />
                  <Star v-else />
                </el-icon>
              </template>
            </el-table-column>
            <el-table-column label="健康度" width="80">
              <template #default="{ row }">
                <span class="pl-pill" :class="packHealth(row)">
                  <span class="pl-dot" />
                  {{ packHealth(row) === 'err' ? '异常' : packHealth(row) === 'warn' ? '警示' : '正常' }}
                </span>
              </template>
            </el-table-column>
            <el-table-column prop="path" label="层级路径" min-width="200" show-overflow-tooltip />
            <el-table-column prop="label" label="PACK" width="110" sortable />
            <el-table-column prop="voltage" label="电压(V)" width="100" align="right" sortable />
            <el-table-column prop="current" label="电流(A)" width="100" align="right" sortable>
              <template #default="{ row }">
                <span :class="row.current < 0 ? 'neg' : ''">{{ row.current }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="soc" label="SOC(%)" width="90" align="right" sortable />
            <el-table-column prop="soh" label="SOH(%)" width="90" align="right" sortable>
              <template #default="{ row }">
                <span :class="row.soh < 90 ? 'err' : row.soh < 93 ? 'warn' : ''">{{ row.soh }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="temperatureMax" label="最高温℃" width="100" align="right" sortable>
              <template #default="{ row }">
                <span :class="row.temperatureMax > 38 ? 'err' : row.temperatureMax > 35 ? 'warn' : ''">{{ row.temperatureMax }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="tempDelta" label="温差℃" width="90" align="right" sortable />
            <el-table-column prop="voltDelta" label="压差mV" width="100" align="right" sortable>
              <template #default="{ row }">
                <span :class="row.voltDelta > 80 ? 'err' : row.voltDelta > 50 ? 'warn' : ''">{{ row.voltDelta }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="insulation" label="绝缘kΩ" width="100" align="right" sortable />
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane name="events">
        <template #label>
          <span class="t-l"><el-icon><List /></el-icon> 事件日志</span>
        </template>
        <div class="tp">
          <div class="ev-list">
            <div class="ev-item" v-for="(e, i) in events" :key="i" :class="e.t">
              <div class="ev-dot">{{ e.icon }}</div>
              <div class="ev-body">
                <div class="ev-head">
                  <span class="ev-title">{{ e.title }}</span>
                  <el-tag size="small"
                    :type="e.t === 'err' ? 'danger' : e.t === 'warn' ? 'warning' : e.t === 'ok' ? 'success' : 'info'"
                  >{{ e.status }}</el-tag>
                </div>
                <div class="ev-desc">{{ e.desc }}</div>
                <div class="ev-time">{{ e.time }}</div>
              </div>
            </div>
            <div class="ev-empty" v-if="events.length === 0">暂无事件记录</div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <PackCompareDialog v-model="compareDialog" :packs="compareSelection" />
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.dt { width: 100%; }
.dt-tabs {
  :deep(.el-tabs__nav-wrap::after) { background-color: $border-soft; }
  :deep(.el-tabs__item) { font-size: 14px; height: 44px; line-height: 44px; }
}
.t-l { display: inline-flex; align-items: center; gap: 6px; }

.tp { padding: 8px 0; }

/* === 实时 === */
.desc { margin-bottom: 20px; }
.sub-title { font-size: 14px; font-weight: 600; margin: 14px 0 12px; color: $text-secondary; }
.hierarchy {
  display: flex; align-items: center; gap: 14px;
  background: $bg-soft; border-radius: $radius; padding: 18px 24px;
}
.hi-item { display: flex; align-items: center; gap: 10px; }
.hi-icon {
  width: 36px; height: 36px; border-radius: 8px; color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700;
}
.hi-l { font-size: 12px; color: $text-muted; }
.hi-v { font-size: 18px; font-weight: 600; }
.hi-arrow { color: $text-muted; font-size: 18px; }

/* === 历史 === */
.trend-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.th-right { display: flex; gap: 8px; }
.trend-chart { width: 100%; height: 360px; }
.trend-summary {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
  margin-top: 16px; padding-top: 16px; border-top: 1px solid $border-soft;
}
.ts-item { display: flex; flex-direction: column; gap: 4px; }
.ts-l { font-size: 12px; color: $text-muted; }
.ts-v { font-size: 14px; font-weight: 500; }
.ts-v.ok { color: #22d3a0; }

/* === 单体分布 === */
.dist-kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 14px; }
.dk { background: $bg-soft; border-radius: 8px; padding: 12px 16px; }
.dk-l { font-size: 12px; color: $text-muted; }
.dk-v {
  font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums;
  font-size: 20px; font-weight: 600; margin-top: 4px;
  small { font-size: 12px; color: $text-muted; font-weight: 400; }
}
.dist-chart { width: 100%; height: 320px; }
.dist-legend {
  display: flex; gap: 16px; flex-wrap: wrap;
  margin-top: 12px; padding-top: 12px; border-top: 1px solid $border-soft;
  font-size: 12px; color: $text-secondary;
  span { display: inline-flex; align-items: center; gap: 6px; }
  i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
}

/* === 事件 === */
.ev-list { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.ev-item {
  display: flex; gap: 14px; padding: 14px 16px;
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  border-left-width: 3px;
  transition: transform 0.15s, box-shadow 0.15s;
  &:hover { transform: translateX(2px); box-shadow: $shadow-card; }
  &.err { border-left-color: #ef4444; }
  &.warn { border-left-color: #f59e0b; }
  &.ok { border-left-color: #22d3a0; }
  &.info { border-left-color: #015eea; }
}
.ev-dot {
  width: 28px; height: 28px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; color: #fff;
  flex-shrink: 0;
  .err & { background: #ef4444; }
  .warn & { background: #f59e0b; }
  .ok & { background: #22d3a0; }
  .info & { background: #015eea; }
}
.ev-item.err .ev-dot { background: #ef4444; }
.ev-item.warn .ev-dot { background: #f59e0b; }
.ev-item.ok .ev-dot { background: #22d3a0; }
.ev-item.info .ev-dot { background: #015eea; }
.ev-body { flex: 1; min-width: 0; }
.ev-head { display: flex; justify-content: space-between; align-items: center; }
.ev-title { font-size: 14px; font-weight: 600; }
.ev-desc { font-size: 13px; color: $text-secondary; margin-top: 4px; line-height: 1.6; }
.ev-time { font-size: 11px; color: $text-muted; margin-top: 6px; font-family: $font-num; }
.ev-empty { padding: 40px; text-align: center; color: $text-muted; }

/* === PACK 清单 === */
.pl-head { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.pl-spacer { flex: 1; }
.pl-pill {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;
  &.ok { background: rgba(34,211,160,0.12); color: #16a085; }
  &.warn { background: rgba(245,158,11,0.14); color: #d97706; }
  &.err { background: rgba(239,68,68,0.12); color: #ef4444; }
}
.pl-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
:deep(.el-table .row-warn) { background: rgba(245,158,11,0.04) !important; }
:deep(.el-table .row-err)  { background: rgba(239,68,68,0.05) !important; }
.neg { color: #06b6d4; }
.warn { color: #f59e0b; }
.err { color: #ef4444; }
/* === 剩余寿命卡片 === */
.life-card {
  border-radius: $radius;
  padding: 16px 20px;
  margin-bottom: 18px;
  border: 1px solid rgba(34,211,160,0.25);
  background: linear-gradient(135deg, rgba(34,211,160,0.08) 0%, #fff 70%);
  border-left: 4px solid #22d3a0;
  &.warn { border-color: rgba(245,158,11,0.3); background: linear-gradient(135deg, rgba(245,158,11,0.08) 0%, #fff 70%); border-left-color: #f59e0b; }
  &.err  { border-color: rgba(239,68,68,0.3); background: linear-gradient(135deg, rgba(239,68,68,0.08) 0%, #fff 70%); border-left-color: #ef4444; }
}
.lc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.lc-title { font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;
  .el-icon { color: #22d3a0; }
  .life-card.warn & .el-icon { color: #f59e0b; }
  .life-card.err & .el-icon { color: #ef4444; }
}
.lc-tag { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500;
  &.ok { color: #22d3a0; background: rgba(34,211,160,0.12); }
  &.warn { color: #f59e0b; background: rgba(245,158,11,0.14); }
  &.err { color: #ef4444; background: rgba(239,68,68,0.12); }
}
.lc-body { display: grid; grid-template-columns: 140px 1fr; gap: 24px; align-items: center; }
.lc-main { display: flex; align-items: baseline; gap: 6px; }
.lc-num { font-family: $font-num; font-size: 42px; font-weight: 700; line-height: 1; color: #015eea;
  .life-card.warn & { color: #f59e0b; }
  .life-card.err & { color: #ef4444; }
}
.lc-unit { font-size: 14px; color: $text-muted; }
.lc-sub { font-size: 12px; color: $text-secondary; line-height: 1.7;
  b { color: $text-primary; font-family: $font-num; }
}
.lc-hint { color: $text-muted; margin-top: 4px; }

/* === 保单面板 === */
.policy-card {
  background: linear-gradient(135deg, #f0f6ff 0%, #ffffff 60%);
  border: 1px solid rgba(1,94,234,0.18);
  border-left: 4px solid #015eea;
  border-radius: $radius;
  padding: 16px 20px;
  margin-bottom: 18px;
}
.pc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.pc-title { font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.pc-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px 24px;
}
.pc-cell { display: flex; flex-direction: column; gap: 4px; }
.pc-l { font-size: 11px; color: $text-muted; }
.pc-v { font-size: 14px; font-weight: 500; color: $text-primary;
  &.mono { font-family: $font-num; letter-spacing: 0.3px; }
  &.ok { color: #22d3a0; }
  &.warn { color: #f59e0b; }
  &.mid { color: #015eea; }
  &.err { color: #ef4444; }
  .severe { margin-left: 8px; padding: 1px 6px; font-size: 11px; background: rgba(239,68,68,0.12); color: #ef4444; border-radius: 4px; }
}
.fav-toggle {
  cursor: pointer; font-size: 16px; color: #c4cad8;
  transition: color 0.15s, transform 0.15s;
  &:hover { color: #f59e0b; transform: scale(1.15); }
  &.on { color: #f59e0b; }
}

@media (max-width: 1100px) {
  .trend-summary, .dist-kpis { grid-template-columns: repeat(2, 1fr); }
  .pl-head { flex-wrap: wrap; }
  .pc-grid { grid-template-columns: repeat(2, 1fr); }
  .lc-body { grid-template-columns: 1fr; }
}
</style>
