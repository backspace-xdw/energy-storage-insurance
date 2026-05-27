<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import ChartCard from '@/components/ChartCard.vue'
import { stations, alarms, dashboardKpis, incidents, renewals as renewalSeed, insuranceCases } from '@/mock/data'
import {
  OfficeBuilding, Lightning, Bell, Lock, Warning, Refresh, Money, TrendCharts,
  Document, Clock, Right
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useUnderwritingStore } from '@/stores/underwriting'
import { useRenewalStore } from '@/stores/renewal'
import { useIncidentStore } from '@/stores/incident'

const router = useRouter()
const k = dashboardKpis

const uwStore = useUnderwritingStore()
const rnStore = useRenewalStore()
const icStore = useIncidentStore()

/* ---------- 待处理工作流（联动各 store） ---------- */
const pendingWorkflows = computed(() => {
  const uwPending = insuranceCases.filter(c => {
    const d = uwStore.getDecision(c.stationId)
    return d.status === 'pending'
  }).length
  const rnPending = renewalSeed.filter(r => {
    const d = rnStore.getDecision(r.stationId)
    return d.status === 'pending'
  }).length
  const icPending = incidents.filter(i => {
    const d = icStore.getDecision(i.id)
    const eff = d.status && d.status !== 'pending' ? d.status :
                (i.status === '溯源中' ? 'tracing' :
                 i.status === '理赔中' ? 'claimed' : 'closed')
    return ['pending', 'tracing'].includes(eff)
  }).length
  return [
    { key: 'underwriting', label: '待核保', count: uwPending, color: '#015eea', icon: Lock, route: '/app/underwriting' },
    { key: 'renewal',      label: '待续保', count: rnPending, color: '#06b6d4', icon: Refresh, route: '/app/renewal' },
    { key: 'incident',     label: '事故未结', count: icPending, color: '#ef4444', icon: Warning, route: '/app/incident' }
  ]
})

/* ---------- KPI 点击跳路由 ---------- */
function goTo(path) { router.push(path) }

/* ---------- 风险分布饼 (点击跳 devices) ---------- */
const distributionOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 12 } },
  series: [{
    name: '风险分布', type: 'pie', radius: ['56%', '78%'],
    avoidLabelOverlap: false,
    label: { show: false }, labelLine: { show: false },
    data: [
      { value: stations.filter(s => s.riskScore >= 90).length, name: '低风险 (90-100)', itemStyle: { color: '#22d3a0' } },
      { value: stations.filter(s => s.riskScore >= 75 && s.riskScore < 90).length, name: '中低 (75-89)', itemStyle: { color: '#06b6d4' } },
      { value: stations.filter(s => s.riskScore >= 60 && s.riskScore < 75).length, name: '中风险 (60-74)', itemStyle: { color: '#f59e0b' } },
      { value: stations.filter(s => s.riskScore < 60).length, name: '高风险 (<60)', itemStyle: { color: '#ef4444' } }
    ]
  }]
}))

/* ---------- 告警趋势：可切 7/14/30 日 ---------- */
const trendRange = ref('14')

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
const alarmTrendOption = computed(() => {
  const n = +trendRange.value
  const rnd = mulberry32(hashSeed('alarm-trend-' + n))
  const today = dayjs()
  const labels = Array.from({ length: n }, (_, i) =>
    today.subtract(n - 1 - i, 'day').format(n > 14 ? 'M/D' : 'D日')
  )
  const baseInfo = Array.from({ length: n }, () => Math.floor(4 + rnd() * 8))
  const baseImp  = Array.from({ length: n }, () => Math.floor(rnd() * 4))
  const baseSev  = Array.from({ length: n }, () => rnd() < 0.18 ? 1 : 0)
  const riskIdx  = Array.from({ length: n }, () => Math.floor(64 + rnd() * 18))
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 24, top: 40, bottom: 30 },
    legend: { top: 0, right: 0, textStyle: { fontSize: 12 } },
    xAxis: {
      type: 'category', data: labels,
      axisLine: { lineStyle: { color: '#dadfeb' } },
      axisTick: { show: false },
      axisLabel: { color: '#525c75', fontSize: 11, interval: n > 20 ? 3 : 0 }
    },
    yAxis: {
      type: 'value', splitLine: { lineStyle: { color: '#eef0f7' } },
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    series: [
      { name: '一般', type: 'bar', stack: 'a', data: baseInfo, itemStyle: { color: '#06b6d4', borderRadius: [0, 0, 2, 2] } },
      { name: '重要', type: 'bar', stack: 'a', data: baseImp,  itemStyle: { color: '#f59e0b' } },
      { name: '严重', type: 'bar', stack: 'a', data: baseSev,  itemStyle: { color: '#ef4444', borderRadius: [2, 2, 0, 0] } },
      {
        name: '风险指数', type: 'line', yAxisIndex: 0, smooth: true,
        data: riskIdx, itemStyle: { color: '#015eea' },
        lineStyle: { width: 3 }, symbol: 'circle', symbolSize: 6
      }
    ]
  }
})

