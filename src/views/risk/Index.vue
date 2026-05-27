<script setup>
import { ref, computed, reactive } from 'vue'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import { alarms, stations, incidents, evidences } from '@/mock/data'
import {
  Refresh, Filter, BellFilled, Search, Document,
  Check, Tools, Warning
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRiskStore } from '@/stores/risk'

const store = useRiskStore()

/* ---------- 稳定随机 ---------- */
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

/* ---------- 状态合并（store 处置优先） ---------- */
function effectiveStatus(a) {
  const d = store.getDisposal(a.id)
  return d?.status || a.status
}

/* ---------- 统计（基于真实/处置后状态） ---------- */
const stats = computed(() => {
  const list = alarms.map(a => ({ ...a, status: effectiveStatus(a) }))
  const active = list.filter(a => a.status !== '已恢复')
  const severe = list.filter(a => a.level === '严重')
  const recovered = list.filter(a => a.status === '已恢复')
  // 风险指数 = 100 - (active * 1.5 + severe * 4) (clamped) + station avg score 加权
  const stationAvg = stations.reduce((s, x) => s + x.riskScore, 0) / stations.length
  const idx = Math.max(0, Math.min(100, Math.round(stationAvg - active.length * 1.5 - severe.length * 4)))
  return {
    total: list.length,
    active: active.length,
    severe: severe.length,
    recovered: recovered.length,
    avgResp: '4.2 min',
    riskIndex: idx
  }
})

const riskLevelMeta = computed(() => {
  const v = stats.value.riskIndex
  if (v >= 85) return { label: '低风险', color: '#22d3a0', type: 'success' }
  if (v >= 70) return { label: '中等', color: '#06b6d4', type: 'primary' }
  if (v >= 55) return { label: '偏高', color: '#f59e0b', type: 'warning' }
  return { label: '高风险', color: '#ef4444', type: 'danger' }
})

/* ---------- 仪表 ---------- */
const gauge = (val) => ({
  series: [{
    type: 'gauge', radius: '100%',
    startAngle: 220, endAngle: -40,
    progress: {
      show: true, width: 14,
      itemStyle: { color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: riskLevelMeta.value.color }] } }
    },
    axisLine: { lineStyle: { width: 14, color: [[1, '#eef0f7']] } },
    pointer: { show: false },
    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false },
    detail: { valueAnimation: true, offsetCenter: [0, 0], color: riskLevelMeta.value.color, fontSize: 32, fontWeight: 600, formatter: '{value}' },
    data: [{ value: val }]
  }]
})

/* ---------- 热力图按日期+站点稳定 ---------- */
const heatOption = computed(() => {
  const today = dayjs().format('YYYY-MM-DD')
  const data = []
  stations.forEach((s, y) => {
    const rnd = mulberry32(hashSeed(s.id + ':' + today))
    for (let h = 0; h < 12; h++) {
      // 早晚高峰更易出告警，结合站点风险分
      const peakBoost = (h === 4 || h === 9) ? 1.5 : 1
      const stationFactor = (100 - s.riskScore) / 30
      data.push([h, y, Math.min(5, Math.floor(rnd() * 6 * stationFactor * peakBoost))])
    }
  })
  return {
    tooltip: {
      position: 'top',
      formatter: (p) => `${stations[p.value[1]].name}<br/>${p.value[0]*2}:00 - ${p.value[0]*2+2}:00<br/>告警 ${p.value[2]} 条`
    },
    grid: { left: 110, right: 20, top: 30, bottom: 40 },
    xAxis: { type: 'category', data: ['0','2','4','6','8','10','12','14','16','18','20','22'], axisLabel: { color: '#525c75' } },
    yAxis: { type: 'category', data: stations.map(s => s.name.length > 7 ? s.name.slice(0, 6) + '…' : s.name), axisLabel: { color: '#525c75', fontSize: 11 } },
    visualMap: { min: 0, max: 5, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#f5f7fb', '#06b6d4', '#015eea', '#f59e0b', '#ef4444'] }, textStyle: { fontSize: 11 } },
    series: [{ type: 'heatmap', data }]
  }
})

/* ---------- 雷达：由真实数据计算 ---------- */
const radarOption = computed(() => {
  const avgSoh = stations.reduce((s, x) => s + x.soh, 0) / stations.length
  const avgRisk = stations.reduce((s, x) => s + x.riskScore, 0) / stations.length
  const avgInspect = stations.reduce((s, x) => s + x.inspectionRate, 0) / stations.length
  const avgRect = stations.reduce((s, x) => s + x.rectifyRate, 0) / stations.length
  const severeRate = stats.value.severe / Math.max(stats.value.total, 1)
  const alarmHealth = 100 - severeRate * 40 - (stats.value.active / stats.value.total) * 20
  return {
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
      axisName: { color: '#1a1f36', fontSize: 12 }
    },
    series: [{
      type: 'radar', name: '全网均值',
      data: [{
        value: [
          Math.round(avgSoh),
          Math.round(alarmHealth),
          Math.round(avgInspect),
          Math.round(avgRisk),
          95,
          Math.round(avgRect)
        ],
        name: '全网均值',
        lineStyle: { color: '#06b6d4', width: 2 },
        areaStyle: { color: 'rgba(6,182,212,0.3)' },
        itemStyle: { color: '#015eea' }
      }]
    }]
  }
})

