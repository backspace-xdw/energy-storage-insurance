<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import { insuranceCases } from '@/mock/data'
import { Document, Histogram, MagicStick } from '@element-plus/icons-vue'

const current = ref(insuranceCases[0])

const radarOption = computed(() => ({
  tooltip: {},
  radar: {
    indicator: [
      { name: '设备健康 (40%)', max: 40 },
      { name: '隐患告警 (30%)', max: 30 },
      { name: '运维合规 (20%)', max: 20 },
      { name: '环境安全 (10%)', max: 10 }
    ],
    radius: 110,
    splitArea: { areaStyle: { color: ['#f5f7fb', '#fff'] } },
    splitLine: { lineStyle: { color: '#e7eaf3' } },
    axisLine: { lineStyle: { color: '#dadfeb' } },
    name: { color: '#1a1f36', fontSize: 12 }
  },
  series: [{
    type: 'radar', name: '风险评分',
    data: [{
      value: [
        current.value.breakdown.health,
        current.value.breakdown.alarm,
        current.value.breakdown.ops,
        current.value.breakdown.env
      ],
      name: '当前风险评分',
      symbol: 'circle', symbolSize: 6,
      lineStyle: { color: '#06b6d4', width: 2 },
      areaStyle: {
        color: {
          type: 'radial', x: 0.5, y: 0.5, r: 0.5,
          colorStops: [
            { offset: 0, color: 'rgba(6,182,212,0.45)' },
            { offset: 1, color: 'rgba(1,94,234,0.15)' }
          ]
        }
      },
      itemStyle: { color: '#015eea' }
    }]
  }]
}))

const trendOption = {
  tooltip: { trigger: 'axis' },
  grid: { left: 35, right: 20, top: 30, bottom: 30 },
  xAxis: {
    type: 'category',
    data: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    axisLine: { lineStyle: { color: '#dadfeb' } },
    axisLabel: { color: '#525c75', fontSize: 11 }
  },
  yAxis: { type: 'value', min: 50, max: 100, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75' } },
  series: [{
    type: 'line', smooth: true,
    data: [82, 85, 84, 87, 86, 88, 86, 85, 87, 88, 87, 89],
    lineStyle: { color: '#015eea', width: 3 },
    itemStyle: { color: '#06b6d4' },
    symbol: 'circle', symbolSize: 6,
    areaStyle: {
      color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: 'rgba(6,182,212,0.35)' }, { offset: 1, color: 'rgba(1,94,234,0)' }]
      }
    },
    markLine: {
      symbol: 'none',
      data: [
        { yAxis: 90, label: { formatter: '低风险线 90', color: '#22d3a0' }, lineStyle: { color: '#22d3a0', type: 'dashed' } },
        { yAxis: 75, label: { formatter: '中低线 75', color: '#f59e0b' }, lineStyle: { color: '#f59e0b', type: 'dashed' } },
        { yAxis: 60, label: { formatter: '中风险线 60', color: '#ef4444' }, lineStyle: { color: '#ef4444', type: 'dashed' } }
      ]
    }
  }]
}

const compareOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { top: 0 },
  grid: { left: 30, right: 20, top: 36, bottom: 30 },
  xAxis: { type: 'category', data: ['健康', '告警', '运维', '环境'], axisLabel: { color: '#1a1f36' } },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f7' } } },
  series: [
    { name: '行业均值', type: 'bar', data: [33, 22, 16, 8], itemStyle: { color: '#cbd2e0', borderRadius: [4,4,0,0] } },
    {
      name: '本站点', type: 'bar',
      data: [current.value.breakdown.health, current.value.breakdown.alarm, current.value.breakdown.ops, current.value.breakdown.env],
      itemStyle: { color: '#015eea', borderRadius: [4,4,0,0] }
    }
  ]
}))

const levelColor = (l) => ({
  低风险: '#22d3a0', 中低风险: '#06b6d4', 中风险: '#f59e0b', 高风险: '#ef4444'
})[l] || '#999'
</script>

