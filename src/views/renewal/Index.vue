<script setup>
import { ref, computed, reactive, watch } from 'vue'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import { renewals } from '@/mock/data'
import echarts from '@/utils/echarts'
import {
  Refresh, Document, BellFilled, Bell, Check,
  CircleCheckFilled, Warning, Close, Clock, MagicStick,
  DataAnalysis, Right
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRenewalStore } from '@/stores/renewal'

const store = useRenewalStore()

const selected = ref(renewals[0])
const currentDecision = computed(() => store.getDecision(selected.value.stationId))

function pickStation(r) { selected.value = r }

const trendColor = (t) => ({ 下降: '#22d3a0', 稳定: '#06b6d4', 上升: '#ef4444' })[t]

const statusMeta = (s) => ({
  pending:  { label: '待处理',     color: '#8a93a8', tag: 'info' },
  agreed:   { label: '同意续保',   color: '#22d3a0', tag: 'success' },
  repriced: { label: '已调整费率', color: '#06b6d4', tag: 'primary' },
  declined: { label: '已驳回',     color: '#ef4444', tag: 'danger' },
  deferred: { label: '已暂缓',     color: '#f59e0b', tag: 'warning' },
  policied: { label: '保单已签发', color: '#015eea', tag: 'primary' }
})[s] || { label: s, color: '#8a93a8', tag: 'info' }

/* ---------- 保单试算 ---------- */
const calc = reactive({
  baseRate: 0.95,
  coverage: 3000,
  deductible: 5
})
function syncCalc() {
  const r = selected.value
  if (r.trend === '下降') calc.baseRate = 0.85
  else if (r.trend === '上升') calc.baseRate = 1.10
  else calc.baseRate = 0.95
  calc.coverage = 3000
  calc.deductible = 5
}
syncCalc()
watch(() => selected.value.stationId, syncCalc)

const riskPremium = computed(() => {
  const diff = Math.max(0, 90 - selected.value.currentScore)
  return +(diff * 2.0).toFixed(0) / 100
})
const premium = computed(() => {
  const base = calc.coverage * 10000 * (calc.baseRate / 100)
  return Math.round(base * (1 + riskPremium.value) * (1 - calc.deductible * 0.002))
})
function fmtMoney(n) {
  if (n == null) return '—'
  if (n >= 1_0000_0000) return (n / 1_0000_0000).toFixed(2) + ' 亿'
  if (n >= 10000) return (n / 10000).toFixed(2) + ' 万'
  return n.toLocaleString()
}

/* ---------- 收入预估实算 ---------- */
const estimatedIncome = computed(() => {
  return renewals.reduce((sum, r) => {
    const d = store.getDecision(r.stationId)
    if (d.status === 'agreed' || d.status === 'repriced' || d.status === 'policied') {
      return sum + (d.premium || 0)
    }
    return sum
  }, 0)
})

/* ---------- 上年 vs 本年对比 ---------- */
const yoy = computed(() => {
  const r = selected.value
  // 上年数据用 stationId 哈希稳定生成
  const rnd = mulberry32(hashSeed(r.stationId + ':yoy'))
  const lastAlarms = Math.floor(80 + rnd() * 80)
  const curAlarms = Math.floor(lastAlarms * (r.trend === '下降' ? 0.7 : r.trend === '上升' ? 1.3 : 0.95))
  const lastCycles = r.cycleCount - 30 - Math.floor(rnd() * 20)
  return {
    score: { last: r.lastYearScore, cur: r.currentScore, delta: r.currentScore - r.lastYearScore },
    alarms: { last: lastAlarms, cur: curAlarms, delta: curAlarms - lastAlarms },
    cycles: { last: lastCycles, cur: r.cycleCount, delta: r.cycleCount - lastCycles },
    runHours: { last: r.runHours - 100 - Math.floor(rnd() * 100), cur: r.runHours }
  }
})

/* ---------- 趋势图（保留稳定逻辑） ---------- */
const trendOption = computed(() => {
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const rnd = mulberry32(hashSeed(selected.value.stationId + ':trend'))
  const base = selected.value.lastYearScore
  const cur = selected.value.currentScore
  const trend = selected.value.trend
  const series = months.map((_, i) => {
    const t = i / 11
    let v = base + (cur - base) * t
    if (trend === '稳定') v += (Math.sin(i * 0.9) * 1.5)
    if (trend === '下降') v += (Math.sin(i * 0.9) * 2 + (rnd() - 0.5) * 2)
    if (trend === '上升') v -= (Math.sin(i * 0.9) * 2 - (rnd() - 0.5) * 1.5)
    return +v.toFixed(1)
  })
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    legend: { top: 0, right: 0 },
    xAxis: { type: 'category', data: months, axisLabel: { color: '#525c75' } },
    yAxis: { type: 'value', min: 55, max: 100, splitLine: { lineStyle: { color: '#eef0f7' } } },
    series: [{
      name: '风险评分', type: 'line', smooth: true,
      data: series, lineStyle: { color: '#015eea', width: 3 },
      itemStyle: { color: '#015eea' }, symbol: 'circle', symbolSize: 6,
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: 'rgba(6,182,212,0.35)' }, { offset: 1, color: 'rgba(1,94,234,0)' }]
      }}
    }]
  }
})

