<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import PageHeader from '@/components/PageHeader.vue'
import { stations } from '@/mock/data'
import {
  Lightning, TrendCharts, Refresh, Setting, Aim,
  CircleCheckFilled, Warning, Switch
} from '@element-plus/icons-vue'

const stationId = ref(stations[0].id)
const pcsId = ref('PCS-01')
const pcsList = Array.from({ length: 4 }, (_, i) => `PCS-${String(i + 1).padStart(2, '0')}`)

/* ---------- PCS 状态 ---------- */
const STATES = [
  { key: 'standby',  label: '待机',   color: '#8a93a8' },
  { key: 'charge',   label: '充电中', color: '#22d3a0' },
  { key: 'discharge',label: '放电中', color: '#015eea' },
  { key: 'fault',    label: '故障',   color: '#ef4444' }
]
const state = ref('discharge')
const curState = computed(() => STATES.find(s => s.key === state.value))

/* ---------- 实时电参数 ---------- */
const pcs = reactive({
  // 直流侧
  dcVoltage: 768.4,
  dcCurrent: -82.6,
  dcPower: -63.5,    // kW (负=放电)

  // 交流侧
  acVoltageA: 230.4, acVoltageB: 230.1, acVoltageC: 230.7,
  acCurrentA: 91.2,  acCurrentB: 92.8,  acCurrentC: 90.6,
  freq: 50.012,
  pf: 0.998,         // 功率因数

  P: -62.8,  // 有功 kW
  Q: 3.2,    // 无功 kVar
  S: 62.88,  // 视在 kVA
  efficiency: 97.8,  // 转换效率 %

  // 温度
  igbtTempA: 58.2, igbtTempB: 56.8, igbtTempC: 59.4,
  cabinetTemp: 38.6,
  busTemp: 42.3,

  // 谐波
  thdU: 1.42,  // 电压总谐波畸变率
  thdI: 2.18,  // 电流
})

/* ---------- 24h 充放电 + 效率 ---------- */
function gen24h() {
  const points = 96 // 15min
  const labels = Array.from({ length: points }, (_, i) => {
    const h = Math.floor(i / 4)
    const m = (i % 4) * 15
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
  })
  const power = labels.map((_, i) => {
    const t = i / 4
    // 早充午放晚充
    if (t < 6) return +(40 + Math.sin(t) * 8 + (Math.random() - 0.5) * 4).toFixed(1)
    if (t < 10) return +(-50 + Math.sin(t) * 10 + (Math.random() - 0.5) * 5).toFixed(1)
    if (t < 14) return +(20 + Math.cos(t) * 12 + (Math.random() - 0.5) * 4).toFixed(1)
    if (t < 22) return +(-60 + Math.sin(t / 2) * 8 + (Math.random() - 0.5) * 6).toFixed(1)
    return +(30 + (Math.random() - 0.5) * 6).toFixed(1)
  })
  const efficiency = labels.map(() => +(96.5 + Math.random() * 2.5).toFixed(1))
  return { labels, power, efficiency }
}
const day = gen24h()

/* ---------- ECharts 实例 ---------- */
const waveEl = ref(null)
const harmonicEl = ref(null)
const dayEl = ref(null)
const tempEl = ref(null)
let waveChart, harmonicChart, dayChart, tempChart

/* ---------- AC 三相波形（实时模拟）---------- */
const wavePhase = ref(0)  // 相位偏移
function buildWave() {
  // 1 个周期 = 20ms (50Hz)，取 2 个周期 = 100 点
  const N = 100
  const labels = Array.from({ length: N }, (_, i) => (i * 0.4).toFixed(1))  // ms
  const peak = 325  // V 峰值（230 * sqrt(2)）
  const peakI = 130
  return {
    labels,
    A: labels.map((_, i) => +(peak * Math.sin(2 * Math.PI * 2 * i / N + wavePhase.value)).toFixed(1)),
    B: labels.map((_, i) => +(peak * Math.sin(2 * Math.PI * 2 * i / N + wavePhase.value - 2 * Math.PI / 3)).toFixed(1)),
    C: labels.map((_, i) => +(peak * Math.sin(2 * Math.PI * 2 * i / N + wavePhase.value + 2 * Math.PI / 3)).toFixed(1)),
    IA: labels.map((_, i) => +(peakI * Math.sin(2 * Math.PI * 2 * i / N + wavePhase.value - 0.05)).toFixed(1)),
    IB: labels.map((_, i) => +(peakI * Math.sin(2 * Math.PI * 2 * i / N + wavePhase.value - 0.05 - 2 * Math.PI / 3)).toFixed(1)),
    IC: labels.map((_, i) => +(peakI * Math.sin(2 * Math.PI * 2 * i / N + wavePhase.value - 0.05 + 2 * Math.PI / 3)).toFixed(1))
  }
}