const capacityTrendOption = {
  tooltip: { trigger: 'axis' },
  legend: { top: 0, right: 0, textStyle: { fontSize: 12 } },
  grid: { left: 50, right: 60, top: 36, bottom: 30 },
  xAxis: {
    type: 'category',
    data: ['2025-12','2026-01','2026-02','2026-03','2026-04','2026-05'],
    axisLine: { lineStyle: { color: '#dadfeb' } },
    axisLabel: { color: '#525c75', fontSize: 11 }
  },
  yAxis: [
    { type: 'value', name: 'MWh', position: 'left', splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { color: '#525c75', fontSize: 11 } },
    { type: 'value', name: '万元', position: 'right', splitLine: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { color: '#525c75', fontSize: 11 } }
  ],
  series: [
    {
      name: '累计承保容量', type: 'line', smooth: true, symbol: 'circle', symbolSize: 7,
      data: [150, 180, 220, 260, 285, 310],
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(6,182,212,0.45)' },
            { offset: 1, color: 'rgba(1,94,234,0.02)' }
          ]
        }
      },
      lineStyle: { width: 3, color: '#06b6d4' },
      itemStyle: { color: '#015eea' }
    },
    {
      name: '月度新增 MWh', type: 'bar', barWidth: 18,
      data: [30, 30, 40, 40, 25, 25],
      itemStyle: { color: 'rgba(99,102,241,0.5)', borderRadius: [4, 4, 0, 0] }
    },
    {
      name: '累计保费(万)', type: 'line', smooth: true, yAxisIndex: 1, symbol: 'circle', symbolSize: 6,
      data: [680, 820, 1020, 1200, 1310, 1428],
      lineStyle: { width: 2.5, color: '#f59e0b' },
      itemStyle: { color: '#f59e0b' }
    }
  ]
}

/* ---------- 刷新 + 生成日报 ---------- */
const refreshing = ref(false)
const refreshKey = ref(0)
async function refresh() {
  refreshing.value = true
  await new Promise(r => setTimeout(r, 800))
  refreshKey.value++  // 强制图表重渲
  refreshing.value = false
  ElMessage.success(`平台数据已刷新 · ${dayjs().format('HH:mm:ss')}`)
}

