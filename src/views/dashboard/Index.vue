<script setup>
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import KpiCard from '@/components/KpiCard.vue'
import ChartCard from '@/components/ChartCard.vue'
import { stations, alarms, dashboardKpis } from '@/mock/data'
import {
  OfficeBuilding, Lightning, Bell, Lock, Warning, Refresh, Money, TrendCharts
} from '@element-plus/icons-vue'

const k = dashboardKpis

const distributionOption = {
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
}

const alarmTrendOption = {
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 24, top: 40, bottom: 30 },
  legend: { top: 0, right: 0, textStyle: { fontSize: 12 } },
  xAxis: {
    type: 'category',
    data: Array.from({ length: 14 }, (_, i) => `${i + 1}日`),
    axisLine: { lineStyle: { color: '#dadfeb' } },
    axisTick: { show: false },
    axisLabel: { color: '#525c75', fontSize: 11 }
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#eef0f7' } },
    axisLabel: { color: '#525c75', fontSize: 11 }
  },
  series: [
    {
      name: '一般', type: 'bar', stack: 'a', data: [4,6,5,8,7,6,9,7,5,8,6,7,9,5],
      itemStyle: { color: '#06b6d4', borderRadius: [0, 0, 2, 2] }
    },
    {
      name: '重要', type: 'bar', stack: 'a', data: [1,2,1,3,2,2,4,2,1,3,2,3,2,1],
      itemStyle: { color: '#f59e0b' }
    },
    {
      name: '严重', type: 'bar', stack: 'a', data: [0,0,1,0,0,1,1,0,0,1,0,0,1,0],
      itemStyle: { color: '#ef4444', borderRadius: [2, 2, 0, 0] }
    },
    {
      name: '风险指数', type: 'line', yAxisIndex: 0, smooth: true,
      data: [76,72,80,68,74,70,65,72,78,68,74,71,66,75],
      itemStyle: { color: '#015eea' },
      lineStyle: { width: 3 },
      symbol: 'circle', symbolSize: 6
    }
  ]
}

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

const map = ref(null)

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
        <el-button :icon="Refresh">刷新</el-button>
        <el-button type="primary" :icon="TrendCharts">生成日报</el-button>
      </template>
    </PageHeader>

    <div class="kpi-grid">
      <KpiCard label="承保站点数" :value="k.insuredStations" unit="座" delta="较上月 +2" :icon="OfficeBuilding" color="blue" />
      <KpiCard label="承保总容量" :value="k.insuredCapacity" unit="MWh" delta="较上月 +12%" :icon="Lightning" color="cyan" />
      <KpiCard label="活动告警" :value="k.activeAlarms" unit="条" delta="较昨日 -3" trend="down" :icon="Bell" color="orange" />
      <KpiCard label="存证记录" :value="k.evidenceCount" unit="条" delta="本月 +8" :icon="Lock" color="violet" />
      <KpiCard label="承保金额" :value="k.insuredAmount" delta="YTD" trend="flat" :icon="Money" color="green" />
      <KpiCard label="高风险站点" :value="k.highRiskStations" unit="座" delta="环比 -1" trend="down" :icon="Warning" color="orange" />
      <KpiCard label="续保即将到期" :value="k.upcomingRenewals" unit="单" delta="≤30 天" :icon="Refresh" color="blue" />
      <KpiCard label="累计保费" :value="k.premiumYTD" delta="YTD" :icon="TrendCharts" color="cyan" />
    </div>

    <div class="row">
      <div class="col col-2">
        <ChartCard title="近 14 日告警与风险趋势" desc="按严重度分层叠加 / 当日风险指数叠加" :option="alarmTrendOption" height="320px" />
      </div>
      <div class="col">
        <ChartCard title="承保站点风险分布" :option="distributionOption" height="320px" />
      </div>
    </div>

    <!-- 表格 + 实时告警 同高 -->
    <div class="row row-stretch">
      <div class="col col-2">
        <div class="table-card panel">
          <div class="tc-head">
            <div class="tc-title">承保站点风险排行</div>
            <el-button text type="primary">查看全部</el-button>
          </div>
          <el-table :data="stationsSorted" stripe size="default" max-height="460">
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
            <el-button text type="primary" size="small">全部告警</el-button>
          </div>
          <div class="alert-list">
            <div class="alert-item" v-for="a in alarms.slice(0, 7)" :key="a.id">
              <div class="ai-tag" :class="a.level">{{ a.level }}</div>
              <div class="ai-body">
                <div class="ai-title">{{ a.type }} · {{ a.location }}</div>
                <div class="ai-sub">{{ a.stationName }}</div>
                <div class="ai-time">{{ a.time.slice(5, 16) }} · 已持续 {{ a.duration }}</div>
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

.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
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
.table-card { padding: 20px; }
.tc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.tc-title { font-size: 15px; font-weight: 600; }
.table-card :deep(.el-table) { flex: 1; }
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
  border-radius: 8px;
  border-left: 2px solid transparent;
  transition: background 0.15s;
  &:hover { background: $bg-soft; }
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
.ai-time { font-size: 11px; color: $text-muted; margin-top: 2px; }
.ai-status { flex-shrink: 0; align-self: center; }

@media (max-width: 1280px) {
  .kpi-grid { grid-template-columns: repeat(2, 1fr); }
  .row { grid-template-columns: 1fr; }
  .col-2 { grid-column: auto; }
}
</style>