function renderWave() {
  if (!waveChart) return
  const w = buildWave()
  waveChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 60, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: w.labels, axisLabel: { color: '#525c75', fontSize: 11, formatter: '{value}ms', interval: 9 }, axisLine: { lineStyle: { color: '#dadfeb' } } },
    yAxis: [
      { type: 'value', name: '电压 V', min: -380, max: 380, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { color: '#8a93a8' } },
      { type: 'value', name: '电流 A', min: -160, max: 160, position: 'right', splitLine: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { color: '#8a93a8' } }
    ],
    series: [
      { name: 'Ua', type: 'line', smooth: true, showSymbol: false, data: w.A, lineStyle: { color: '#ef4444', width: 2 } },
      { name: 'Ub', type: 'line', smooth: true, showSymbol: false, data: w.B, lineStyle: { color: '#22d3a0', width: 2 } },
      { name: 'Uc', type: 'line', smooth: true, showSymbol: false, data: w.C, lineStyle: { color: '#015eea', width: 2 } },
      { name: 'Ia', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: w.IA, lineStyle: { color: '#ef4444', width: 1.5, type: 'dashed' } },
      { name: 'Ib', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: w.IB, lineStyle: { color: '#22d3a0', width: 1.5, type: 'dashed' } },
      { name: 'Ic', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1, data: w.IC, lineStyle: { color: '#015eea', width: 1.5, type: 'dashed' } }
    ]
  })
}

/* ---------- 谐波频谱 ---------- */
function renderHarmonic() {
  if (!harmonicChart) return
  const orders = Array.from({ length: 25 }, (_, i) => i + 1)
  const uH = orders.map((n) => {
    if (n === 1) return 100
    if (n === 3) return 0.7
    if (n === 5) return 0.9 + Math.random() * 0.2
    if (n === 7) return 0.6 + Math.random() * 0.2
    if (n === 11) return 0.3 + Math.random() * 0.1
    if (n === 13) return 0.25 + Math.random() * 0.1
    return Math.random() * 0.2
  })
  const iH = orders.map((n) => {
    if (n === 1) return 100
    if (n === 5) return 1.5 + Math.random() * 0.3
    if (n === 7) return 1.0 + Math.random() * 0.2
    if (n === 11) return 0.5 + Math.random() * 0.2
    if (n === 13) return 0.4 + Math.random() * 0.1
    return Math.random() * 0.3
  })
  harmonicChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, right: 0, textStyle: { fontSize: 11 } },
    grid: { left: 44, right: 14, top: 34, bottom: 30 },
    xAxis: { type: 'category', data: orders.map(n => n + ' 次'), axisLabel: { color: '#525c75', fontSize: 10, interval: 1 } },
    yAxis: { type: 'log', name: '% (相对基波)', nameTextStyle: { color: '#8a93a8', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 10 }, min: 0.01 },
    series: [
      { name: '电压谐波', type: 'bar', data: uH, itemStyle: { color: '#015eea' }, barGap: '10%' },
      { name: '电流谐波', type: 'bar', data: iH, itemStyle: { color: '#06b6d4' } }
    ]
  })
}