function generateDailyReport() {
  const report = {
    reportId: 'DR-' + dayjs().format('YYYYMMDD-HHmm'),
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    kpis: { ...k },
    stations: stations.map(s => ({
      id: s.id, name: s.name, capacityMWh: s.capacityMWh,
      soh: s.soh, riskScore: s.riskScore, status: s.insuranceStatus
    })),
    riskDistribution: distributionOption.value.series[0].data.map(d => ({
      bucket: d.name, count: d.value
    })),
    activeAlarms: alarms.filter(a => a.status !== '已恢复').map(a => ({
      id: a.id, time: a.time, station: a.stationName, type: a.type, level: a.level, status: a.status
    })),
    recentIncidents: incidents.slice(0, 5).map(i => ({
      id: i.id, time: i.time, type: i.type, severity: i.severity, station: i.stationName, status: i.status
    })),
    pendingWorkflows: pendingWorkflows.value.map(p => ({ name: p.label, count: p.count })),
    upcomingRenewals: renewalSeed.map(r => ({
      station: r.stationName, policy: r.policy, expireDate: r.expireDate, daysToExpire: r.daysToExpire, trend: r.trend
    }))
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `平台日报-${dayjs().format('YYYYMMDD-HHmm')}.json`; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('平台日报已生成')
}

/* ---------- 告警点击跳转 ---------- */
function gotoAlarm(a) {
  // 与告警相关的事故，若有就跳事故溯源；否则跳实时监控
  const matched = incidents.find(i => i.stationName === a.stationName && i.type.includes(a.type.slice(0, 2)))
  if (matched) {
    router.push('/app/incident')
  } else {
    router.push('/app/realtime')
  }
}

const stationsSorted = [...stations].sort((a, b) => b.riskScore - a.riskScore)
</script>

<template>
  <div class="dashboard">
    <PageHeader
      tag="DASHBOARD"
      title="平台总览"
      desc="承保站点、风险分布、告警趋势、续保提醒一图掌握"
    >
      <template #actions>
        <el-button :icon="Refresh" :loading="refreshing" @click="refresh">刷新</el-button>
        <el-button type="primary" :icon="Document" @click="generateDailyReport">生成日报</el-button>
      </template>
    </PageHeader>

    <!-- 待处理工作流横条 -->
    <div class="pending-row">
      <div
        v-for="p in pendingWorkflows" :key="p.key"
        class="pending-card"
        :class="{ hot: p.count > 0 }"
        @click="goTo(p.route)"
      >
        <div class="pc-icon" :style="{ background: p.color }">
          <el-icon><component :is="p.icon" /></el-icon>
        </div>
        <div class="pc-body">
          <div class="pc-label">{{ p.label }}</div>
          <div class="pc-val" :style="{ color: p.count > 0 ? p.color : '#8a93a8' }">
            {{ p.count }}<span>条待处理</span>
          </div>
        </div>
        <el-icon class="pc-arrow"><Right /></el-icon>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-cell clickable" @click="goTo('/app/devices')">
        <KpiCard label="承保站点数" :value="k.insuredStations" unit="座" delta="较上月 +2" :icon="OfficeBuilding" color="blue" />
      </div>
      <div class="kpi-cell clickable" @click="goTo('/app/devices')">
        <KpiCard label="承保总容量" :value="k.insuredCapacity" unit="MWh" delta="较上月 +12%" :icon="Lightning" color="cyan" />
      </div>
      <div class="kpi-cell clickable" @click="goTo('/app/realtime')">
        <KpiCard label="活动告警" :value="k.activeAlarms" unit="条" delta="较昨日 -3" trend="down" :icon="Bell" color="orange" />
      </div>
      <div class="kpi-cell clickable" @click="goTo('/app/evidence')">
        <KpiCard label="存证记录" :value="k.evidenceCount" unit="条" delta="本月 +8" :icon="Lock" color="violet" />
      </div>
      <div class="kpi-cell clickable" @click="goTo('/app/underwriting')">
        <KpiCard label="承保金额" :value="k.insuredAmount" delta="YTD" trend="flat" :icon="Money" color="green" />
      </div>
      <div class="kpi-cell clickable" @click="goTo('/app/risk')">
        <KpiCard label="高风险站点" :value="k.highRiskStations" unit="座" delta="环比 -1" trend="down" :icon="Warning" color="orange" />
      </div>
      <div class="kpi-cell clickable" @click="goTo('/app/renewal')">
        <KpiCard label="续保即将到期" :value="k.upcomingRenewals" unit="单" delta="≤30 天" :icon="Refresh" color="blue" />
      </div>
      <div class="kpi-cell clickable" @click="goTo('/app/underwriting')">
        <KpiCard label="累计保费" :value="k.premiumYTD" delta="YTD" :icon="TrendCharts" color="cyan" />
      </div>
    </div>

    <div class="row">
      <div class="col col-2">
        <div class="panel chart-panel" :key="'alarm-' + refreshKey + trendRange">
          <div class="cp-head">
            <div>
              <div class="cp-title">告警与风险趋势</div>
              <div class="cp-desc">按严重度分层叠加 · 当日风险指数叠加</div>
            </div>
            <el-radio-group v-model="trendRange" size="small">
              <el-radio-button value="7">近 7 日</el-radio-button>
              <el-radio-button value="14">近 14 日</el-radio-button>
              <el-radio-button value="30">近 30 日</el-radio-button>
            </el-radio-group>
          </div>
          <div class="chart-wrap">
            <ChartCard :option="alarmTrendOption" height="280px" />
          </div>
        </div>
      </div>
      <div class="col">
        <ChartCard title="承保站点风险分布" :option="distributionOption" height="320px" :key="'dist-' + refreshKey" />
      </div>
    </div>

    <!-- 表格 + 实时告警 同高 -->
    <div class="row row-stretch">
      <div class="col col-2">
        <div class="table-card panel">
          <div class="tc-head">
            <div class="tc-title">承保站点风险排行</div>
            <el-button text type="primary" @click="goTo('/app/devices')">
              查看全部
              <el-icon style="margin-left:2px"><Right /></el-icon>
            </el-button>
          </div>
          <el-table :data="stationsSorted" stripe size="default" max-height="460" @row-click="goTo('/app/devices')">
            <el-table-column type="index" label="#" width="50" />
            <el-table-column prop="name" label="站点" min-width="180" />
            <el-table-column prop="vendor" label="厂家" width="100" />
            <el-table-column prop="capacityMWh" label="容量(MWh)" width="110" />
            <el-table-column prop="soh" label="SOH(%)" width="100" />
            <el-table-column label="风险分" width="150">
              <template #default="{ row }">
                <div class="bar-wrap">
                  <div class="bar-bg">
                    <div
                      class="bar-fg"
                      :style="{
                        width: row.riskScore + '%',
                        background: row.riskScore >= 90 ? '#22d3a0' : row.riskScore >= 75 ? '#06b6d4' : row.riskScore >= 60 ? '#f59e0b' : '#ef4444'
                      }"
                    />
                  </div>
                  <span>{{ row.riskScore }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag
                  :type="row.insuranceStatus === '已承保' ? 'success' : row.insuranceStatus === '核保中' ? 'warning' : 'info'"
                  effect="light"
                  size="small"
                >
                  {{ row.insuranceStatus }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div class="col">
        <div class="alert-card panel">
          <div class="ac-head">
            <div class="ac-title">
              <span class="dot-r" /> 实时告警
              <el-tag size="small" type="danger" effect="light">{{ alarms.filter(a => a.status !== '已恢复').length }}</el-tag>
            </div>
            <el-button text type="primary" size="small" @click="goTo('/app/realtime')">
              全部告警 <el-icon style="margin-left:2px"><Right /></el-icon>
            </el-button>
          </div>
          <div class="alert-list">
            <div class="alert-item" v-for="a in alarms.slice(0, 7)" :key="a.id" @click="gotoAlarm(a)">
              <div class="ai-tag" :class="a.level">{{ a.level }}</div>
              <div class="ai-body">
                <div class="ai-title">{{ a.type }} · {{ a.location }}</div>
                <div class="ai-sub">{{ a.stationName }}</div>
                <div class="ai-time">
                  <el-icon style="vertical-align:-2px"><Clock /></el-icon>
                  {{ a.time.slice(5, 16) }} · 已持续 {{ a.duration }}
                </div>
              </div>
              <el-tag
                :type="a.status === '已恢复' ? 'success' : a.status === '处置中' ? 'warning' : 'danger'"
                size="small"
                effect="plain"
                class="ai-status"
              >{{ a.status }}</el-tag>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 容量趋势整行 -->
    <ChartCard
      title="承保容量与保费增长趋势"
      desc="累计承保 MWh · 月度新增 · 累计保费同步"
      :option="capacityTrendOption"
      height="260px"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

/* === Pending row === */
.pending-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin-bottom: 20px; }
.pending-card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 14px 18px; box-shadow: $shadow-card;
  display: flex; align-items: center; gap: 14px; cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  &:hover { transform: translateY(-2px); box-shadow: $shadow-card-hover; border-color: rgba(1,94,234,0.3); }
  &.hot { background: linear-gradient(135deg, $bg-card 0%, #fff5f5 100%); }
}
.pc-icon {
  width: 38px; height: 38px; border-radius: 10px; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 18px;
  flex-shrink: 0;
}
.pc-body { flex: 1; min-width: 0; }
.pc-label { font-size: 12px; color: $text-muted; }
.pc-val { font-size: 22px; font-weight: 600; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; line-height: 1.15;
  span { font-size: 11px; color: $text-muted; font-weight: 400; margin-left: 4px; }
}
.pc-arrow { color: $text-muted; font-size: 16px; flex-shrink: 0; }
.pending-card:hover .pc-arrow { color: $brand-blue; }

/* === KPI === */
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.kpi-cell.clickable { cursor: pointer; transition: transform 0.15s; }
.kpi-cell.clickable:hover { transform: translateY(-2px); }

.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
.row-stretch { align-items: stretch; }
.row-stretch .col { display: flex; flex-direction: column; min-height: 0; }
.row-stretch .panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.col-2 { grid-column: span 2; }

.panel {
  background: $bg-card; border-radius: $radius;
  border: 1px solid $border-soft;
  box-shadow: $shadow-card;
}
.chart-panel { padding: 18px 20px; }
.cp-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.cp-title { font-size: 15px; font-weight: 600; }
.cp-desc { font-size: 12px; color: $text-muted; margin-top: 2px; }
.chart-wrap :deep(.chart-card) { padding: 0; box-shadow: none; border: 0; }

.table-card { padding: 20px; }
.tc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.tc-title { font-size: 15px; font-weight: 600; }
.table-card :deep(.el-table) { flex: 1; }
.table-card :deep(.el-table__row) { cursor: pointer; }
.bar-wrap { display: flex; align-items: center; gap: 8px; }
.bar-bg { width: 80px; height: 6px; background: $bg-soft; border-radius: 3px; overflow: hidden; }
.bar-fg { height: 100%; border-radius: 3px; transition: width 0.3s; }

.alert-card { padding: 20px; }
.ac-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid $border-soft; }
.ac-title { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; }
.dot-r { width: 8px; height: 8px; background: #ef4444; border-radius: 50%; box-shadow: 0 0 0 4px rgba(239,68,68,0.18); animation: pulse 1.8s infinite; }
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
  100% { box-shadow: 0 0 0 8px rgba(239,68,68,0); }
}
.alert-list {
  flex: 1; min-height: 0; overflow-y: auto;
  display: flex; flex-direction: column; gap: 4px;
  margin: 0 -8px;
}
.alert-item {
  display: flex; gap: 10px; padding: 10px 12px;
  border-radius: 8px; cursor: pointer;
  border-left: 2px solid transparent;
  transition: background 0.15s, transform 0.15s;
  &:hover { background: $bg-soft; transform: translateX(2px); }
  &:has(.ai-tag.严重) { border-left-color: #ef4444; }
  &:has(.ai-tag.重要) { border-left-color: #f59e0b; }
  &:has(.ai-tag.一般) { border-left-color: #06b6d4; }
  &:has(.ai-tag.提示) { border-left-color: #6366f1; }
}
.ai-tag {
  padding: 2px 8px; border-radius: 4px; font-size: 11px; height: fit-content; margin-top: 2px;
  flex-shrink: 0;
  &.严重 { background: rgba(239,68,68,0.12); color: #ef4444; }
  &.重要 { background: rgba(245,158,11,0.14); color: #d97706; }
  &.一般 { background: rgba(6,182,212,0.12); color: #0891b2; }
  &.提示 { background: rgba(99,102,241,0.12); color: #6366f1; }
}
.ai-body { flex: 1; min-width: 0; }
.ai-title { font-size: 13px; font-weight: 500; }
.ai-sub { font-size: 12px; color: $text-secondary; margin-top: 2px; }
.ai-time { font-size: 11px; color: $text-muted; margin-top: 2px; display: flex; align-items: center; gap: 4px; }
.ai-status { flex-shrink: 0; align-self: center; }

@media (max-width: 1280px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .pending-row { grid-template-columns: 1fr; }
  .row { grid-template-columns: 1fr; }
  .col-2 { grid-column: auto; }
}
</style>