/* ---------- 风险演进 7 日趋势 ---------- */
const evolutionOption = computed(() => {
  const rnd = mulberry32(hashSeed('risk-evolution-' + dayjs().format('YYYY-MM-DD')))
  const days = Array.from({ length: 7 }, (_, i) => dayjs().subtract(6 - i, 'day').format('M/D'))
  const idx = Array.from({ length: 7 }, (_, i) => {
    const base = stats.value.riskIndex - (6 - i) * (rnd() - 0.4) * 1.5
    return Math.max(40, Math.min(100, Math.round(base + (rnd() - 0.5) * 4)))
  })
  const activeCnt = Array.from({ length: 7 }, () => Math.floor(rnd() * 12 + 3))
  return {
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { fontSize: 12 } },
    grid: { left: 40, right: 50, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: days, axisLabel: { color: '#525c75', fontSize: 11 } },
    yAxis: [
      { type: 'value', name: '风险指数', min: 40, max: 100, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { fontSize: 11 } },
      { type: 'value', name: '告警数', position: 'right', splitLine: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { fontSize: 11 } }
    ],
    series: [
      {
        name: '风险指数', type: 'line', smooth: true, data: idx,
        lineStyle: { color: '#015eea', width: 3 }, itemStyle: { color: '#015eea' },
        symbol: 'circle', symbolSize: 6,
        markLine: { symbol: 'none', silent: true, data: [
          { yAxis: 85, label: { formatter: '低风险', color: '#22d3a0' }, lineStyle: { color: '#22d3a0', type: 'dashed' } },
          { yAxis: 70, label: { formatter: '中等', color: '#f59e0b' }, lineStyle: { color: '#f59e0b', type: 'dashed' } }
        ]}
      },
      {
        name: '活跃告警', type: 'bar', yAxisIndex: 1, data: activeCnt, barWidth: 20,
        itemStyle: { color: 'rgba(245,158,11,0.5)', borderRadius: [4, 4, 0, 0] }
      }
    ]
  }
})

/* ---------- 列表过滤 ---------- */
const search = ref('')
const filterLevel = ref('')
const filterStation = ref('')
const filterStatus = ref('')

const filteredAlarms = computed(() => {
  return alarms.map(a => ({ ...a, status: effectiveStatus(a) })).filter(a => {
    if (search.value) {
      const s = (a.id + a.stationName + a.location + a.type).toLowerCase()
      if (!s.includes(search.value.toLowerCase())) return false
    }
    if (filterLevel.value && a.level !== filterLevel.value) return false
    if (filterStation.value && a.stationId !== filterStation.value) return false
    if (filterStatus.value && a.status !== filterStatus.value) return false
    return true
  })
})
const hasFilter = computed(() => !!(search.value || filterLevel.value || filterStation.value || filterStatus.value))
function clearFilters() { search.value = ''; filterLevel.value = ''; filterStation.value = ''; filterStatus.value = '' }

