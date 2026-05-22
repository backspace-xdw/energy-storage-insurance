<script setup>
import { ref, computed, reactive, watch } from 'vue'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import { insuranceCases } from '@/mock/data'
import {
  Document, Histogram, MagicStick, QuestionFilled,
  CircleCheckFilled, Warning, Loading
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUnderwritingStore } from '@/stores/underwriting'

const store = useUnderwritingStore()

const current = ref(insuranceCases[0])
const currentDecision = computed(() => store.getDecision(current.value.stationId))

/* ---------- 关键扣分项 ---------- */
const DIM_MAX = { health: 40, alarm: 30, ops: 20, env: 10 }
const DIM_LABEL = { health: '设备健康', alarm: '隐患告警', ops: '运维合规', env: '环境安全' }
const topDeductions = computed(() => {
  const b = current.value.breakdown
  // 扣分率最高的前 2 项
  return ['health', 'alarm', 'ops', 'env']
    .map(k => ({ key: k, label: DIM_LABEL[k], score: b[k], max: DIM_MAX[k], lossRate: 1 - b[k] / DIM_MAX[k] }))
    .sort((a, b) => b.lossRate - a.lossRate)
    .slice(0, 2)
    .filter(d => d.lossRate > 0.05)
})

const DEDUCTION_HINTS = {
  health: '电压/温度/绝缘/SOH 中某项指标处于阈值边缘，建议复检电芯一致性',
  alarm:  '近 30 天告警频次或严重占比偏高，建议梳理重复告警并制定整改计划',
  ops:    '巡检完成率或整改时效未达标，建议加强月度合规检查',
  env:    '舱内温湿度/气体/消防完好率偏低，需现场核查环境基线'
}