/* ---------- 24h 功率/效率 ---------- */
function renderDay() {
  if (!dayChart) return
  dayChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { fontSize: 11 } },
    grid: { left: 50, right: 60, top: 34, bottom: 30 },
    xAxis: { type: 'category', data: day.labels, axisLabel: { color: '#525c75', fontSize: 11, interval: 7 }, axisLine: { lineStyle: { color: '#dadfeb' } } },
    yAxis: [
      { type: 'value', name: '功率 kW (+充/-放)', splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { color: '#8a93a8', fontSize: 11 } },
      { type: 'value', name: '效率 %', position: 'right', min: 92, max: 100, splitLine: { show: false }, axisLabel: { color: '#525c75', fontSize: 11 }, nameTextStyle: { color: '#8a93a8', fontSize: 11 } }
    ],
    series: [
      {
        name: '功率', type: 'bar', data: day.power, barWidth: '60%',
        itemStyle: { color: (p) => p.value > 0 ? '#22d3a0' : '#015eea' }
      },
      {
        name: '转换效率', type: 'line', smooth: true, showSymbol: false, yAxisIndex: 1,
        data: day.efficiency, lineStyle: { color: '#f59e0b', width: 2 }, itemStyle: { color: '#f59e0b' }
      }
    ]
  })
}

/* ---------- IGBT 温度对比 ---------- */
function renderTemp() {
  if (!tempChart) return
  tempChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 40, right: 14, top: 22, bottom: 30 },
    xAxis: { type: 'category', data: ['IGBT-A', 'IGBT-B', 'IGBT-C', '直流母线', '柜内'], axisLabel: { color: '#525c75', fontSize: 11 } },
    yAxis: { type: 'value', name: '℃', min: 0, max: 100, splitLine: { lineStyle: { color: '#eef0f7' } }, axisLabel: { color: '#525c75', fontSize: 10 } },
    series: [{
      type: 'bar', barWidth: '50%',
      data: [pcs.igbtTempA, pcs.igbtTempB, pcs.igbtTempC, pcs.busTemp, pcs.cabinetTemp],
      itemStyle: { color: (p) => p.value > 70 ? '#ef4444' : p.value > 55 ? '#f59e0b' : '#22d3a0', borderRadius: [4, 4, 0, 0] },
      markLine: { symbol: 'none', data: [{ yAxis: 70, label: { formatter: '告警 70℃', color: '#ef4444', fontSize: 10 }, lineStyle: { color: '#ef4444', type: 'dashed' } }] }
    }]
  })
}

/* ---------- 数据流模拟 ---------- */
let timer = null
function tick() {
  wavePhase.value += 0.4   // 波形右移
  // 微抖
  pcs.acVoltageA = +(230 + Math.random()).toFixed(1)
  pcs.acVoltageB = +(230 + Math.random()).toFixed(1)
  pcs.acVoltageC = +(230 + Math.random()).toFixed(1)
  pcs.acCurrentA = +(90 + (Math.random() - 0.5) * 3).toFixed(1)
  pcs.acCurrentB = +(90 + (Math.random() - 0.5) * 3).toFixed(1)
  pcs.acCurrentC = +(90 + (Math.random() - 0.5) * 3).toFixed(1)
  pcs.freq = +(50 + (Math.random() - 0.5) * 0.05).toFixed(3)
  pcs.pf = +(0.99 + (Math.random() - 0.5) * 0.02).toFixed(3)
  pcs.P = +(-62 + (Math.random() - 0.5) * 2).toFixed(1)
  pcs.Q = +(3 + (Math.random() - 0.5) * 0.5).toFixed(2)
  pcs.S = +(Math.sqrt(pcs.P * pcs.P + pcs.Q * pcs.Q)).toFixed(2)
  pcs.efficiency = +(97.5 + Math.random() * 0.8).toFixed(2)
  pcs.dcCurrent = +(pcs.P * 1000 / pcs.dcVoltage).toFixed(1)
  pcs.dcPower = +(pcs.dcVoltage * pcs.dcCurrent / 1000).toFixed(1)
  pcs.igbtTempA = +(58 + (Math.random() - 0.5) * 1.5).toFixed(1)
  pcs.igbtTempB = +(57 + (Math.random() - 0.5) * 1.5).toFixed(1)
  pcs.igbtTempC = +(59 + (Math.random() - 0.5) * 1.5).toFixed(1)
  pcs.thdU = +(1.4 + (Math.random() - 0.5) * 0.15).toFixed(2)
  pcs.thdI = +(2.2 + (Math.random() - 0.5) * 0.3).toFixed(2)
  renderWave()
  renderTemp()
  if (Math.random() < 0.3) renderHarmonic()
}