/* ---------- 告警详情抽屉 ---------- */
const detailDrawer = ref(false)
const detail = ref(null)
function openDetail(row) { detail.value = row; detailDrawer.value = true }

const relatedIncident = computed(() => {
  if (!detail.value) return null
  return incidents.find(i => i.stationName === detail.value.stationName)
})
const relatedEvidence = computed(() => {
  if (!detail.value) return []
  return evidences.filter(e => e.stationName === detail.value.stationName).slice(0, 2)
})

/* ---------- 处置 dialog ---------- */
const disposalDialog = ref(false)
const disposalForm = reactive({ status: '已恢复', handler: '运维员A', note: '' })
function openDisposal(row) {
  detail.value = row
  const exist = store.getDisposal(row.id)
  disposalForm.status = exist?.status || '已恢复'
  disposalForm.handler = exist?.handler || '运维员A'
  disposalForm.note = exist?.note || ''
  disposalDialog.value = true
}
function submitDisposal() {
  store.setDisposal(detail.value.id, {
    status: disposalForm.status,
    handler: disposalForm.handler,
    note: disposalForm.note,
    handledAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
  })
  disposalDialog.value = false
  ElMessage.success(`告警 ${detail.value.id} 已${disposalForm.status === '已恢复' ? '处置完成' : '更新处置状态'}`)
}

/* ---------- 顶部刷新 ---------- */
const refreshing = ref(false)
async function refresh() {
  refreshing.value = true
  await new Promise(r => setTimeout(r, 700))
  refreshing.value = false
  ElMessage.success(`风险数据已刷新 · ${dayjs().format('HH:mm:ss')}`)
}