/* ---------- 雷达 ---------- */
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
    axisName: { color: '#1a1f36', fontSize: 12 }
  },
  series: [{
    type: 'radar', name: '风险评分',
    data: [{
      value: [current.value.breakdown.health, current.value.breakdown.alarm, current.value.breakdown.ops, current.value.breakdown.env],
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

/* ---------- 12 月趋势按站点 ---------- */
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
const trendOption = computed(() => {
  const rnd = mulberry32(hashSeed(current.value.stationId))
  const target = current.value.score
  const data = []
  for (let i = 0; i < 12; i++) {
    // 月份越近越接近 target，前期波动更大
    const noise = (rnd() - 0.5) * 8
    const drift = target + noise + (12 - i) * (rnd() - 0.5) * 0.6
    data.push(Math.round(Math.max(50, Math.min(100, drift))))
  }
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 35, right: 20, top: 30, bottom: 30 },
    xAxis: {
      type: 'category', data: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
      axisLine: { lineStyle: { color: '#dadfeb' } },
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    yAxis: { type: 'value', min: 50, max: 100, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75' } },
    series: [{
      type: 'line', smooth: true,
      data,
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
})

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

const statusMeta = (s) => ({
  pending:  { label: '待核保', color: '#8a93a8', tag: 'info' },
  approved: { label: '已通过', color: '#06b6d4', tag: 'primary' },
  rejected: { label: '已驳回', color: '#ef4444', tag: 'danger' },
  policied: { label: '已生成保单', color: '#22d3a0', tag: 'success' }
})[s] || { label: s, color: '#8a93a8', tag: 'info' }

/* ---------- 保费试算 ---------- */
const calc = reactive({
  baseRate: 0.85,    // %
  coverage: 3000,    // 万
  deductible: 5,     // %
})
// 初始化按当前 station 等级
function syncCalcWithLevel() {
  const r = parseFloat(current.value.rate) || 1.0
  calc.baseRate = isNaN(r) ? 1.5 : r
  // 覆盖金额按容量估算
  calc.coverage = 3000
  calc.deductible = 5
}
syncCalcWithLevel()
watch(() => current.value.stationId, syncCalcWithLevel)

// 风险溢价：基于评分偏离 90 分的差
const riskPremium = computed(() => {
  // 90 分对应 0 溢价，60 分对应 60% 溢价
  const diff = Math.max(0, 90 - current.value.score)
  return +(diff * 2.0).toFixed(0) / 100 // 0..0.6
})
const premium = computed(() => {
  if (current.value.level === '高风险') return null
  // 年保费 = 承保金额 × 费率 × (1 + 风险溢价) × (1 - 免赔率 × 0.2)
  const base = calc.coverage * 10000 * (calc.baseRate / 100)
  const adjusted = base * (1 + riskPremium.value) * (1 - calc.deductible * 0.002)
  return Math.round(adjusted)
})
function fmtMoney(n) {
  if (n == null) return '—'
  if (n >= 100_0000) return (n / 100_0000).toFixed(2) + ' 亿'
  if (n >= 10000) return (n / 10000).toFixed(2) + ' 万'
  return n.toLocaleString()
}

/* ---------- Dialogs ---------- */
const modelDialog = ref(false)
const historyDialog = ref(false)

/* ---------- 重新计算 ---------- */
const recalculating = ref(false)
async function recalculate() {
  recalculating.value = true
  ElMessage.info('正在拉取最新设备/告警/巡检数据并重算评分…')
  await new Promise(r => setTimeout(r, 1500))
  recalculating.value = false
  ElMessage.success(`${current.value.stationName} 评分已刷新（与上次一致：${current.value.score}）`)
}

/* ---------- 通过核保 / 驳回 ---------- */
async function approve() {
  const lvl = current.value.level
  if (lvl === '高风险') {
    ElMessage.error('高风险站点不予直接承保，建议转专项评估')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认按 ${current.value.score} 分 / ${calc.baseRate}% 费率 通过 ${current.value.stationName} 的核保？\n年保费约 ${fmtMoney(premium.value)}`,
      '通过核保',
      { confirmButtonText: '通过', cancelButtonText: '取消', type: 'success' }
    )
  } catch { return }
  store.setDecision(current.value.stationId, {
    status: 'approved',
    approvedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    rate: calc.baseRate,
    coverage: calc.coverage,
    deductible: calc.deductible,
    premium: premium.value,
    by: '当前用户'
  })
  ElMessage.success('核保已通过，可点击"生成保单"继续')
}

async function reject() {
  try {
    await ElMessageBox.prompt('请简述驳回理由', '驳回核保', {
      confirmButtonText: '提交驳回', cancelButtonText: '取消',
      type: 'warning',
      inputType: 'textarea'
    })
  } catch { return }
  store.setDecision(current.value.stationId, {
    status: 'rejected',
    approvedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    by: '当前用户'
  })
  ElMessage.success('已驳回')
}

async function issuePolicy() {
  const d = currentDecision.value
  if (d.status !== 'approved') {
    ElMessage.warning('请先通过核保')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将为 ${current.value.stationName} 生成正式保单，年保费 ${fmtMoney(d.premium)}，承保金额 ${d.coverage} 万。`,
      '生成保单', { confirmButtonText: '生成保单', cancelButtonText: '再想想', type: 'info' }
    )
  } catch { return }
  store.setDecision(current.value.stationId, {
    status: 'policied'
  })
  ElMessage.success(`${current.value.stationName} 保单已生成`)
}

function resetDecision() {
  store.clearDecision(current.value.stationId)
  ElMessage.success('已重置该站点核保状态')
}

/* ---------- 生成报告 ---------- */
function generateReport() {
  const c = current.value
  const d = currentDecision.value
  const report = {
    reportId: 'UW-' + c.stationId + '-' + dayjs().format('YYYYMMDD-HHmm'),
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    station: { id: c.stationId, name: c.stationName },
    overallScore: c.score,
    level: c.level,
    breakdown: {
      health: { score: c.breakdown.health, max: 40, weight: '40%' },
      alarm:  { score: c.breakdown.alarm,  max: 30, weight: '30%' },
      ops:    { score: c.breakdown.ops,    max: 20, weight: '20%' },
      env:    { score: c.breakdown.env,    max: 10, weight: '10%' }
    },
    topDeductions: topDeductions.value.map(t => ({ dimension: t.label, score: `${t.score}/${t.max}`, hint: DEDUCTION_HINTS[t.key] })),
    suggestion: c.suggestion,
    pricing: {
      baseRate: calc.baseRate + '%',
      coverage: calc.coverage + ' 万',
      deductible: calc.deductible + '%',
      riskPremium: (riskPremium.value * 100).toFixed(1) + '%',
      annualPremium: premium.value
    },
    decision: d.status === 'pending' ? '待核保' : statusMeta(d.status).label,
    approval: d.status !== 'pending' ? {
      at: d.approvedAt, by: d.by, rate: d.rate, coverage: d.coverage, premium: d.premium
    } : null
  }
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `核保评估报告-${c.stationName}-${dayjs().format('YYYYMMDD-HHmm')}.json`; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已生成 ${c.stationName} 核保评估报告`)
}
</script>

<template>
  <div class="underwriting">
    <PageHeader
      tag="UNDERWRITING"
      title="自主核保"
      desc="四维风险评分模型 · 自动核保决策 · 费率智能建议 · 核保报告自动生成"
    >
      <template #actions>
        <el-button :icon="QuestionFilled" @click="modelDialog = true">模型说明</el-button>
        <el-button :icon="MagicStick" :loading="recalculating" @click="recalculate">重新计算评分</el-button>
        <el-button type="primary" :icon="Document" @click="generateReport">生成核保评估报告</el-button>
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
          <div class="ci-row">
            <div class="ci-name">{{ c.stationName }}</div>
            <span class="ci-status" :style="{ background: statusMeta(store.getDecision(c.stationId).status).color }">
              {{ statusMeta(store.getDecision(c.stationId).status).label }}
            </span>
          </div>
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
            <div class="sc-id">站点编号 {{ current.stationId }} · 状态：
              <span :style="{ color: statusMeta(currentDecision.status).color, fontWeight: 600 }">
                {{ statusMeta(currentDecision.status).label }}
              </span>
              <span v-if="currentDecision.approvedAt" class="sc-time">· {{ currentDecision.approvedAt }}</span>
            </div>
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
          <div class="bd-title-row">
            <div class="bd-title">评分明细</div>
            <div class="bd-tops" v-if="topDeductions.length">
              <span class="bt-l">主要扣分：</span>
              <span class="bt-chip" v-for="t in topDeductions" :key="t.key" :title="DEDUCTION_HINTS[t.key]">
                <el-icon><Warning /></el-icon>
                {{ t.label }} {{ t.score }}/{{ t.max }}
              </span>
            </div>
          </div>
          <div class="bd-grid">
            <div class="bd-item" v-for="dim in ['health','alarm','ops','env']" :key="dim"
                 :class="{ 'low': topDeductions.some(t => t.key === dim) }">
              <div class="bd-l">
                {{ dim === 'health' ? '设备健康风险（40%）' : dim === 'alarm' ? '隐患告警风险（30%）' : dim === 'ops' ? '运维合规风险（20%）' : '环境与安全风险（10%）' }}
              </div>
              <div class="bd-bar">
                <div class="bg">
                  <div class="fg" :style="{
                    width: (current.breakdown[dim] / DIM_MAX[dim] * 100) + '%',
                    background: dim === 'health' ? '#015eea' : dim === 'alarm' ? '#06b6d4' : dim === 'ops' ? '#6366f1' : '#22d3a0'
                  }" />
                </div>
                <span class="bd-v">{{ current.breakdown[dim] }}/{{ DIM_MAX[dim] }}</span>
              </div>
              <div class="bd-sub">
                {{ dim === 'health' ? '电压稳定 · 温度均衡 · 绝缘 · SOH · 故障频次'
                 : dim === 'alarm'  ? '告警总数 · 严重占比 · 未恢复 · 重复率 · 热失控相关'
                 : dim === 'ops'    ? '巡检完成 · 整改 · 年检 · 消防完好 · 操作规范'
                 :                    '温湿度超标 · 气体异常 · 消防故障 · 舱门异常' }}
              </div>
            </div>
          </div>
        </div>

        <div class="dual-row">
          <ChartCard title="12 个月评分趋势" desc="覆盖低/中低/中风险阈值线" :option="trendOption" height="280px" />
          <ChartCard title="与行业均值对比" desc="单站四维评分 vs 行业基线" :option="compareOption" height="280px" />
        </div>

        <!-- 保费试算 -->
        <div class="calc card">
          <div class="dc-head">
            <div class="dc-title">保费试算</div>
            <el-tag size="small" effect="plain">基于当前评分 {{ current.score }} 自动调整</el-tag>
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
              <div class="cs-tip">90 分为基准，每低 1 分加 2% 溢价</div>
            </div>
            <div class="cr-arrow">→</div>
            <div class="cr-stat big">
              <div class="cs-l">预估年保费</div>
              <div class="cs-v big" :class="current.level === '高风险' ? 'err' : ''">
                {{ premium == null ? '不予承保' : '¥ ' + fmtMoney(premium) }}
              </div>
              <div class="cs-tip" v-if="premium != null">
                = {{ calc.coverage }}万 × {{ calc.baseRate }}% × (1 + {{ (riskPremium * 100).toFixed(0) }}%) × (1 - 免赔调整)
              </div>
            </div>
          </div>
        </div>

        <!-- 决策面板 -->
        <div class="decision card">
          <div class="dc-head">
            <div class="dc-title">自动核保决策</div>
            <div class="dc-tags">
              <el-tag :type="statusMeta(currentDecision.status).tag" effect="dark" size="small">
                {{ statusMeta(currentDecision.status).label }}
              </el-tag>
              <el-tag :color="levelColor(current.level)" effect="dark" size="small" style="border:none;color:#fff">{{ current.level }}</el-tag>
            </div>
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
            <el-button @click="historyDialog = true">查看历史核保记录</el-button>
            <el-button v-if="currentDecision.status !== 'pending'" plain @click="resetDecision">重置状态</el-button>
            <el-button
              v-if="currentDecision.status === 'pending'"
              type="danger" plain
              @click="reject"
            >驳回</el-button>
            <el-button
              v-if="currentDecision.status === 'pending'"
              type="primary"
              :icon="CircleCheckFilled"
              :disabled="current.level === '高风险'"
              @click="approve"
            >通过核保</el-button>
            <el-button
              v-if="currentDecision.status === 'approved'"
              type="success"
              :icon="Document"
              @click="issuePolicy"
            >生成保单</el-button>
            <el-tag v-if="currentDecision.status === 'policied'" type="success" size="large">
              <el-icon><CircleCheckFilled /></el-icon>
              保单已生成
            </el-tag>
          </div>
        </div>
      </div>
    </div>

    <!-- 模型说明对话框 -->
    <el-dialog v-model="modelDialog" title="核保评分模型说明" width="640">
      <div class="model-doc">
        <div class="md-section">
          <div class="md-title">总分公式</div>
          <pre class="md-formula">
风险评分 = 设备健康(40) + 隐患告警(30) + 运维合规(20) + 环境安全(10)
        </pre>
        </div>
        <div class="md-section">
          <div class="md-title">等级阈值</div>
          <table class="md-table">
            <thead><tr><th>分数</th><th>等级</th><th>承保结论</th><th>费率参考</th></tr></thead>
            <tbody>
              <tr><td>≥ 90</td><td style="color:#22d3a0">低风险</td><td>正常承保</td><td>0.85%</td></tr>
              <tr><td>75–89</td><td style="color:#06b6d4">中低风险</td><td>正常承保</td><td>0.95%</td></tr>
              <tr><td>60–74</td><td style="color:#f59e0b">中风险</td><td>条件承保</td><td>1.15%</td></tr>
              <tr><td>&lt; 60</td><td style="color:#ef4444">高风险</td><td>不予承保</td><td>—</td></tr>
            </tbody>
          </table>
        </div>
        <div class="md-section">
          <div class="md-title">维度因子</div>
          <ul class="md-ul">
            <li><b>设备健康 (40%)</b>：电压稳定、温度均衡、绝缘电阻、平均 SOH、年故障频次</li>
            <li><b>隐患告警 (30%)</b>：30 天告警数、严重占比、未恢复率、重复告警率、热失控相关</li>
            <li><b>运维合规 (20%)</b>：月度巡检完成率、隐患整改时效、年检通过率、消防完好率、操作规范</li>
            <li><b>环境与安全 (10%)</b>：温湿度超标天数、气体异常次数、消防故障率、舱门异常</li>
          </ul>
        </div>
        <div class="md-section">
          <div class="md-title">风险溢价</div>
          <div class="md-p">以 90 分为基准，每低 1 分增加 2% 风险溢价；年保费 = 承保金额 × 费率 × (1 + 风险溢价) × (1 − 免赔调整)。</div>
        </div>
      </div>
    </el-dialog>

    <!-- 历史核保对话框 -->
    <el-dialog v-model="historyDialog" :title="`${current.stationName} 历史核保记录`" width="560">
      <div class="hist-list">
        <div class="hist-item" v-if="currentDecision.status !== 'pending'">
          <div class="hi-time">{{ currentDecision.approvedAt }}</div>
          <div class="hi-body">
            <div class="hi-title">
              <el-tag :type="statusMeta(currentDecision.status).tag" effect="dark" size="small">
                {{ statusMeta(currentDecision.status).label }}
              </el-tag>
              <span class="hi-by">{{ currentDecision.by }}</span>
            </div>
            <div class="hi-info" v-if="currentDecision.rate">
              费率 {{ currentDecision.rate }}% · 承保 {{ currentDecision.coverage }}万 · 年保费 ¥ {{ fmtMoney(currentDecision.premium) }}
            </div>
          </div>
        </div>
        <div class="hist-item">
          <div class="hi-time">{{ dayjs().subtract(12, 'month').format('YYYY-MM-DD') }}</div>
          <div class="hi-body">
            <div class="hi-title">
              <el-tag type="info" size="small">首次核保</el-tag>
              <span class="hi-by">系统自动</span>
            </div>
            <div class="hi-info">评分 {{ current.score - 2 }} 分 · 费率 {{ current.rate }} · 保单 JT-2026-{{ 10000 + insuranceCases.indexOf(current) }}</div>
          </div>
        </div>
        <div class="hi-empty" v-if="currentDecision.status === 'pending' && current === insuranceCases[0]">
          <el-icon><Histogram /></el-icon>
          暂无更早的核保记录
        </div>
      </div>
    </el-dialog>
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
.ci-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.ci-name { font-size: 13px; font-weight: 500; }
.ci-status {
  font-size: 10px; padding: 2px 7px; border-radius: 9px; color: #fff; font-weight: 500;
  flex-shrink: 0;
}
.ci-meta { display: flex; align-items: center; gap: 10px; }
.score { font-size: 20px; font-weight: 600; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; }

.main { display: flex; flex-direction: column; gap: 16px; }
.score-card { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.sc-station { font-size: 22px; font-weight: 600; }
.sc-id { font-size: 12px; color: $text-muted; margin-top: 4px; }
.sc-time { margin-left: 4px; }
.sc-score-wrap { display: flex; align-items: baseline; gap: 6px; margin: 20px 0 14px; }
.sc-score { font-size: 80px; font-weight: 600; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; line-height: 1; }
.sc-unit { font-size: 18px; color: $text-muted; }
.sc-suggest { margin-top: 22px; padding-top: 16px; border-top: 1px solid $border-soft; }
.ss-label { font-size: 12px; color: $text-muted; }
.ss-text { font-size: 15px; font-weight: 500; margin-top: 6px; }

.bd-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.bd-title { font-size: 14px; font-weight: 600; }
.bd-tops { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.bt-l { font-size: 12px; color: $text-muted; }
.bt-chip {
  font-size: 11px; padding: 3px 10px; border-radius: 12px;
  background: rgba(245,158,11,0.12); color: #d97706; font-weight: 500;
  display: inline-flex; align-items: center; gap: 4px;
  cursor: help;
}
.bd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.bd-item {
  padding: 12px; border-radius: 8px; border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;
  &.low { background: rgba(245,158,11,0.05); border-color: rgba(245,158,11,0.2); }
}
.bd-item .bd-l { font-size: 13px; color: $text-secondary; }
.bd-bar { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.bd-bar .bg { flex: 1; height: 8px; background: $bg-soft; border-radius: 4px; overflow: hidden; }
.bd-bar .fg { height: 100%; border-radius: 4px; transition: width 0.4s; }
.bd-v { font-size: 13px; font-weight: 600; color: $brand-blue; min-width: 50px; text-align: right; }
.bd-sub { font-size: 11px; color: $text-muted; }

.dual-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* === 保费试算 === */
.calc-row { display: flex; gap: 24px; flex-wrap: wrap; padding: 8px 0 16px; }
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
  &.err  { color: #ef4444; }
  &.big  { font-size: 28px; color: #015eea; }
}
.cs-tip { font-size: 11px; color: $text-muted; }
.cr-arrow { font-size: 22px; color: $text-muted; }

.dc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
.dc-tags { display: flex; gap: 8px; }
.dc-title { font-size: 14px; font-weight: 600; }
.dc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.dc-item { background: $bg-soft; border-radius: 8px; padding: 14px; }
.dc-l { font-size: 12px; color: $text-muted; }
.dc-v { font-size: 18px; font-weight: 600; margin-top: 6px; color: $brand-blue; }
.dc-alert { margin-bottom: 16px; }
.dc-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }

/* === Model dialog === */
.model-doc { font-size: 13px; line-height: 1.7; color: $text-secondary; }
.md-section { margin-bottom: 18px; }
.md-title { font-size: 13px; font-weight: 600; color: $text-primary; margin-bottom: 8px; }
.md-formula { background: $bg-soft; padding: 10px 14px; border-radius: 6px; font-family: monospace; color: $brand-blue; font-size: 12px; margin: 0; }
.md-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.md-table th, .md-table td { padding: 8px 12px; border-bottom: 1px solid $border-soft; text-align: left; }
.md-table th { background: $bg-soft; color: $text-muted; font-weight: 600; }
.md-ul { padding-left: 18px; margin: 0;
  li { margin-bottom: 6px; }
  b { color: $text-primary; }
}
.md-p { background: $bg-soft; padding: 10px 14px; border-radius: 6px; }

/* === History dialog === */
.hist-list { display: flex; flex-direction: column; gap: 12px; }
.hist-item {
  display: grid; grid-template-columns: 110px 1fr; gap: 14px;
  padding: 12px 14px; border: 1px solid $border-soft; border-radius: 8px; background: $bg-card;
}
.hi-time { font-size: 12px; color: $text-muted; font-family: $font-num; }
.hi-title { display: flex; align-items: center; gap: 8px; }
.hi-by { font-size: 12px; color: $text-muted; }
.hi-info { font-size: 12px; color: $text-secondary; margin-top: 6px; line-height: 1.6; }
.hi-empty { padding: 24px; text-align: center; color: $text-muted; font-size: 13px; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
  .score-card, .dual-row, .bd-grid, .dc-grid { grid-template-columns: 1fr; }
  .calc-row { flex-direction: column; align-items: stretch; }
}
</style>