function onResize() { waveChart?.resize(); harmonicChart?.resize(); dayChart?.resize(); tempChart?.resize() }

onMounted(() => {
  waveChart = echarts.init(waveEl.value)
  harmonicChart = echarts.init(harmonicEl.value)
  dayChart = echarts.init(dayEl.value)
  tempChart = echarts.init(tempEl.value)
  renderWave(); renderHarmonic(); renderDay(); renderTemp()
  timer = setInterval(tick, 500)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('resize', onResize)
  waveChart?.dispose(); harmonicChart?.dispose(); dayChart?.dispose(); tempChart?.dispose()
})

const dayStats = computed(() => {
  const chargeKWh = day.power.filter(p => p > 0).reduce((a, b) => a + b * 0.25, 0)
  const dischargeKWh = day.power.filter(p => p < 0).reduce((a, b) => a + Math.abs(b) * 0.25, 0)
  const avgEff = day.efficiency.reduce((a, b) => a + b, 0) / day.efficiency.length
  return {
    charge: chargeKWh.toFixed(1),
    discharge: dischargeKWh.toFixed(1),
    cycle: Math.min(chargeKWh, dischargeKWh).toFixed(1),
    eff: avgEff.toFixed(2)
  }
})
</script>

<template>
  <div class="pcs">
    <PageHeader
      tag="PCS"
      title="PCS 变流器实时监控"
      desc="三相交直流波形 · 功率与谐波 · IGBT 温升 · 24h 充放电曲线"
    >
      <template #actions>
        <el-button :icon="Setting">PCS 配置</el-button>
        <el-button type="primary" :icon="TrendCharts">导出能量报告</el-button>
      </template>
    </PageHeader>

    <!-- 顶部选择 -->
    <div class="bar">
      <el-select v-model="stationId" placeholder="站点" style="width:240px">
        <el-option v-for="s in stations" :key="s.id" :label="s.name" :value="s.id" />
      </el-select>
      <el-select v-model="pcsId" style="width:140px">
        <el-option v-for="p in pcsList" :key="p" :label="p" :value="p" />
      </el-select>
      <el-divider direction="vertical" />
      <div class="state" :style="{ borderColor: curState.color, color: curState.color }">
        <span class="st-dot" :style="{ background: curState.color }" />
        <span class="st-label">{{ curState.label }}</span>
      </div>
      <el-radio-group v-model="state" size="default">
        <el-radio-button v-for="s in STATES" :key="s.key" :label="s.key">{{ s.label }}</el-radio-button>
      </el-radio-group>
      <div class="bar-right">
        <el-icon class="pulse"><Lightning /></el-icon>
        额定容量 250 kW · 当前 {{ Math.abs(pcs.P).toFixed(1) }} kW
      </div>
    </div>

    <!-- 行 1: 直流侧 + 交流侧 + 关键 -->
    <div class="kpi-grid">
      <div class="kpi-block dc">
        <div class="kb-title">直流侧 DC</div>
        <div class="kb-grid">
          <div class="kb"><div class="kb-l">母线电压</div><div class="kb-v">{{ pcs.dcVoltage }}<span>V</span></div></div>
          <div class="kb"><div class="kb-l">直流电流</div><div class="kb-v" :class="{neg: pcs.dcCurrent < 0}">{{ pcs.dcCurrent.toFixed(1) }}<span>A</span></div></div>
          <div class="kb"><div class="kb-l">直流功率</div><div class="kb-v" :class="{neg: pcs.dcPower < 0}">{{ pcs.dcPower.toFixed(1) }}<span>kW</span></div></div>
        </div>
      </div>

      <div class="kpi-block ac">
        <div class="kb-title">交流侧 AC</div>
        <div class="kb-grid kb-grid-4">
          <div class="kb"><div class="kb-l">Ua / Ub / Uc</div><div class="kb-v sm">{{ pcs.acVoltageA }} <s>/</s> {{ pcs.acVoltageB }} <s>/</s> {{ pcs.acVoltageC }}<span>V</span></div></div>
          <div class="kb"><div class="kb-l">Ia / Ib / Ic</div><div class="kb-v sm">{{ pcs.acCurrentA }} <s>/</s> {{ pcs.acCurrentB }} <s>/</s> {{ pcs.acCurrentC }}<span>A</span></div></div>
          <div class="kb"><div class="kb-l">频率</div><div class="kb-v">{{ pcs.freq.toFixed(3) }}<span>Hz</span></div></div>
          <div class="kb"><div class="kb-l">功率因数</div><div class="kb-v">{{ pcs.pf.toFixed(3) }}</div></div>
        </div>
      </div>

      <div class="kpi-block pwr">
        <div class="kb-title">功率 / 效率</div>
        <div class="kb-grid kb-grid-4">
          <div class="kb"><div class="kb-l">有功 P</div><div class="kb-v" :class="{neg: pcs.P < 0}">{{ pcs.P.toFixed(1) }}<span>kW</span></div></div>
          <div class="kb"><div class="kb-l">无功 Q</div><div class="kb-v">{{ pcs.Q.toFixed(2) }}<span>kVar</span></div></div>
          <div class="kb"><div class="kb-l">视在 S</div><div class="kb-v">{{ pcs.S.toFixed(2) }}<span>kVA</span></div></div>
          <div class="kb"><div class="kb-l">转换效率</div><div class="kb-v ok">{{ pcs.efficiency.toFixed(2) }}<span>%</span></div></div>
        </div>
      </div>
    </div>

    <!-- 行 2: AC 波形(2/3) + 谐波(1/3) -->
    <div class="row">
      <div class="card col-2">
        <div class="card-head">
          <div class="ch-title">三相交流瞬时波形 (50 Hz · 2 周期)</div>
          <div class="ch-sub">采样 1 ms · 实数据流</div>
        </div>
        <div class="chart" ref="waveEl" />
      </div>
      <div class="card">
        <div class="card-head">
          <div class="ch-title">谐波频谱 (1-25 次)</div>
          <div class="ch-sub">
            THDu <b style="color:#015eea">{{ pcs.thdU }}%</b> · THDi <b style="color:#06b6d4">{{ pcs.thdI }}%</b>
          </div>
        </div>
        <div class="chart" ref="harmonicEl" />
      </div>
    </div>

    <!-- 行 3: 24h 功率(2/3) + IGBT 温度(1/3) -->
    <div class="row">
      <div class="card col-2">
        <div class="card-head">
          <div class="ch-title">24 小时充放电功率 + 转换效率</div>
          <div class="ch-stats">
            <span>累计充电 <b style="color:#22d3a0">{{ dayStats.charge }} kWh</b></span>
            <span>累计放电 <b style="color:#015eea">{{ dayStats.discharge }} kWh</b></span>
            <span>循环量 <b>{{ dayStats.cycle }} kWh</b></span>
            <span>平均效率 <b style="color:#f59e0b">{{ dayStats.eff }}%</b></span>
          </div>
        </div>
        <div class="chart" ref="dayEl" />
      </div>
      <div class="card">
        <div class="card-head">
          <div class="ch-title">IGBT / 母线 / 柜内温度</div>
          <div class="ch-sub">告警阈值 70 ℃</div>
        </div>
        <div class="chart h300" ref="tempEl" />
      </div>
    </div>

    <!-- 状态机 -->
    <div class="card">
      <div class="card-head">
        <div class="ch-title"><el-icon><Switch /></el-icon> PCS 控制状态机</div>
      </div>
      <div class="states">
        <div
          v-for="(s, i) in STATES" :key="s.key"
          class="st"
          :class="{ active: state === s.key }"
          :style="{ '--c': s.color }"
          @click="state = s.key"
        >
          <div class="st-icon">
            <el-icon v-if="s.key === 'standby'"><Aim /></el-icon>
            <el-icon v-else-if="s.key === 'charge'"><CircleCheckFilled /></el-icon>
            <el-icon v-else-if="s.key === 'discharge'"><Lightning /></el-icon>
            <el-icon v-else><Warning /></el-icon>
          </div>
          <div class="st-name">{{ s.label }}</div>
          <div class="st-info">
            {{ s.key === 'standby' ? '空载，CT 投入' :
               s.key === 'charge' ? '功率 > 0 注入' :
               s.key === 'discharge' ? '功率 < 0 输出' :
               '锁定输出，故障复位' }}
          </div>
          <div class="st-arrow" v-if="i < STATES.length - 1">→</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.pcs { padding-bottom: 24px; }