function exportReport() {
  const r = {
    reportId: 'RR-' + dayjs().format('YYYYMMDD-HHmm'),
    generatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    overallRiskIndex: stats.value.riskIndex,
    riskLevel: riskLevelMeta.value.label,
    stats: stats.value,
    alarms: filteredAlarms.value.map(a => ({
      id: a.id, time: a.time, station: a.stationName, location: a.location,
      type: a.type, level: a.level, status: a.status, duration: a.duration,
      disposal: store.getDisposal(a.id) || null
    }))
  }
  const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `风险监测报告-${dayjs().format('YYYYMMDD-HHmm')}.json`; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success('风险监测报告已导出')
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
        <el-button :icon="Document" @click="exportReport">导出风险报告</el-button>
        <el-button type="primary" :icon="Refresh" :loading="refreshing" @click="refresh">刷新</el-button>
      </template>
    </PageHeader>

    <div class="top">
      <div class="overview card">
        <div class="ov-head">
          <div class="ov-title">实时风险指数</div>
          <el-tag :type="riskLevelMeta.type" effect="dark" size="small">{{ riskLevelMeta.label }}</el-tag>
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
        title="承保站点 × 时段告警热力图"
        desc="近 24 小时按站点分布 · 数据按日期种子稳定"
        :option="heatOption"
        height="340px"
      />

      <ChartCard
        title="全网六维风控雷达"
        desc="基于全网 SOH/告警比/巡检合格率综合"
        :option="radarOption"
        height="340px"
      />
    </div>

    <!-- 风险演进趋势 -->
    <div class="evolution">
      <ChartCard
        title="7 日风险演进趋势"
        desc="风险指数与活跃告警数同步对比 · 含低/中风险阈值线"
        :option="evolutionOption"
        height="240px"
      />
    </div>

    <div class="alert-section">
      <div class="as-head">
        <div class="title">实时告警明细 ({{ filteredAlarms.length }})</div>
        <div class="filters">
          <el-input v-model="search" placeholder="搜索 ID/站点/位置/类型" clearable :prefix-icon="Search" size="default" style="width:240px" />
          <el-select v-model="filterStation" placeholder="全部站点" clearable size="default" style="width:160px">
            <el-option v-for="s in stations" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-radio-group v-model="filterLevel" size="small">
            <el-radio-button value="">全部</el-radio-button>
            <el-radio-button value="严重">严重</el-radio-button>
            <el-radio-button value="重要">重要</el-radio-button>
            <el-radio-button value="一般">一般</el-radio-button>
            <el-radio-button value="提示">提示</el-radio-button>
          </el-radio-group>
          <el-select v-model="filterStatus" placeholder="状态" clearable size="default" style="width:110px">
            <el-option label="未恢复" value="未恢复" />
            <el-option label="处置中" value="处置中" />
            <el-option label="已恢复" value="已恢复" />
          </el-select>
          <el-button v-if="hasFilter" text type="primary" @click="clearFilters">清空</el-button>
        </div>
      </div>
      <el-table :data="filteredAlarms" stripe size="default" max-height="480">
        <el-table-column prop="id" label="告警编号" width="110" />
        <el-table-column label="等级" width="90">
          <template #default="{ row }">
            <el-tag size="small"
              :type="row.level === '严重' ? 'danger' : row.level === '重要' ? 'warning' : row.level === '提示' ? 'info' : 'primary'">
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
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text type="primary" @click="openDisposal(row)">处置</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="tb-empty">
            <div>无匹配告警</div>
            <el-button v-if="hasFilter" text type="primary" @click="clearFilters">清空筛选</el-button>
          </div>
        </template>
      </el-table>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailDrawer" title="告警详情" size="540" direction="rtl">
      <template v-if="detail">
        <div class="dd-section">
          <div class="dd-row">
            <div>
              <div class="dd-l">告警编号</div>
              <div class="dd-v mono">{{ detail.id }}</div>
            </div>
            <el-tag :type="detail.status === '已恢复' ? 'success' : detail.status === '处置中' ? 'warning' : 'danger'">
              {{ detail.status }}
            </el-tag>
          </div>
        </div>
        <div class="dd-grid">
          <div><div class="dd-l">等级</div><el-tag size="small"
            :type="detail.level === '严重' ? 'danger' : detail.level === '重要' ? 'warning' : 'primary'">
            {{ detail.level }}
          </el-tag></div>
          <div><div class="dd-l">发生时间</div><div class="dd-v">{{ detail.time }}</div></div>
          <div><div class="dd-l">站点</div><div class="dd-v">{{ detail.stationName }}</div></div>
          <div><div class="dd-l">位置</div><div class="dd-v">{{ detail.location }}</div></div>
          <div><div class="dd-l">告警类型</div><div class="dd-v">{{ detail.type }}</div></div>
          <div><div class="dd-l">持续时长</div><div class="dd-v">{{ detail.duration }}</div></div>
        </div>

        <div class="dd-section" v-if="store.getDisposal(detail.id)">
          <div class="dd-l">处置记录</div>
          <div class="dd-disposal">
            <el-tag size="small" type="success" effect="dark">{{ store.getDisposal(detail.id).status }}</el-tag>
            <span>{{ store.getDisposal(detail.id).handler }}</span>
            <span class="dd-time">{{ store.getDisposal(detail.id).handledAt }}</span>
            <div class="dd-note" v-if="store.getDisposal(detail.id).note">{{ store.getDisposal(detail.id).note }}</div>
          </div>
        </div>

        <div class="dd-section" v-if="relatedIncident">
          <div class="dd-l">关联事故</div>
          <div class="dd-related">
            <code class="dd-ref">{{ relatedIncident.id }}</code>
            {{ relatedIncident.type }}
            <el-tag size="small" effect="plain">{{ relatedIncident.severity }}级</el-tag>
            <div class="dd-meta">{{ relatedIncident.time }} · {{ relatedIncident.location }}</div>
          </div>
        </div>

        <div class="dd-section" v-if="relatedEvidence.length">
          <div class="dd-l">关联证据</div>
          <div v-for="e in relatedEvidence" :key="e.id" class="dd-related">
            <code class="dd-ref">{{ e.id }}</code>
            <el-tag size="small" effect="plain">{{ e.type }}</el-tag>
            <div class="dd-meta">
              <code class="mono" style="color:#015eea">{{ e.hash.slice(0, 22) }}…</code>
              · 区块 #{{ e.chainHeight.toLocaleString() }}
            </div>
          </div>
        </div>

        <div class="dd-actions">
          <el-button type="primary" :icon="Tools" @click="openDisposal(detail); detailDrawer = false">处置</el-button>
          <el-button @click="detailDrawer = false">关闭</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 处置 dialog -->
    <el-dialog v-model="disposalDialog" :title="`处置告警 ${detail?.id || ''}`" width="480">
      <el-form label-width="80px" label-position="left" v-if="detail">
        <el-form-item label="告警">
          <div class="df-summary">
            <el-tag size="small"
              :type="detail.level === '严重' ? 'danger' : detail.level === '重要' ? 'warning' : 'primary'">
              {{ detail.level }}
            </el-tag>
            {{ detail.type }} · {{ detail.location }}
          </div>
        </el-form-item>
        <el-form-item label="处置状态">
          <el-radio-group v-model="disposalForm.status">
            <el-radio value="已恢复">已恢复</el-radio>
            <el-radio value="处置中">处置中</el-radio>
            <el-radio value="未恢复">未恢复</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处置人">
          <el-select v-model="disposalForm.handler" style="width:100%">
            <el-option label="运维员A" value="运维员A" />
            <el-option label="运维员B" value="运维员B" />
            <el-option label="风控员C" value="风控员C" />
            <el-option label="自动恢复" value="自动恢复" />
          </el-select>
        </el-form-item>
        <el-form-item label="处置说明">
          <el-input v-model="disposalForm.note" type="textarea" :rows="3" placeholder="例：现场排查后调整阈值，已恢复正常" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="disposalDialog = false">取消</el-button>
        <el-button type="primary" :icon="Check" @click="submitDisposal">提交处置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.top { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 16px; margin-bottom: 20px; }
.card { background: $bg-card; border: 1px solid $border-soft; border-radius: $radius; padding: 18px 20px; box-shadow: $shadow-card; }
.ov-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.ov-title { font-size: 14px; font-weight: 600; }
.ov-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 8px; padding-top: 12px; border-top: 1px solid $border-soft; text-align: center; }
.og-l { font-size: 11px; color: $text-muted; }
.og-v { font-size: 20px; font-weight: 600; margin-top: 4px; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; }

