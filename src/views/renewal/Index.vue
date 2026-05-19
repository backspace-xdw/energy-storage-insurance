<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import { renewals } from '@/mock/data'
import { Refresh, Document, BellFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const selected = ref(renewals[0])

function pickStation(r) { selected.value = r }
function notify() { ElMessage.success('已向客户经理推送续保提醒') }
function generateReport() { ElMessage.success('续保评估报告生成中，将于 30 秒内可下载') }

const trendOption = computed(() => {
  const months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  const base = selected.value.lastYearScore
  const cur = selected.value.currentScore
  const trend = selected.value.trend
  const series = months.map((_, i) => {
    const t = i / 11
    let v = base + (cur - base) * t
    if (trend === '稳定') v += (Math.sin(i * 0.9) * 1.5)
    if (trend === '下降') v += (Math.sin(i * 0.9) * 2 + Math.random() * 2)
    if (trend === '上升') v -= (Math.sin(i * 0.9) * 2 - Math.random() * 1.5)
    return +v.toFixed(1)
  })
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    legend: { top: 0, right: 0 },
    xAxis: { type: 'category', data: months, axisLabel: { color: '#525c75' } },
    yAxis: { type: 'value', min: 55, max: 100, splitLine: { lineStyle: { color: '#eef0f7' } } },
    series: [
      {
        name: '风险评分', type: 'line', smooth: true,
        data: series, lineStyle: { color: '#015eea', width: 3 },
        itemStyle: { color: '#015eea' }, symbol: 'circle', symbolSize: 6,
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: 'rgba(6,182,212,0.35)' }, { offset: 1, color: 'rgba(1,94,234,0)' }]
        }}
      }
    ]
  }
})

const alarmHeatOption = {
  tooltip: { position: 'top' },
  grid: { left: 60, right: 20, top: 30, bottom: 30 },
  xAxis: { type: 'category', data: ['1','2','3','4','5','6','7','8','9','10','11','12'], axisLabel: { color: '#525c75' } },
  yAxis: { type: 'category', data: ['提示','一般','重要','严重'], axisLabel: { color: '#525c75' } },
  visualMap: { min: 0, max: 14, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
    inRange: { color: ['#eff6ff', '#06b6d4', '#015eea', '#10152e'] }, textStyle: { fontSize: 11 } },
  series: [{
    type: 'heatmap',
    data: Array.from({ length: 48 }, (_, i) => [i % 12, Math.floor(i / 12), Math.floor(Math.random() * (4 - Math.floor(i/12)) * 4)]),
    label: { show: true, color: '#fff', fontSize: 10 }
  }]
}

const trendColor = (t) => ({ 下降: '#22d3a0', 稳定: '#06b6d4', 上升: '#ef4444' })[t]
</script>