.bar {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 12px 16px; margin-bottom: 16px; box-shadow: $shadow-card;
  display: flex; gap: 12px; align-items: center; flex-wrap: wrap;
}
.state {
  padding: 6px 12px; border: 1.5px solid; border-radius: 16px;
  display: inline-flex; align-items: center; gap: 8px;
  font-weight: 600; font-size: 13px;
}
.st-dot {
  width: 8px; height: 8px; border-radius: 50%;
  box-shadow: 0 0 0 4px currentColor;
  animation: stPulse 1.6s infinite;
  opacity: 0.4;
}
@keyframes stPulse {
  50% { box-shadow: 0 0 0 6px transparent; opacity: 1; }
}
.bar-right { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: $text-secondary; }
.pulse { color: $brand-blue; animation: pulse2 1.4s infinite; }
@keyframes pulse2 { 50% { transform: scale(1.2); opacity: 0.5; } }

/* === KPI === */
.kpi-grid { display: grid; grid-template-columns: 1fr 2fr 2fr; gap: 14px; margin-bottom: 16px; }
.kpi-block {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 16px 18px; box-shadow: $shadow-card;
  position: relative; overflow: hidden;
  &::before { content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 3px; background: $grad-cyan; }
  &.dc::before { background: linear-gradient(180deg, #6366f1, #015eea); }
  &.ac::before { background: linear-gradient(180deg, #ef4444, #f59e0b); }
  &.pwr::before { background: linear-gradient(180deg, #22d3a0, #06b6d4); }
}
.kb-title { font-size: 12px; color: $text-muted; letter-spacing: 2px; margin-bottom: 12px; }
.kb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.kb-grid-4 { grid-template-columns: repeat(4, 1fr); }
.kb-l { font-size: 11px; color: $text-muted; }
.kb-v {
  font-family: $font-num; font-variant-numeric: tabular-nums;
  font-size: 20px; font-weight: 600; margin-top: 3px;
  letter-spacing: -0.3px;
  &.sm { font-size: 14px; line-height: 1.3; }
  &.sm s { color: $text-muted; text-decoration: none; }
  &.neg { color: #015eea; }
  &.ok { color: #22d3a0; }
  span { font-size: 11px; color: $text-muted; font-weight: 400; margin-left: 3px; }
}

/* === Charts === */
.row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.col-2 { grid-column: span 2; }
.card {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 18px 20px; box-shadow: $shadow-card;
  margin-bottom: 16px;
}
.card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.ch-title { font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.ch-title .el-icon { color: $brand-blue; }
.ch-sub { font-size: 12px; color: $text-muted; }
.ch-stats { display: flex; gap: 18px; font-size: 12px; color: $text-secondary; }
.ch-stats b { font-family: $font-num; font-weight: 600; }
.chart { width: 100%; height: 290px; }
.chart.h300 { height: 300px; }

/* === States === */
.states {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  padding: 8px 0;
}
.st {
  position: relative;
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 22px 16px;
  background: $bg-soft;
  border: 1.5px solid transparent;
  border-radius: $radius;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { background: #fff; border-color: var(--c); }
  &.active {
    background: #fff;
    border-color: var(--c);
    box-shadow: 0 6px 20px rgba(0,0,0,0.06);
    .st-icon { background: var(--c); color: #fff; transform: scale(1.1); }
    .st-name { color: var(--c); }
  }
}
.st-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: rgba(0,0,0,0.04);
  color: var(--c);
  display: flex; align-items: center; justify-content: center;
  font-size: 22px;
  transition: all 0.2s;
}
.st-name { font-size: 15px; font-weight: 600; }
.st-info { font-size: 11px; color: $text-muted; text-align: center; }
.st-arrow {
  position: absolute; right: -10px; top: 50%; transform: translateY(-50%);
  font-size: 18px; color: $text-muted; z-index: 1;
}

@media (max-width: 1400px) {
  .kpi-grid { grid-template-columns: 1fr; }
  .kb-grid-4 { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 1100px) {
  .row { grid-template-columns: 1fr; }
  .col-2 { grid-column: auto; }
  .states { grid-template-columns: repeat(2, 1fr); }
  .st-arrow { display: none; }
}
</style>