.evolution { margin-bottom: 20px; }

.alert-section {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px; box-shadow: $shadow-card;
}
.as-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
.title { font-size: 15px; font-weight: 600; }
.filters { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.tb-empty { padding: 32px; text-align: center; color: $text-muted; display: flex; flex-direction: column; gap: 8px; align-items: center; }

/* === Drawer === */
.dd-section { margin-bottom: 18px; }
.dd-row { display: flex; justify-content: space-between; align-items: center; }
.dd-l { font-size: 12px; color: $text-muted; margin-bottom: 4px; }
.dd-v { font-size: 14px; }
.mono { font-family: monospace; }
.dd-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; padding: 14px 0; margin-bottom: 4px; border-top: 1px solid $border-soft; border-bottom: 1px solid $border-soft; }
.dd-disposal {
  background: rgba(34,211,160,0.06); padding: 10px 14px; border-radius: 8px;
  display: flex; align-items: center; gap: 8px; font-size: 13px; flex-wrap: wrap;
  .dd-time { color: $text-muted; font-size: 12px; margin-left: auto; font-family: $font-num; }
  .dd-note { width: 100%; font-size: 12px; color: $text-secondary; margin-top: 4px; }
}
.dd-related {
  background: $bg-soft; padding: 10px 14px; border-radius: 8px;
  margin-bottom: 6px; font-size: 13px;
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  .dd-ref { color: $brand-blue; font-family: $font-num; }
  .dd-meta { width: 100%; font-size: 11px; color: $text-muted; margin-top: 4px; }
}
.dd-actions { display: flex; gap: 10px; margin-top: 16px; }

.df-summary { font-size: 13px; color: $text-secondary;
  display: flex; align-items: center; gap: 8px;
}

@media (max-width: 1300px) {
  .top { grid-template-columns: 1fr 1fr; }
  .filters { width: 100%; }
}
</style>
