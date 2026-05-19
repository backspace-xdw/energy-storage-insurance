<script setup>
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import { alarms, stations } from '@/mock/data'
import { Refresh, Filter, BellFilled } from '@element-plus/icons-vue'

const filterLevel = ref('')

const gauge = (val) => ({
  series: [{
    type: 'gauge', radius: '100%',
    startAngle: 220, endAngle: -40,
    progress: { show: true, width: 14, itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#015eea' }] } } },
    axisLine: { lineStyle: { width: 14, color: [[1, '#eef0f7']] } },
    pointer: { show: false },
    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
    detail: { valueAnimation: true, offsetCenter: [0, 0], color: '#015eea', fontSize: 32, fontWeight: 600, formatter: '{value}' },
    data: [{ value: val }]
  }]
})

const heatOption = {
  tooltip: { position: 'top' },
  grid: { left: 80, right: 20, top: 30, bottom: 40 },
  xAxis: { type: 'category', data: ['0','2','4','6','8','10','12','14','16','18','20','22'], axisLabel: { color: '#525c75' } },
  yAxis: { type: 'category', data: stations.map(s => s.name.slice(0, 4)), axisLabel: { color: '#525c75', fontSize: 11 } },
  visualMap: { min: 0, max: 5, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
    inRange: { color: ['#f5f7fb', '#06b6d4', '#015eea', '#ef4444'] }, textStyle: { fontSize: 11 } },
  series: [{
    type: 'heatmap',
    data: Array.from({ length: 12 * stations.length }, (_, i) => [
      i % 12, Math.floor(i / 12), Math.floor(Math.random() * 6)
    ])
  }]
}

const radarOption = {
  tooltip: {},
  radar: {
    indicator: [
      { name: '设备健康', max: 100 },
      { name: '隐患告警', max: 100 },
      { name: '运维合规', max: 100 },
      { name: '环境安全', max: 100 },
      { name: '消防完好', max: 100 },
      { name: '人员合规', max: 100 }
    ],
    radius: 110,
    splitArea: { areaStyle: { color: ['#f8fafc', '#fff'] } },
    splitLine: { lineStyle: { color: '#e7eaf3' } },
    name: { color: '#1a1f36', fontSize: 12 }
  },
  series: [
    {
      type: 'radar', name: '全网均值',
      data: [{
        value: [88, 76, 82, 90, 95, 88], name: '全网均值',
        lineStyle: { color: '#06b6d4', width: 2 },
        areaStyle: { color: 'rgba(6,182,212,0.3)' },
        itemStyle: { color: '#015eea' }
      }]
    }
  ]
}

const stats = {
  total: alarms.length,
  active: alarms.filter(a => a.status !== '已恢复').length,
  severe: alarms.filter(a => a.level === '严重').length,
  recovered: alarms.filter(a => a.status === '已恢复').length,
  avgResp: '4.2 min',
  riskIndex: 78
}
</script>

<template>
  <div class="risk">
    <PageHeader
      tag="RISK"
      title="风险监测"
      desc="基于多维度数据的实时风险监控与预警 · 风控前置 · 主动干预"
    >
      <template #actions>
        <el-button :icon="Filter">筛选</el-button>
        <el-button type="primary" :icon="Refresh">刷新</el-button>
      </template>
    </PageHeader>

    <div class="top">
      <div class="overview card">
        <div class="ov-head">
          <div class="ov-title">实时风险指数</div>
          <el-tag type="warning" effect="light" size="small">中等</el-tag>
        </div>
        <ChartCard :option="gauge(stats.riskIndex)" height="180px" />
        <div class="ov-grid">
          <div><div class="og-l">在线告警</div><div class="og-v">{{ stats.active }}</div></div>
          <div><div class="og-l">严重</div><div class="og-v" style="color:#ef4444">{{ stats.severe }}</div></div>
          <div><div class="og-l">已恢复</div><div class="og-v" style="color:#22d3a0">{{ stats.recovered }}</div></div>
          <div><div class="og-l">平均响应</div><div class="og-v" style="color:#015eea">{{ stats.avgResp }}</div></div>
        </div>
      </div>

      <ChartCard
        class="span2"
        title="承保站点 × 时段告警热力图"
        desc="近 24 小时按站点分布"
        :option="heatOption"
        height="320px"
      />

      <ChartCard
        title="全网六维风控雷达"
        :option="radarOption"
        height="320px"
      />
    </div>

    <div class="alert-section">
      <div class="as-head">
        <div class="title">实时告警明细</div>
        <el-radio-group v-model="filterLevel" size="small">
          <el-radio-button label="">全部 {{ alarms.length }}</el-radio-button>
          <el-radio-button label="严重">严重</el-radio-button>
          <el-radio-button label="重要">重要</el-radio-button>
          <el-radio-button label="一般">一般</el-radio-button>
          <el-radio-button label="提示">提示</el-radio-button>
        </el-radio-group>
      </div>
      <el-table
        :data="alarms.filter(a => !filterLevel || a.level === filterLevel)"
        stripe size="default"
      >
        <el-table-column prop="id" label="告警编号" width="110" />
        <el-table-column label="等级" width="90">
          <template #default="{ row }">
            <el-tag size="small"
              :type="row.level === '严重' ? 'danger' : row.level === '重要' ? 'warning' : row.level === '提示' ? 'info' : ''">
              {{ row.level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="time" label="发生时间" width="170" />
        <el-table-column prop="stationName" label="站点" min-width="160" />
        <el-table-column prop="location" label="位置" min-width="190" />
        <el-table-column prop="type" label="告警类型" width="140" />
        <el-table-column prop="duration" label="持续时长" width="100" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === '已恢复' ? 'success' : row.status === '处置中' ? 'warning' : 'danger'">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default>
            <el-button text type="primary">查看详情</el-button>
            <el-button text type="primary">处置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.top { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 16px; margin-bottom: 20px; }
.span2 { grid-column: span 1; }
.card { background: $bg-card; border: 1px solid $border-soft; border-radius: $radius; padding: 18px 20px; box-shadow: $shadow-card; }
.ov-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.ov-title { font-size: 14px; font-weight: 600; }
.ov-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 8px; padding-top: 12px; border-top: 1px solid $border-soft; text-align: center; }
.og-l { font-size: 11px; color: $text-muted; }
.og-v { font-size: 20px; font-weight: 600; margin-top: 4px; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; }

.alert-section {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px; box-shadow: $shadow-card;
}
.as-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.title { font-size: 15px; font-weight: 600; }

@media (max-width: 1300px) {
  .top { grid-template-columns: 1fr 1fr; }
}
</style>