/* ---------- 告警热力按站点稳定 ---------- */
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
const alarmHeatOption = computed(() => {
  const rnd = mulberry32(hashSeed(selected.value.stationId + ':alarmheat'))
  // 趋势影响每月平均强度
  const trendFactor = selected.value.trend === '上升' ? 1.3 : selected.value.trend === '下降' ? 0.6 : 1.0
  const data = []
  for (let m = 0; m < 12; m++) {
    for (let lv = 0; lv < 4; lv++) {
      // 越严重的等级数量越少；月份偏后呈下降/上升态势
      const monthBias = selected.value.trend === '下降' ? (1 - m / 16) : selected.value.trend === '上升' ? (0.5 + m / 16) : 1
      const max = (4 - lv) * 3 * trendFactor * monthBias
      data.push([m, lv, Math.max(0, Math.floor(rnd() * max))])
    }
  }
  return {
    tooltip: { position: 'top' },
    grid: { left: 60, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: ['1','2','3','4','5','6','7','8','9','10','11','12'], axisLabel: { color: '#525c75' } },
    yAxis: { type: 'category', data: ['提示','一般','重要','严重'], axisLabel: { color: '#525c75' } },
    visualMap: { min: 0, max: 14, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#eff6ff', '#06b6d4', '#015eea', '#10152e'] }, textStyle: { fontSize: 11 } },
    series: [{
      type: 'heatmap',
      data,
      label: { show: true, color: '#fff', fontSize: 10 }
    }]
  }
})

/* ---------- 操作 ---------- */
async function agreeRenew() {
  try {
    await ElMessageBox.confirm(
      `按维持费率 ${calc.baseRate}% 续保 ${selected.value.stationName}？年保费约 ${fmtMoney(premium.value)}`,
      '同意续保', { type: 'success', confirmButtonText: '同意续保', cancelButtonText: '取消' }
    )
  } catch { return }
  store.setDecision(selected.value.stationId, {
    status: 'agreed',
    decidedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    rateAdjust: 0,
    rate: calc.baseRate,
    coverage: calc.coverage,
    deductible: calc.deductible,
    premium: premium.value,
    by: '当前用户'
  })
  ElMessage.success('已同意续保，可继续生成保单')
}

async function repriceRenew(direction) {
  const adj = direction === 'up' ? 8 : -5
  const newRate = +(calc.baseRate * (1 + adj / 100)).toFixed(3)
  try {
    await ElMessageBox.confirm(
      `费率 ${direction === 'up' ? '上调' : '下调'} ${Math.abs(adj)}% (新费率 ${newRate}%) 续保 ${selected.value.stationName}？`,
      direction === 'up' ? '上调费率' : '下调费率',
      { type: direction === 'up' ? 'warning' : 'success', confirmButtonText: '确认调整', cancelButtonText: '取消' }
    )
  } catch { return }
  calc.baseRate = newRate
  store.setDecision(selected.value.stationId, {
    status: 'repriced',
    decidedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    rateAdjust: adj,
    rate: newRate,
    coverage: calc.coverage,
    deductible: calc.deductible,
    premium: premium.value,
    by: '当前用户'
  })
  ElMessage.success(`已${direction === 'up' ? '上调' : '下调'}费率续保`)
}

async function declineRenew() {
  try {
    await ElMessageBox.prompt('请简述驳回理由', '驳回续保', {
      type: 'warning', inputType: 'textarea',
      confirmButtonText: '提交驳回', cancelButtonText: '取消'
    })
  } catch { return }
  store.setDecision(selected.value.stationId, {
    status: 'declined',
    decidedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    by: '当前用户'
  })
  ElMessage.success('已驳回续保')
}

function deferRenew() {
  store.setDecision(selected.value.stationId, {
    status: 'deferred',
    decidedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    by: '当前用户'
  })
  ElMessage.info('已暂缓，可待补充材料后再决策')
}

async function issuePolicy() {
  const d = currentDecision.value
  if (d.status !== 'agreed' && d.status !== 'repriced') {
    ElMessage.warning('请先同意或调整费率续保')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将为 ${selected.value.stationName} 签发续保保单，年保费 ${fmtMoney(d.premium)}`,
      '签发续保保单', { type: 'info', confirmButtonText: '签发保单', cancelButtonText: '取消' }
    )
  } catch { return }
  store.setDecision(selected.value.stationId, { status: 'policied' })
  ElMessage.success('续保保单已签发')
}

function resetDecision() {
  store.clearDecision(selected.value.stationId)
  ElMessage.success('已重置该站续保状态')
}

/* ---------- 推送提醒 ---------- */
const notifyDialog = ref(false)
const notifyForm = reactive({ channel: ['inApp', 'sms'], target: '客户经理' })
function openNotify() {
  notifyDialog.value = true
}
function sendNotify() {
  if (!notifyForm.channel.length) { ElMessage.warning('请选择至少一种推送渠道'); return }
  const channelStr = notifyForm.channel.join('+')
  store.pushNotification({
    stationId: selected.value.stationId,
    stationName: selected.value.stationName,
    channel: channelStr,
    target: notifyForm.target,
    by: '当前用户'
  })
  notifyDialog.value = false
  ElMessage.success(`已通过 ${channelStr} 推送续保提醒至 ${notifyForm.target}`)
}

const historyDialog = ref(false)
const stationNotifications = computed(() =>
  store.notifications.filter(n => n.stationId === selected.value.stationId)
)
const allNotifications = computed(() => store.notifications)

/* ---------- 生成报告 ---------- */
/* ---------- KPI 增强 ---------- */
const kpiStats = computed(() => {
  const decisions = renewals.map(r => ({ r, d: store.getDecision(r.stationId) }))
  const handled = decisions.filter(x => x.d.status !== 'pending')
  const repricedUp = handled.filter(x => x.d.rateAdjust > 0).length
  const repricedDown = handled.filter(x => x.d.rateAdjust < 0).length
  const declined = handled.filter(x => x.d.status === 'declined').length
  const premiums = handled.map(x => x.d.premium || 0).filter(p => p > 0)
  const avgPremium = premiums.length ? premiums.reduce((a, b) => a + b, 0) / premiums.length : 0
  return {
    repricedUp, repricedDown, declined,
    avgPremium,
    declineRate: handled.length ? (declined / handled.length * 100).toFixed(0) : '0'
  }
})

/* ---------- 智能策略推荐 ---------- */
const smartRecommendation = computed(() => {
  const r = selected.value
  const scoreDelta = r.currentScore - r.lastYearScore
  const sev = yoy.value.alarms.delta
  if (r.trend === '下降' && scoreDelta >= 2) {
    return {
      action: 'down', confidence: 92,
      title: '强烈建议：下调 5% 续保',
      reasons: [
        `风险评分上升 +${scoreDelta} 分，运行质量改善`,
        `年告警数 ${sev < 0 ? '下降' : '稳定'}（${yoy.value.alarms.cur} 起 vs 去年 ${yoy.value.alarms.last}）`,
        `循环次数 ${r.cycleCount} 处于合理区间`
      ],
      level: 'success'
    }
  }
  if (r.trend === '上升' || scoreDelta < -3) {
    return {
      action: 'up', confidence: 87,
      title: '建议：上调 8% 续保',
      reasons: [
        `风险评分 ${scoreDelta > 0 ? '+' : ''}${scoreDelta} 分，需谨慎核保`,
        `年告警数 ${sev > 0 ? '上升 +' + sev : '基本持平'}`,
        '建议附加运维改造条款'
      ],
      level: 'warning'
    }
  }
  return {
    action: 'agree', confidence: 78,
    title: '建议：维持费率续保',
    reasons: [
      `评分趋势稳定（${scoreDelta >= 0 ? '+' : ''}${scoreDelta}）`,
      '告警与循环未见异常',
      '保留原费率即可'
    ],
    level: 'info'
  }
})
function applyRecommendation() {
  const a = smartRecommendation.value.action
  if (a === 'down') repriceRenew('down')
  else if (a === 'up') repriceRenew('up')
  else agreeRenew()
}

/* ---------- 历史决策时间线（模拟 + 当前决策合并） ---------- */
function hashSeed2(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i)
  return h >>> 0
}
const historyTimeline = computed(() => {
  const r = selected.value
  const d = currentDecision.value
  const out = []
  if (d.status !== 'pending') {
    out.push({
      time: d.decidedAt, year: dayjs(d.decidedAt).format('YYYY'),
      title: statusMeta(d.status).label,
      detail: d.rate ? `费率 ${d.rate}% · 年保费 ${fmtMoney(d.premium || 0)}` : (d.note || '—'),
      by: d.by, level: d.status
    })
  }
  // mock 过去 3 年决策（基于 stationId 哈希稳定）
  const seed = hashSeed2(r.stationId)
  const rng = mulberry32(seed)
  const baseRate = 0.95
  for (let yr = 1; yr <= 3; yr++) {
    const year = dayjs().subtract(yr, 'year').year()
    const date = dayjs().subtract(yr, 'year').format(`YYYY-MM-${10 + Math.floor(rng() * 18)} ${10 + Math.floor(rng() * 6)}:00:00`)
    const adj = rng() < 0.3 ? (rng() < 0.5 ? -5 : 8) : 0
    const rate = +(baseRate * (1 + adj / 100)).toFixed(3)
    const premium = Math.round(3000 * 10000 * rate / 100 * 1.1)
    out.push({
      time: date, year: String(year),
      title: adj === 0 ? '续保 · 维持费率' : adj > 0 ? '续保 · 上调费率' : '续保 · 下调费率',
      detail: `费率 ${rate}% · 年保费 ${fmtMoney(premium)}`,
      by: ['客户经理李', '续保员张', '风控员王'][Math.floor(rng() * 3)],
      level: 'policied'
    })
  }
  return out
})

/* ---------- 批量操作 ---------- */
const batchSelected = ref([])
function toggleBatchAll(checked) {
  batchSelected.value = checked
    ? renewals.filter(r => store.getDecision(r.stationId).status === 'pending').map(r => r.stationId)
    : []
}
const allPendingSelected = computed(() => {
  const pending = renewals.filter(r => store.getDecision(r.stationId).status === 'pending')
  return pending.length > 0 && pending.every(r => batchSelected.value.includes(r.stationId))
})
async function batchAct(action) {
  if (batchSelected.value.length === 0) {
    ElMessage.warning('请先勾选要批量处理的站点')
    return
  }
  const labels = { agree: '维持费率续保', up: '上调 8% 续保', down: '下调 5% 续保', defer: '暂缓' }
  try {
    await ElMessageBox.confirm(
      `将对 ${batchSelected.value.length} 个站点执行「${labels[action]}」`,
      '批量续保操作',
      { type: action === 'up' ? 'warning' : 'success', confirmButtonText: '确认' }
    )
  } catch { return }
  let n = 0
  batchSelected.value.forEach(sid => {
    const r = renewals.find(x => x.stationId === sid); if (!r) return
    const baseRate = r.trend === '下降' ? 0.85 : r.trend === '上升' ? 1.10 : 0.95
    if (action === 'defer') {
      store.setDecision(sid, { status: 'deferred', decidedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'), by: '批量操作' })
    } else {
      const adj = action === 'up' ? 8 : action === 'down' ? -5 : 0
      const rate = +(baseRate * (1 + adj / 100)).toFixed(3)
      const diff = Math.max(0, 90 - r.currentScore)
      const prem = Math.round(3000 * 10000 * (rate / 100) * (1 + diff * 0.02) * 0.99)
      store.setDecision(sid, {
        status: adj === 0 ? 'agreed' : 'repriced',
        decidedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        rateAdjust: adj, rate, coverage: 3000, deductible: 5, premium: prem, by: '批量操作'
      })
    }
    n++
  })
  batchSelected.value = []
  ElMessage.success(`已批量${labels[action]} ${n} 个站点`)
}

/* ---------- 续保对比 dialog ---------- */
const compareDialog = ref(false)
const compareIds = ref([])
const compareChartEl = ref(null)
let compareChart = null
function openCompare() {
  if (compareIds.value.length < 2) compareIds.value = renewals.slice(0, 2).map(r => r.stationId)
  compareDialog.value = true
  // 等 dom 渲染后初始化
  setTimeout(() => {
    if (compareChartEl.value) {
      compareChart?.dispose()
      compareChart = echarts.init(compareChartEl.value)
      renderCompareChart()
    }
  }, 300)
}
function renderCompareChart() {
  if (!compareChart) return
  const sel = compareIds.value.map(id => renewals.find(r => r.stationId === id)).filter(Boolean)
  const indicators = [
    { name: '风险评分', max: 100 },
    { name: '上年评分', max: 100 },
    { name: '运行小时×10', max: 1000 },
    { name: '循环次数', max: 500 }
  ]
  compareChart.setOption({
    tooltip: {},
    radar: {
      indicator: indicators, radius: 110,
      splitArea: { areaStyle: { color: ['#f8fafc', '#fff'] } },
      splitLine: { lineStyle: { color: '#e7eaf3' } },
      axisName: { color: '#1a1f36', fontSize: 12 }
    },
    legend: { top: 0, textStyle: { fontSize: 12 } },
    series: [{
      type: 'radar',
      data: sel.map((s, i) => ({
        name: s.stationName,
        value: [s.currentScore, s.lastYearScore, s.runHours / 10, s.cycleCount],
        lineStyle: { color: i === 0 ? '#015eea' : '#ef4444', width: 2 },
        areaStyle: { color: i === 0 ? 'rgba(1,94,234,0.18)' : 'rgba(239,68,68,0.18)' },
        itemStyle: { color: i === 0 ? '#015eea' : '#ef4444' }
      }))
    }]
  })
}
watch(compareIds, () => { if (compareDialog.value) renderCompareChart() }, { deep: true })

/* ---------- 全量续保汇总 CSV ---------- */
function exportAllSummary() {
  const header = ['stationId', 'stationName', 'policy', 'expireDate', 'daysToExpire', 'lastYearScore', 'currentScore', 'trend', 'runHours', 'cycleCount', 'status', 'rate', 'premium', 'decidedAt', 'by']
  const csv = [header.join(',')]
  renewals.forEach(r => {
    const d = store.getDecision(r.stationId)
    const row = {
      stationId: r.stationId, stationName: r.stationName, policy: r.policy,
      expireDate: r.expireDate, daysToExpire: r.daysToExpire,
      lastYearScore: r.lastYearScore, currentScore: r.currentScore, trend: r.trend,
      runHours: r.runHours, cycleCount: r.cycleCount,
      status: statusMeta(d.status).label,
      rate: d.rate ? d.rate + '%' : '',
      premium: d.premium || '',
      decidedAt: d.decidedAt || '',
      by: d.by || ''
    }
    csv.push(header.map(f => {
      const v = row[f]; const s = v == null ? '' : String(v).replace(/"/g, '""')
      return /[,"\n]/.test(s) ? `"${s}"` : s
    }).join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `续保汇总-${dayjs().format('YYYY-MM-DD')}.csv`; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${renewals.length} 条续保汇总数据`)
}

function generateReport() {
  const r = selected.value
  const d = currentDecision.value
  const report = {
    reportId: 'RN-' + r.stationId + '-' + dayjs().format('YYYYMMDD-HHmm'),
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    station: { id: r.stationId, name: r.stationName },
    policy: { no: r.policy, expireDate: r.expireDate, daysToExpire: r.daysToExpire },
    yearOnYear: yoy.value,
    trend: r.trend,
    runHours: r.runHours,
    cycleCount: r.cycleCount,
    suggestion: r.suggestion,
    pricing: {
      baseRate: calc.baseRate + '%',
      coverage: calc.coverage + ' 万',
      deductible: calc.deductible + '%',
      riskPremium: (riskPremium.value * 100).toFixed(1) + '%',
      annualPremium: premium.value
    },
    decision: statusMeta(d.status).label,
    approval: d.status !== 'pending' ? {
      at: d.decidedAt, by: d.by, rate: d.rate, premium: d.premium, rateAdjust: d.rateAdjust
    } : null,
    recentNotifications: stationNotifications.value.slice(0, 5)
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `续保分析报告-${r.stationName}-${dayjs().format('YYYYMMDD-HHmm')}.json`; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已生成 ${r.stationName} 续保分析报告`)
}
</script>

<template>
  <div class="renewal">
    <PageHeader
      tag="RENEWAL"
      title="智能续保"
      desc="年度数据自动分析 · 风险趋势研判 · 自动续保策略 · 报告一键生成"
    >
      <template #actions>
        <el-button :icon="DataAnalysis" @click="openCompare">站点对比</el-button>
        <el-button :icon="Document" @click="exportAllSummary">导出全量汇总</el-button>
        <el-button :icon="Bell" @click="historyDialog = true">
          推送历史<span v-if="allNotifications.length" class="badge">{{ allNotifications.length }}</span>
        </el-button>
        <el-button :icon="BellFilled" @click="openNotify">推送续保提醒</el-button>
        <el-button type="primary" :icon="Document" @click="generateReport">生成续保分析报告</el-button>
      </template>
    </PageHeader>

    <div class="kpi-row">
      <div class="kp-card">
        <div class="kp-l">即将到期保单</div>
        <div class="kp-v">{{ renewals.length }} <span>单</span></div>
        <div class="kp-sub">未来 30 天内到期</div>
      </div>
      <div class="kp-card">
        <div class="kp-l">已处理</div>
        <div class="kp-v" style="color:#22d3a0">
          {{ renewals.filter(r => store.getDecision(r.stationId).status !== 'pending').length }} <span>/ {{ renewals.length }}</span>
        </div>
        <div class="kp-sub">待处理 {{ renewals.filter(r => store.getDecision(r.stationId).status === 'pending').length }} 单</div>
      </div>
      <div class="kp-card">
        <div class="kp-l">提价 / 降价 / 驳回</div>
        <div class="kp-v">
          <span style="color:#f59e0b">{{ kpiStats.repricedUp }}</span>
          <span style="color:#8a93a8;margin:0 4px;font-size:18px">/</span>
          <span style="color:#22d3a0">{{ kpiStats.repricedDown }}</span>
          <span style="color:#8a93a8;margin:0 4px;font-size:18px">/</span>
          <span style="color:#ef4444">{{ kpiStats.declined }}</span>
        </div>
        <div class="kp-sub">驳回率 {{ kpiStats.declineRate }}%</div>
      </div>
      <div class="kp-card">
        <div class="kp-l">平均年保费</div>
        <div class="kp-v" style="color:#015eea">{{ kpiStats.avgPremium > 0 ? fmtMoney(kpiStats.avgPremium) : '—' }}</div>
        <div class="kp-sub">已通过单均值</div>
      </div>
      <div class="kp-card">
        <div class="kp-l">续保收入预估</div>
        <div class="kp-v" style="color:#015eea">{{ fmtMoney(estimatedIncome) }}</div>
        <div class="kp-sub">已通过续保汇总</div>
      </div>
    </div>

    <!-- 批量操作工具条 -->
    <div class="batch-bar" v-if="renewals.filter(r => store.getDecision(r.stationId).status === 'pending').length">
      <el-checkbox
        :model-value="allPendingSelected"
        :indeterminate="batchSelected.length > 0 && !allPendingSelected"
        @change="toggleBatchAll"
      >全选待处理 ({{ renewals.filter(r => store.getDecision(r.stationId).status === 'pending').length }})</el-checkbox>
      <span class="batch-info">已选 <b>{{ batchSelected.length }}</b> 个</span>
      <div class="batch-actions">
        <el-button size="small" type="success" :icon="Check" :disabled="!batchSelected.length" @click="batchAct('agree')">批量同意</el-button>
        <el-button size="small" type="primary" plain :disabled="!batchSelected.length" @click="batchAct('down')">批量下调 5%</el-button>
        <el-button size="small" type="warning" plain :disabled="!batchSelected.length" @click="batchAct('up')">批量上调 8%</el-button>
        <el-button size="small" :icon="Clock" :disabled="!batchSelected.length" @click="batchAct('defer')">批量暂缓</el-button>
      </div>
    </div>

    <div class="layout">
      <div class="list card">
        <div class="lt-title">续保列表</div>
        <div
          class="list-item"
          v-for="r in renewals"
          :key="r.stationId"
          :class="{ active: selected.stationId === r.stationId }"
          @click="pickStation(r)"
        >
          <el-checkbox
            v-if="store.getDecision(r.stationId).status === 'pending'"
            class="li-check"
            :model-value="batchSelected.includes(r.stationId)"
            @click.stop
            @change="(v) => v ? batchSelected.push(r.stationId) : batchSelected = batchSelected.filter(x => x !== r.stationId)"
          />
          <div class="li-row">
            <span class="li-name">{{ r.stationName }}</span>
            <span class="li-status" :style="{ background: statusMeta(store.getDecision(r.stationId).status).color }">
              {{ statusMeta(store.getDecision(r.stationId).status).label }}
            </span>
          </div>
          <div class="li-meta">
            <span>保单 {{ r.policy }}</span>
            <el-tag size="small" :color="trendColor(r.trend)" effect="dark" style="border:none;color:#fff;font-size:10px">{{ r.trend }}</el-tag>
          </div>
          <div class="li-meta2">剩余 {{ r.daysToExpire }} 天 · {{ r.expireDate }}</div>
          <div class="li-bar">
            <div class="lb-bg">
              <div class="lb-fg" :style="{ width: (r.daysToExpire / 30 * 100) + '%', background: r.daysToExpire <= 7 ? '#ef4444' : r.daysToExpire <= 15 ? '#f59e0b' : '#06b6d4' }" />
            </div>
          </div>
        </div>
      </div>

      <div class="main">
        <div class="summary card">
          <div class="sm-head">
            <div>
              <div class="sm-station">{{ selected.stationName }}</div>
              <div class="sm-sub">
                保单 {{ selected.policy }} · 到期 {{ selected.expireDate }}
                · 状态：<span :style="{ color: statusMeta(currentDecision.status).color, fontWeight: 600 }">{{ statusMeta(currentDecision.status).label }}</span>
                <span v-if="currentDecision.decidedAt"> · {{ currentDecision.decidedAt }}</span>
              </div>
            </div>
            <el-tag :color="trendColor(selected.trend)" effect="dark" size="large" style="border:none;color:#fff">趋势：{{ selected.trend }}</el-tag>
          </div>

          <!-- 上年 vs 本年对比 -->
          <div class="yoy-grid">
            <div class="yoy">
              <div class="yo-l">风险评分</div>
              <div class="yo-row">
                <span class="yo-old">{{ yoy.score.last }}</span>
                <span class="yo-arr">→</span>
                <span class="yo-new" :style="{ color: trendColor(selected.trend) }">{{ yoy.score.cur }}</span>
                <span class="yo-delta" :class="yoy.score.delta >= 0 ? 'up' : 'down'">
                  {{ yoy.score.delta >= 0 ? '+' : '' }}{{ yoy.score.delta }}
                </span>
              </div>
            </div>
            <div class="yoy">
              <div class="yo-l">年告警数</div>
              <div class="yo-row">
                <span class="yo-old">{{ yoy.alarms.last }}</span>
                <span class="yo-arr">→</span>
                <span class="yo-new">{{ yoy.alarms.cur }}</span>
                <span class="yo-delta" :class="yoy.alarms.delta < 0 ? 'good' : yoy.alarms.delta > 0 ? 'bad' : ''">
                  {{ yoy.alarms.delta >= 0 ? '+' : '' }}{{ yoy.alarms.delta }}
                </span>
              </div>
            </div>
            <div class="yoy">
              <div class="yo-l">循环次数</div>
              <div class="yo-row">
                <span class="yo-old">{{ yoy.cycles.last }}</span>
                <span class="yo-arr">→</span>
                <span class="yo-new">{{ yoy.cycles.cur }}</span>
                <span class="yo-delta neu">+{{ yoy.cycles.delta }}</span>
              </div>
            </div>
            <div class="yoy">
              <div class="yo-l">年运行</div>
              <div class="yo-row">
                <span class="yo-old">{{ yoy.runHours.last }}h</span>
                <span class="yo-arr">→</span>
                <span class="yo-new">{{ yoy.runHours.cur }}h</span>
              </div>
            </div>
          </div>

          <el-alert type="info" :closable="false" class="sm-alert" show-icon>
            <strong>续保建议：</strong>{{ selected.suggestion }}
          </el-alert>
        </div>

        <!-- 智能策略推荐 -->
        <div class="recommend card" :class="smartRecommendation.level"
          v-if="currentDecision.status === 'pending'">
          <div class="rec-head">
            <div class="rec-l">
              <el-icon class="rec-icon"><MagicStick /></el-icon>
              <div>
                <div class="rec-title">{{ smartRecommendation.title }}</div>
                <div class="rec-sub">AI 智能推荐 · 置信度 {{ smartRecommendation.confidence }}%</div>
              </div>
            </div>
            <el-button type="primary" :icon="Check" @click="applyRecommendation">采纳推荐</el-button>
          </div>
          <div class="rec-reasons">
            <div class="rec-reason" v-for="(r, i) in smartRecommendation.reasons" :key="i">
              <el-icon><Right /></el-icon>{{ r }}
            </div>
          </div>
        </div>

        <div class="dual">
          <ChartCard title="12 个月风险评分趋势" desc="对比承保初/中/末期" :option="trendOption" height="300px" />
          <ChartCard title="告警等级热力分布" desc="月份 × 告警等级 / 颜色深浅 = 数量" :option="alarmHeatOption" height="300px" />
        </div>

        <!-- 保单试算 -->
        <div class="calc card">
          <div class="st-head">
            <div class="st-title">保单参数试算</div>
            <el-tag size="small" effect="plain">趋势 {{ selected.trend }} · 已自动调整费率建议</el-tag>
          </div>
          <div class="calc-row">
            <div class="cr-field">
              <div class="cr-l">基础费率</div>
              <el-input-number v-model="calc.baseRate" :min="0.5" :max="3" :step="0.05" :precision="2" controls-position="right" />
              <span class="cr-unit">%</span>
            </div>
            <div class="cr-field">
              <div class="cr-l">承保金额</div>
              <el-input-number v-model="calc.coverage" :min="500" :max="10000" :step="100" controls-position="right" />
              <span class="cr-unit">万</span>
            </div>
            <div class="cr-field">
              <div class="cr-l">免赔率</div>
              <el-slider v-model="calc.deductible" :min="0" :max="20" :step="1" style="width:140px" />
              <span class="cr-unit">{{ calc.deductible }}%</span>
            </div>
          </div>
          <div class="calc-result">
            <div class="cr-stat">
              <div class="cs-l">风险溢价</div>
              <div class="cs-v" :class="riskPremium > 0.1 ? 'warn' : ''">{{ (riskPremium * 100).toFixed(1) }}%</div>
            </div>
            <div class="cr-arrow">→</div>
            <div class="cr-stat big">
              <div class="cs-l">预估续保年保费</div>
              <div class="cs-v big">¥ {{ fmtMoney(premium) }}</div>
              <div class="cs-tip">= {{ calc.coverage }}万 × {{ calc.baseRate }}% × (1 + {{ (riskPremium * 100).toFixed(0) }}%) × (1 - 免赔调整)</div>
            </div>
          </div>
        </div>

        <!-- 历史决策时间线 -->
        <div class="hist-card card">
          <div class="st-head">
            <div class="st-title">历史续保决策</div>
            <el-tag size="small" effect="plain">{{ historyTimeline.length }} 条记录</el-tag>
          </div>
          <div class="ht-line">
            <div class="ht-item" v-for="(h, i) in historyTimeline" :key="i" :class="h.level">
              <div class="ht-year">{{ h.year }}</div>
              <div class="ht-dot" />
              <div class="ht-body">
                <div class="ht-title">{{ h.title }}</div>
                <div class="ht-detail">{{ h.detail }}</div>
                <div class="ht-by">{{ h.time?.slice(5, 16) }} · {{ h.by }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 续保操作 -->
        <div class="strategy card">
          <div class="st-head">
            <div class="st-title">续保操作</div>
            <el-tag :type="statusMeta(currentDecision.status).tag" effect="dark" size="small">
              {{ statusMeta(currentDecision.status).label }}
            </el-tag>
          </div>
          <div class="op-row">
            <template v-if="currentDecision.status === 'pending'">
              <el-button type="success" :icon="Check" @click="agreeRenew">同意续保（维持）</el-button>
              <el-button type="primary" plain @click="repriceRenew('down')">下调 5% 续保</el-button>
              <el-button type="warning" plain @click="repriceRenew('up')">上调 8% 续保</el-button>
              <el-button :icon="Clock" @click="deferRenew">暂缓</el-button>
              <el-button type="danger" plain :icon="Close" @click="declineRenew">驳回</el-button>
            </template>
            <template v-else-if="currentDecision.status === 'agreed' || currentDecision.status === 'repriced'">
              <el-button type="success" :icon="Document" @click="issuePolicy">签发续保保单</el-button>
              <el-button plain @click="resetDecision">重置状态</el-button>
            </template>
            <template v-else-if="currentDecision.status === 'policied'">
              <el-tag type="success" size="large">
                <el-icon><CircleCheckFilled /></el-icon>
                续保保单已签发 · {{ currentDecision.decidedAt }}
              </el-tag>
              <el-button plain @click="resetDecision">重置状态</el-button>
            </template>
            <template v-else>
              <el-button plain @click="resetDecision">重置状态</el-button>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- 推送提醒对话框 -->
    <el-dialog v-model="notifyDialog" title="推送续保提醒" width="460">
      <el-form label-width="80px" label-position="left">
        <el-form-item label="目标站点">
          <el-input :model-value="selected.stationName" disabled />
        </el-form-item>
        <el-form-item label="接收人">
          <el-radio-group v-model="notifyForm.target">
            <el-radio value="客户经理">客户经理</el-radio>
            <el-radio value="客户">客户</el-radio>
            <el-radio value="风控+客户经理">风控+客户经理</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="推送渠道">
          <el-checkbox-group v-model="notifyForm.channel">
            <el-checkbox value="inApp">站内通知</el-checkbox>
            <el-checkbox value="sms">短信</el-checkbox>
            <el-checkbox value="email">邮件</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <div class="cf-tip">
          <el-icon><BellFilled /></el-icon>
          按 T-30 / T-15 / T-7 自动节奏，本次仅发送当前提醒
        </div>
      </el-form>
      <template #footer>
        <el-button @click="notifyDialog = false">取消</el-button>
        <el-button type="primary" :icon="BellFilled" @click="sendNotify">立即推送</el-button>
      </template>
    </el-dialog>

    <!-- 推送历史对话框 -->
    <el-dialog v-model="historyDialog" title="续保提醒推送历史" width="600">
      <div class="hi-head" v-if="allNotifications.length">
        <span class="hi-sub">共 {{ allNotifications.length }} 条</span>
        <el-button text type="danger" size="small" @click="store.clearNotifications()">清空全部</el-button>
      </div>
      <div class="hi-list" v-if="allNotifications.length">
        <div class="hi-item" v-for="n in allNotifications" :key="n.id">
          <div class="hi-time">{{ dayjs(n.time).format('MM-DD HH:mm') }}</div>
          <div class="hi-body">
            <div class="hi-title">
              <span class="hi-station">{{ n.stationName }}</span>
              <el-tag size="small" effect="plain">{{ n.channel }}</el-tag>
            </div>
            <div class="hi-meta">{{ n.by }} 发送</div>
          </div>
        </div>
      </div>
      <div class="hi-empty" v-else>
        <el-icon><Bell /></el-icon>
        暂无推送记录
      </div>
    </el-dialog>

    <!-- 站点对比 dialog -->
    <el-dialog v-model="compareDialog" title="续保站点对比" width="780">
      <div class="cmp-pick">
        <el-select v-model="compareIds" multiple :multiple-limit="3" placeholder="选择 2-3 个站点" style="width:100%">
          <el-option v-for="r in renewals" :key="r.stationId" :label="r.stationName" :value="r.stationId" />
        </el-select>
      </div>
      <div class="cmp-chart" ref="compareChartEl" />
      <div class="cmp-table" v-if="compareIds.length >= 2">
        <div class="ct-head">
          <div>站点</div><div>趋势</div><div>评分</div><div>年告警</div><div>循环</div><div>状态</div>
        </div>
        <div class="ct-row" v-for="id in compareIds" :key="id">
          <template v-if="renewals.find(x => x.stationId === id)">
            <div class="ct-name">{{ renewals.find(x => x.stationId === id).stationName }}</div>
            <div>
              <el-tag :color="trendColor(renewals.find(x => x.stationId === id).trend)" effect="dark" size="small" style="border:none;color:#fff">
                {{ renewals.find(x => x.stationId === id).trend }}
              </el-tag>
            </div>
            <div>{{ renewals.find(x => x.stationId === id).currentScore }}</div>
            <div>{{ renewals.find(x => x.stationId === id).runHours }} h</div>
            <div>{{ renewals.find(x => x.stationId === id).cycleCount }} 次</div>
            <div>
              <el-tag :type="statusMeta(store.getDecision(id).status).tag" size="small">
                {{ statusMeta(store.getDecision(id).status).label }}
              </el-tag>
            </div>
          </template>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.kp-card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 20px; box-shadow: $shadow-card;
  position: relative; overflow: hidden;
  &::after {
    content: ''; position: absolute; left: 0; bottom: 0; right: 0; height: 3px;
    background: $grad-cyan;
  }
}
.kp-l { font-size: 12px; color: $text-muted; }
.kp-v { font-size: 28px; font-weight: 600; margin: 6px 0; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; }
.kp-v span { font-size: 13px; color: $text-muted; font-weight: 400; margin-left: 4px; }
.kp-sub { font-size: 12px; color: $text-muted; }

.layout { display: grid; grid-template-columns: 320px 1fr; gap: 16px; }
.card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px; box-shadow: $shadow-card;
}
.lt-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.list-item {
  padding: 14px; border-radius: 8px; cursor: pointer; margin-bottom: 8px;
  transition: background 0.15s;
  border: 1px solid transparent;
  position: relative;
  &:hover { background: $bg-soft; }
  &.active { background: rgba(1, 94, 234, 0.05); border-color: rgba(1, 94, 234, 0.18); }
}
.li-check { position: absolute; top: 10px; right: 8px; z-index: 2; }
.li-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-right: 22px; }
.li-name { font-size: 13px; font-weight: 500; flex: 1; min-width: 0; }
.li-status {
  font-size: 10px; padding: 2px 7px; border-radius: 9px; color: #fff; font-weight: 500;
  flex-shrink: 0;
}
.li-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: $text-muted; margin: 6px 0 2px; }
.li-meta2 { font-size: 11px; color: $text-muted; margin-bottom: 6px; }
.li-bar .lb-bg { height: 4px; background: $bg-soft; border-radius: 2px; overflow: hidden; }
.li-bar .lb-fg { height: 100%; transition: width 0.4s; }

.main { display: flex; flex-direction: column; gap: 16px; }
.sm-head { display: flex; justify-content: space-between; align-items: center; }
.sm-station { font-size: 20px; font-weight: 600; }
.sm-sub { font-size: 12px; color: $text-muted; margin-top: 4px; }

/* === YoY 对比 === */
.yoy-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-top: 18px; padding-top: 18px; border-top: 1px solid $border-soft; }
.yoy { background: $bg-soft; border-radius: 8px; padding: 12px 14px; }
.yo-l { font-size: 12px; color: $text-muted; }
.yo-row { display: flex; align-items: baseline; gap: 6px; margin-top: 6px; font-family: $font-num; }
.yo-old { font-size: 14px; color: $text-muted; }
.yo-arr { font-size: 12px; color: $text-muted; }
.yo-new { font-size: 22px; font-weight: 600; color: $text-primary; }
.yo-delta {
  margin-left: auto; font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 600;
  &.up   { background: rgba(34,211,160,0.12); color: #22d3a0; }
  &.down { background: rgba(239,68,68,0.12); color: #ef4444; }
  &.good { background: rgba(34,211,160,0.12); color: #22d3a0; }
  &.bad  { background: rgba(239,68,68,0.12); color: #ef4444; }
  &.neu  { background: rgba(99,102,241,0.12); color: #6366f1; }
}

.sm-alert { margin-top: 16px; }

.dual { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* === 试算 === */
.st-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.st-title { font-size: 14px; font-weight: 600; }
.calc-row { display: flex; gap: 24px; flex-wrap: wrap; padding: 4px 0 14px; }
.cr-field { display: flex; align-items: center; gap: 10px; }
.cr-l { font-size: 12px; color: $text-muted; }
.cr-unit { font-size: 12px; color: $text-muted; min-width: 24px; }
.calc-result {
  display: flex; align-items: center; gap: 18px;
  padding: 14px 18px; background: linear-gradient(135deg, #f0f6ff 0%, #fff 70%);
  border-radius: $radius; border: 1px solid rgba(1,94,234,0.15);
}
.cr-stat { display: flex; flex-direction: column; gap: 4px; }
.cr-stat.big { flex: 1; }
.cs-l { font-size: 12px; color: $text-muted; }
.cs-v { font-size: 16px; font-weight: 600; color: $text-primary; font-family: $font-num;
  &.warn { color: #f59e0b; }
  &.big  { font-size: 28px; color: #015eea; }
}
.cs-tip { font-size: 11px; color: $text-muted; }
.cr-arrow { font-size: 22px; color: $text-muted; }

/* === 操作 === */
.op-row { display: flex; gap: 10px; flex-wrap: wrap; }

/* === Notify dialog === */
.cf-tip {
  margin-top: 4px; padding: 10px 14px;
  background: $bg-soft; border-radius: 8px;
  font-size: 12px; color: $text-secondary;
  display: flex; align-items: center; gap: 6px;
  .el-icon { color: $brand-blue; }
}

.badge {
  display: inline-block; min-width: 16px; padding: 0 5px; margin-left: 6px;
  background: #ef4444; color: #fff; font-size: 10px; font-weight: 700;
  border-radius: 8px; line-height: 16px; height: 16px;
}

/* === History dialog === */
.hi-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.hi-sub { font-size: 12px; color: $text-muted; }
.hi-list { display: flex; flex-direction: column; gap: 8px; max-height: 400px; overflow: auto; }
.hi-item {
  display: grid; grid-template-columns: 80px 1fr; gap: 12px;
  padding: 10px 14px; border: 1px solid $border-soft; border-radius: 8px;
}
.hi-time { font-size: 12px; color: $text-muted; font-family: $font-num; }
.hi-title { display: flex; align-items: center; gap: 8px; }
.hi-station { font-size: 13px; font-weight: 500; }
.hi-meta { font-size: 11px; color: $text-muted; margin-top: 4px; }
.hi-empty { padding: 40px; text-align: center; color: $text-muted;
  .el-icon { font-size: 28px; margin-bottom: 8px; }
}

/* === 批量操作工具条 === */
.batch-bar {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 10px 16px; margin-bottom: 16px;
  display: flex; align-items: center; gap: 16px; box-shadow: $shadow-card;
  flex-wrap: wrap;
}
.batch-info { font-size: 13px; color: $text-secondary; b { color: $brand-blue; font-family: $font-num; } }
.batch-actions { display: flex; gap: 8px; margin-left: auto; }

/* === 智能推荐卡 === */
.recommend {
  border-left: 4px solid #06b6d4;
  background: linear-gradient(135deg, #f0fafe 0%, #fff 70%);
  &.warning { border-left-color: #f59e0b; background: linear-gradient(135deg, #fff8eb 0%, #fff 70%); }
  &.info    { border-left-color: #06b6d4; background: linear-gradient(135deg, #f0fafe 0%, #fff 70%); }
  &.success { border-left-color: #22d3a0; background: linear-gradient(135deg, #f0fdf6 0%, #fff 70%); }
}
.rec-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.rec-l { display: flex; align-items: center; gap: 12px; }
.rec-icon {
  width: 38px; height: 38px; border-radius: 10px;
  background: $grad-cyan; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
  .recommend.warning & { background: linear-gradient(135deg, #f59e0b, #ef4444); }
  .recommend.success & { background: linear-gradient(135deg, #22d3a0, #06b6d4); }
}
.rec-title { font-size: 15px; font-weight: 600; }
.rec-sub { font-size: 11px; color: $text-muted; margin-top: 2px; }
.rec-reasons { display: flex; flex-direction: column; gap: 6px; padding-top: 10px; border-top: 1px solid $border-soft; }
.rec-reason {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: $text-secondary;
  .el-icon { color: $brand-blue; font-size: 12px; }
}

/* === 历史决策时间线 === */
.hist-card { padding-bottom: 8px; }
.ht-line { position: relative; padding-left: 18px; }
.ht-line::before {
  content: ''; position: absolute; left: 5px; top: 6px; bottom: 18px;
  width: 2px; background: $border-soft;
}
.ht-item {
  position: relative; padding: 8px 0 12px;
  display: grid; grid-template-columns: 56px 1fr; gap: 12px; align-items: flex-start;
}
.ht-dot {
  position: absolute; left: -16px; top: 14px;
  width: 10px; height: 10px; border-radius: 50%;
  background: #06b6d4; box-shadow: 0 0 0 3px #fff;
  .ht-item.agreed &   { background: #22d3a0; }
  .ht-item.repriced & { background: #06b6d4; }
  .ht-item.declined & { background: #ef4444; }
  .ht-item.deferred & { background: #f59e0b; }
  .ht-item.policied & { background: #015eea; }
}
.ht-year { font-family: $font-num; font-size: 14px; color: $text-muted; font-weight: 600; }
.ht-title { font-size: 13px; font-weight: 600; }
.ht-detail { font-size: 12px; color: $text-secondary; margin-top: 3px; font-family: $font-num; }
.ht-by { font-size: 11px; color: $text-muted; margin-top: 3px; }

/* === 对比 dialog === */
.cmp-pick { margin-bottom: 14px; }
.cmp-chart { width: 100%; height: 320px; }
.cmp-table { margin-top: 16px; border-top: 1px solid $border-soft; padding-top: 12px; }
.ct-head, .cmp-table .ct-row {
  display: grid; grid-template-columns: 2fr 1fr 1fr 1fr 1fr 1fr;
  gap: 10px; align-items: center;
  padding: 8px 12px; font-size: 12px;
}
.ct-head { background: $bg-soft; border-radius: 6px; color: $text-muted; font-weight: 600; }
.cmp-table .ct-row { border-bottom: 1px dashed $border-soft; }
.ct-name { font-weight: 500; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .dual, .yoy-grid, .kpi-row { grid-template-columns: 1fr 1fr; }
  .calc-row { flex-direction: column; align-items: stretch; }
}
</style>