<template>
  <div class="underwriting">
    <PageHeader
      tag="UNDERWRITING"
      title="自主核保"
      desc="四维风险评分模型 · 自动核保决策 · 费率智能建议 · 核保报告自动生成"
    >
      <template #actions>
        <el-button :icon="Histogram">查看模型说明</el-button>
        <el-button :icon="MagicStick">重新计算评分</el-button>
        <el-button type="primary" :icon="Document">生成核保评估报告</el-button>
      </template>
    </PageHeader>

    <div class="layout">
      <!-- 站点列表 -->
      <div class="case-list card">
        <div class="cl-title">待核保 / 已核保站点</div>
        <div
          class="case-item"
          v-for="c in insuranceCases"
          :key="c.stationId"
          :class="{ active: current.stationId === c.stationId }"
          @click="current = c"
        >
          <div class="ci-name">{{ c.stationName }}</div>
          <div class="ci-meta">
            <div class="score" :style="{ color: levelColor(c.level) }">{{ c.score }}</div>
            <el-tag size="small" :color="levelColor(c.level)" effect="dark" style="border:none;color:#fff">{{ c.level }}</el-tag>
          </div>
        </div>
      </div>

      <!-- 主体 -->
      <div class="main">
        <!-- 评分概览 -->
        <div class="score-card card">
          <div class="sc-left">
            <div class="sc-station">{{ current.stationName }}</div>
            <div class="sc-id">站点编号 {{ current.stationId }}</div>
            <div class="sc-score-wrap">
              <div class="sc-score" :style="{ color: levelColor(current.level) }">{{ current.score }}</div>
              <div class="sc-unit">/ 100</div>
            </div>
            <el-tag :color="levelColor(current.level)" effect="dark" size="large" style="border:none;color:#fff">{{ current.level }}</el-tag>
            <div class="sc-suggest">
              <div class="ss-label">核保建议</div>
              <div class="ss-text">{{ current.suggestion }}</div>
            </div>
          </div>
          <div class="sc-right">
            <ChartCard title="四维风险雷达" :option="radarOption" height="320px" />
          </div>
        </div>

        <!-- 评分明细 -->
        <div class="breakdown card">
          <div class="bd-title">评分明细</div>
          <div class="bd-grid">
            <div class="bd-item">
              <div class="bd-l">设备健康风险（40%）</div>
              <div class="bd-bar">
                <div class="bg"><div class="fg" :style="{ width: (current.breakdown.health/40*100)+'%', background:'#015eea' }" /></div>
                <span class="bd-v">{{ current.breakdown.health }}/40</span>
              </div>
              <div class="bd-sub">电压稳定 · 温度均衡 · 绝缘 · SOH · 故障频次</div>
            </div>
            <div class="bd-item">
              <div class="bd-l">隐患告警风险（30%）</div>
              <div class="bd-bar">
                <div class="bg"><div class="fg" :style="{ width: (current.breakdown.alarm/30*100)+'%', background:'#06b6d4' }" /></div>
                <span class="bd-v">{{ current.breakdown.alarm }}/30</span>
              </div>
              <div class="bd-sub">告警总数 · 严重占比 · 未恢复 · 重复率 · 热失控相关</div>
            </div>
            <div class="bd-item">
              <div class="bd-l">运维合规风险（20%）</div>
              <div class="bd-bar">
                <div class="bg"><div class="fg" :style="{ width: (current.breakdown.ops/20*100)+'%', background:'#6366f1' }" /></div>
                <span class="bd-v">{{ current.breakdown.ops }}/20</span>
              </div>
              <div class="bd-sub">巡检完成 · 整改 · 年检 · 消防完好 · 操作规范</div>
            </div>
            <div class="bd-item">
              <div class="bd-l">环境与安全风险（10%）</div>
              <div class="bd-bar">
                <div class="bg"><div class="fg" :style="{ width: (current.breakdown.env/10*100)+'%', background:'#22d3a0' }" /></div>
                <span class="bd-v">{{ current.breakdown.env }}/10</span>
              </div>
              <div class="bd-sub">温湿度超标 · 气体异常 · 消防故障 · 舱门异常</div>
            </div>
          </div>
        </div>

        <div class="dual-row">
          <ChartCard title="12 个月评分趋势" desc="覆盖低/中低/中风险阈值线" :option="trendOption" height="280px" />
          <ChartCard title="与行业均值对比" desc="单站四维评分 vs 行业基线" :option="compareOption" height="280px" />
        </div>

        <!-- 决策面板 -->
        <div class="decision card">
          <div class="dc-head">
            <div class="dc-title">自动核保决策</div>
            <el-tag :color="levelColor(current.level)" effect="dark" size="small" style="border:none;color:#fff">{{ current.level }}</el-tag>
          </div>
          <div class="dc-grid">
            <div class="dc-item">
              <div class="dc-l">承保结论</div>
              <div class="dc-v">{{ current.level === '高风险' ? '不予承保' : (current.level === '中风险' ? '条件承保' : '正常承保') }}</div>
            </div>
            <div class="dc-item">
              <div class="dc-l">建议费率</div>
              <div class="dc-v">{{ current.rate }}</div>
            </div>
            <div class="dc-item">
              <div class="dc-l">费率策略</div>
              <div class="dc-v">{{ current.premium }}</div>
            </div>
            <div class="dc-item">
              <div class="dc-l">复核建议</div>
              <div class="dc-v">{{ current.level === '高风险' ? '专项评估' : '系统自动审批' }}</div>
            </div>
          </div>
          <el-alert
            :type="current.level === '高风险' ? 'error' : current.level === '中风险' ? 'warning' : 'success'"
            :title="current.suggestion"
            show-icon
            :closable="false"
            class="dc-alert"
          />
          <div class="dc-actions">
            <el-button>查看历史核保记录</el-button>
            <el-button type="primary">通过核保 · 生成保单</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.layout {
  display: grid; grid-template-columns: 280px 1fr; gap: 16px;
  align-items: flex-start;
}
.card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px; box-shadow: $shadow-card;
}
.cl-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
.case-item {
  padding: 12px; border-radius: 8px; cursor: pointer;
  display: flex; flex-direction: column; gap: 8px;
  transition: background 0.15s;
  &:hover { background: $bg-soft; }
  &.active { background: rgba(1, 94, 234, 0.08); border-left: 3px solid $brand-blue; padding-left: 9px; }
}
.ci-name { font-size: 13px; font-weight: 500; }
.ci-meta { display: flex; align-items: center; gap: 10px; }
.score { font-size: 20px; font-weight: 600; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; }