<template>
  <div class="renewal">
    <PageHeader
      tag="RENEWAL"
      title="智能续保"
      desc="年度数据自动分析 · 风险趋势研判 · 自动续保策略 · 报告一键生成"
    >
      <template #actions>
        <el-button :icon="BellFilled" @click="notify">推送续保提醒</el-button>
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
        <div class="kp-l">建议续保</div>
        <div class="kp-v" style="color:#22d3a0">{{ renewals.filter(r => r.trend !== '上升').length }} <span>单</span></div>
        <div class="kp-sub">趋势下降 / 稳定</div>
      </div>
      <div class="kp-card">
        <div class="kp-l">建议提价</div>
        <div class="kp-v" style="color:#f59e0b">{{ renewals.filter(r => r.trend === '上升').length }} <span>单</span></div>
        <div class="kp-sub">风险趋势上升</div>
      </div>
      <div class="kp-card">
        <div class="kp-l">续保收入预估</div>
        <div class="kp-v" style="color:#015eea">1086 <span>万</span></div>
        <div class="kp-sub">本季度</div>
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
          <div class="li-row">
            <span class="li-name">{{ r.stationName }}</span>
            <el-tag size="small" :color="trendColor(r.trend)" effect="dark" style="border:none;color:#fff">{{ r.trend }}</el-tag>
          </div>
          <div class="li-meta">
            <span>保单 {{ r.policy }}</span>
            <span>剩余 {{ r.daysToExpire }} 天</span>
          </div>
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
              <div class="sm-sub">保单 {{ selected.policy }} · 到期 {{ selected.expireDate }}</div>
            </div>
            <el-tag :color="trendColor(selected.trend)" effect="dark" size="large" style="border:none;color:#fff">趋势：{{ selected.trend }}</el-tag>
          </div>
          <div class="sm-grid">
            <div>
              <div class="sm-l">上年评分</div>
              <div class="sm-v">{{ selected.lastYearScore }}</div>
            </div>
            <div>
              <div class="sm-l">当前评分</div>
              <div class="sm-v" :style="{ color: trendColor(selected.trend) }">{{ selected.currentScore }}</div>
            </div>
            <div>
              <div class="sm-l">年度运行</div>
              <div class="sm-v">{{ selected.runHours }} h</div>
            </div>
            <div>
              <div class="sm-l">循环次数</div>
              <div class="sm-v">{{ selected.cycleCount }} 次</div>
            </div>
          </div>
          <el-alert type="info" :closable="false" class="sm-alert" show-icon>
            <strong>续保建议：</strong>{{ selected.suggestion }}
          </el-alert>
        </div>

        <div class="dual">
          <ChartCard title="12 个月风险评分趋势" desc="对比承保初/中/末期" :option="trendOption" height="300px" />
          <ChartCard title="告警等级热力分布" desc="月份 × 告警等级 / 颜色深浅 = 数量" :option="alarmHeatOption" height="300px" />
        </div>

        <div class="strategy card">
          <div class="st-title">续保策略</div>
          <div class="st-grid">
            <div class="st-card">
              <div class="st-l">续保结论</div>
              <div class="st-v">{{ selected.trend === '上升' ? '附加条件续保' : '建议续保' }}</div>
            </div>
            <div class="st-card">
              <div class="st-l">费率调整</div>
              <div class="st-v">{{ selected.trend === '下降' ? '↓ 5%' : selected.trend === '上升' ? '↑ 8%' : '维持' }}</div>
            </div>
            <div class="st-card">
              <div class="st-l">提醒时间</div>
              <div class="st-v">T-30 / T-15 / T-7</div>
            </div>
            <div class="st-card">
              <div class="st-l">审批路径</div>
              <div class="st-v">系统自动 + 人工复核</div>
            </div>
          </div>
        </div>
      </div>
    </div>
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
  &:hover { background: $bg-soft; }
  &.active { background: rgba(1, 94, 234, 0.05); border-color: rgba(1, 94, 234, 0.18); }
}
.li-row { display: flex; justify-content: space-between; align-items: center; }
.li-name { font-size: 13px; font-weight: 500; }
.li-meta { display: flex; justify-content: space-between; font-size: 11px; color: $text-muted; margin: 6px 0; }
.li-bar .lb-bg { height: 4px; background: $bg-soft; border-radius: 2px; overflow: hidden; }
.li-bar .lb-fg { height: 100%; transition: width 0.4s; }

.main { display: flex; flex-direction: column; gap: 16px; }
.sm-head { display: flex; justify-content: space-between; align-items: center; }
.sm-station { font-size: 20px; font-weight: 600; }
.sm-sub { font-size: 12px; color: $text-muted; margin-top: 4px; }
.sm-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 20px; padding-top: 18px; border-top: 1px solid $border-soft; }
.sm-l { font-size: 12px; color: $text-muted; }
.sm-v { font-size: 22px; font-weight: 600; margin-top: 4px; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; }
.sm-alert { margin-top: 16px; }

.dual { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.st-title { font-size: 14px; font-weight: 600; margin-bottom: 14px; }
.st-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.st-card { background: $bg-soft; border-radius: 8px; padding: 14px; }
.st-l { font-size: 12px; color: $text-muted; }
.st-v { font-size: 16px; font-weight: 600; margin-top: 6px; color: $brand-blue; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .dual, .sm-grid, .st-grid, .kpi-row { grid-template-columns: 1fr 1fr; }
}
</style>
