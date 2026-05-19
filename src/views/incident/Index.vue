<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import { incidents, stations } from '@/mock/data'
import { Search, Document, Clock, Warning, MagicStick } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const selected = ref(incidents[0])
const tracing = ref(false)

function trace(it) {
  selected.value = it
  tracing.value = true
  setTimeout(() => { tracing.value = false }, 800)
}

function exportReport() { ElMessage.success(`已生成《${selected.value.id} 事故溯源报告》，可下载`) }

// 事故触发时间标记
const incidentTime = '2026-03-12 14:23:18'
// 时间轴关键事件
const events = [
  { time: '14:18:00', label: '簇电流异常波动', color: '#06b6d4' },
  { time: '14:21:42', label: 'PACK-07 单体压差>50mV 一级预警', color: '#f59e0b' },
  { time: '14:22:35', label: '温度梯度 4.8℃ 二级预警', color: '#f59e0b' },
  { time: '14:23:18', label: '热失控早期预警', color: '#ef4444' },
  { time: '14:23:25', label: '消防联动启动 / 灭火释放', color: '#ef4444' },
  { time: '14:24:02', label: '运维远程拉闸', color: '#015eea' },
  { time: '14:31:10', label: '温度回落、绝缘恢复', color: '#22d3a0' }
]

const tempOption = {
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
      name: 'PACK-07 最高温', type: 'line', smooth: true,
      data: [28.2,28.3,28.4,28.6,28.9,29.5,30.2,31.4,33.1,35.7,38.9,42.5,46.8,52.1,58.4,63.2,61.5,55.8,48.2,42.1,37.5,34.2,32.1,30.8,29.9,29.2,28.8,28.5,28.3,28.2],
      lineStyle: { color: '#ef4444', width: 2.5 },
      itemStyle: { color: '#ef4444' },
      markLine: {
        symbol: 'none',
        data: [
          { xAxis: 7, label: { formatter: '首预警', color: '#f59e0b' }, lineStyle: { color: '#f59e0b' } },
          { xAxis: 10, label: { formatter: '热失控', color: '#ef4444' }, lineStyle: { color: '#ef4444' } }
        ]
      }
    },
    {
      name: '同舱其他PACK均温', type: 'line', smooth: true,
      data: Array.from({ length: 30 }, () => 27.8 + Math.random() * 1.5),
      lineStyle: { color: '#06b6d4', width: 2, type: 'dashed' },
      itemStyle: { color: '#06b6d4' }
    }
  ]
}