.main { display: flex; flex-direction: column; gap: 16px; }
.score-card { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.sc-station { font-size: 22px; font-weight: 600; }
.sc-id { font-size: 12px; color: $text-muted; margin-top: 4px; }
.sc-score-wrap { display: flex; align-items: baseline; gap: 6px; margin: 20px 0 14px; }
.sc-score { font-size: 80px; font-weight: 600; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; line-height: 1; }
.sc-unit { font-size: 18px; color: $text-muted; }
.sc-suggest { margin-top: 22px; padding-top: 16px; border-top: 1px solid $border-soft; }
.ss-label { font-size: 12px; color: $text-muted; }
.ss-text { font-size: 15px; font-weight: 500; margin-top: 6px; }

.breakdown { }
.bd-title { font-size: 14px; font-weight: 600; margin-bottom: 16px; }
.bd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.bd-item .bd-l { font-size: 13px; color: $text-secondary; }
.bd-bar { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.bd-bar .bg { flex: 1; height: 8px; background: $bg-soft; border-radius: 4px; overflow: hidden; }
.bd-bar .fg { height: 100%; border-radius: 4px; transition: width 0.4s; }
.bd-v { font-size: 13px; font-weight: 600; color: $brand-blue; min-width: 50px; text-align: right; }
.bd-sub { font-size: 11px; color: $text-muted; }

.dual-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.dc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.dc-title { font-size: 14px; font-weight: 600; }
.dc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.dc-item { background: $bg-soft; border-radius: 8px; padding: 14px; }
.dc-l { font-size: 12px; color: $text-muted; }
.dc-v { font-size: 18px; font-weight: 600; margin-top: 6px; color: $brand-blue; }
.dc-alert { margin-bottom: 16px; }
.dc-actions { display: flex; justify-content: flex-end; gap: 10px; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .score-card, .dual-row, .bd-grid, .dc-grid { grid-template-columns: 1fr; }
}
</style>