const insulationOption = {
  tooltip: { trigger: 'axis' },
  grid: { left: 50, right: 25, top: 30, bottom: 30 },
  xAxis: {
    type: 'category',
    data: Array.from({ length: 30 }, (_, i) => `T${i-7 < 0 ? '-' : '+'}${Math.abs(i-7)}m`),
    axisLabel: { color: '#525c75', fontSize: 11 }
  },
  yAxis: { type: 'value', splitLine: { lineStyle: { color: '#eef0f7' } } },
  series: [{
    type: 'line', smooth: true, name: '簇绝缘电阻 (kΩ)',
    data: [4820,4815,4800,4760,4710,4520,4180,3620,2810,1840,920,420,180,80,35,18,42,180,560,1240,2380,3120,3680,4020,4280,4460,4580,4680,4760,4820],
    lineStyle: { color: '#015eea', width: 2.5 },
    itemStyle: { color: '#015eea' },
    areaStyle: { color: 'rgba(1,94,234,0.12)' }
  }]
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
        <el-button :icon="MagicStick">手动选时段</el-button>
        <el-button type="primary" :icon="Document" @click="exportReport">生成事故溯源报告</el-button>
      </template>
    </PageHeader>

    <!-- 查询条 -->
    <div class="query card">
      <el-select placeholder="选择站点" style="width: 240px">
        <el-option
          v-for="s in stations"
          :key="s.id"
          :label="s.name"
          :value="s.id"
        />
      </el-select>
      <el-date-picker type="datetime" placeholder="事故时间" style="width: 220px" />
      <el-input placeholder="设备位置（如 2#舱/3#簇/PACK-07）" style="width: 280px" />
      <el-button type="primary" :icon="Search" :loading="tracing" @click="trace(incidents[0])">
        启动溯源
      </el-button>
      <div class="qt">
        <el-icon><Clock /></el-icon>
        平均溯源耗时 <b>28 秒</b>
      </div>
    </div>

    <div class="layout">
      <!-- 事故列表 -->
      <div class="case card">
        <div class="title">历史事故</div>
        <div
          class="case-item"
          v-for="it in incidents"
          :key="it.id"
          :class="{ active: selected.id === it.id }"
          @click="trace(it)"
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
          <div class="ci-time">{{ it.time }}</div>
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
            <div class="ch-sub">{{ selected.stationName }}</div>
          </div>
          <div class="ch-stats">
            <div class="ch-stat"><div class="cs-l">事故时间</div><div class="cs-v">{{ selected.time }}</div></div>
            <div class="ch-stat"><div class="cs-l">事故等级</div><div class="cs-v">{{ selected.severity }}</div></div>
            <div class="ch-stat"><div class="cs-l">持续时长</div><div class="cs-v">{{ selected.duration }}</div></div>
            <div class="ch-stat"><div class="cs-l">损失评估</div><div class="cs-v">{{ selected.loss }}</div></div>
            <div class="ch-stat"><div class="cs-l">案件状态</div><div class="cs-v">{{ selected.status }}</div></div>
          </div>
        </div>

        <!-- 时间线 -->
        <div class="card">
          <div class="title">关键事件时间线</div>
          <div class="timeline">
            <div class="tl-item" v-for="(e, i) in events" :key="i">
              <div class="tl-dot" :style="{ background: e.color, boxShadow: `0 0 0 4px ${e.color}33` }" />
              <div class="tl-time">{{ e.time }}</div>
              <div class="tl-label" :style="{ color: e.color }">{{ e.label }}</div>
            </div>
          </div>
        </div>

        <!-- 曲线对齐 -->
        <div class="dual">
          <ChartCard title="PACK-07 vs 同舱均温" desc="对齐至事故触发点 T0（首预警 = T-3min）" :option="tempOption" height="300px" />
          <ChartCard title="簇绝缘电阻变化" desc="事故前后 30 分钟" :option="insulationOption" height="300px" />
        </div>

        <!-- 溯源结论 -->
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
          <el-alert type="success" :closable="false" show-icon class="root-alert">
            <strong>责任界定建议：</strong>PACK-07 存在出厂批次缺陷（电芯一致性差），属设备质量责任；运维方响应及时无过错；消防联动有效阻断事故扩大化。
          </el-alert>
          <div class="root-actions">
            <el-button>查看完整数据包</el-button>
            <el-button>查看视频证据</el-button>
            <el-button type="primary" :icon="Document" @click="exportReport">生成理赔证据报告</el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.query {
  display: flex; gap: 12px; align-items: center; margin-bottom: 16px;
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

.layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; }

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
.ci-time { font-size: 11px; color: $text-muted; margin-top: 4px; }

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

.timeline {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 0;
  position: relative;
  &::before {
    content: '';
    position: absolute; top: 12px; left: 6%; right: 6%; height: 2px;
    background: linear-gradient(90deg, $brand-cyan, #ef4444, $brand-blue, #22d3a0);
  }
}
.tl-item { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; position: relative; }
.tl-dot {
  width: 16px; height: 16px; border-radius: 50%;
  position: relative; z-index: 2;
  border: 3px solid #fff;
}
.tl-time { font-family: monospace; font-size: 12px; color: $text-secondary; font-weight: 600; }
.tl-label { font-size: 11px; line-height: 1.4; max-width: 110px; }

.dual { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.root-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.rg-l { font-size: 12px; color: $text-muted; }
.rg-v { font-size: 14px; margin-top: 6px; font-weight: 500; }
.root-alert { margin-bottom: 16px; }
.root-actions { display: flex; justify-content: flex-end; gap: 10px; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .timeline { grid-template-columns: repeat(2, 1fr); gap: 12px; &::before { display: none; } }
  .dual, .ch-stats, .root-grid { grid-template-columns: 1fr 1fr; }
}
</style>
