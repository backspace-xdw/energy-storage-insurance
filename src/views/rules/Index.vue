<script setup>
import { ref, reactive, computed } from 'vue'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, Edit, Delete, MagicStick, View, CopyDocument,
  CircleCheckFilled, Setting, Bell, Message
} from '@element-plus/icons-vue'

/* ---------- 字段、运算符、动作 ---------- */
const METRICS = [
  { key: 'pack.cell_voltage_max', label: 'PACK 单体电压最大', unit: 'V', cat: 'BMS' },
  { key: 'pack.cell_voltage_min', label: 'PACK 单体电压最小', unit: 'V', cat: 'BMS' },
  { key: 'pack.voltage_delta', label: 'PACK 单体压差', unit: 'mV', cat: 'BMS' },
  { key: 'pack.temperature_max', label: 'PACK 最高温度', unit: '℃', cat: 'BMS' },
  { key: 'pack.temperature_delta', label: 'PACK 温差', unit: '℃', cat: 'BMS' },
  { key: 'pack.soc', label: 'SOC 荷电量', unit: '%', cat: 'BMS' },
  { key: 'pack.soh', label: 'SOH 健康度', unit: '%', cat: 'BMS' },
  { key: 'cluster.insulation', label: '簇绝缘电阻', unit: 'kΩ', cat: 'BMS' },
  { key: 'cluster.current', label: '簇电流', unit: 'A', cat: 'BMS' },
  { key: 'cabin.smoke', label: '舱内烟雾浓度', unit: 'mg/m³', cat: '环境' },
  { key: 'cabin.h2', label: '舱内 H₂ 浓度', unit: 'ppm', cat: '环境' },
  { key: 'cabin.temperature', label: '舱内温度', unit: '℃', cat: '环境' },
  { key: 'fire.detector_alarm', label: '消防探测器报警', unit: '次', cat: '消防' },
  { key: 'fire.gas_pressure', label: '灭火剂压力', unit: 'MPa', cat: '消防' },
  { key: 'pcs.efficiency', label: 'PCS 转换效率', unit: '%', cat: 'PCS' },
  { key: 'pcs.igbt_temp', label: 'IGBT 温度', unit: '℃', cat: 'PCS' }
]
const OPS = [
  { key: '>',  label: '大于' },
  { key: '>=', label: '大于等于' },
  { key: '<',  label: '小于' },
  { key: '<=', label: '小于等于' },
  { key: '==', label: '等于' },
  { key: 'change', label: '变化超过' },
  { key: 'rate', label: '变化速率' }
]
const LEVELS = [
  { key: 'crit', label: '严重', color: '#ef4444' },
  { key: 'warn', label: '重要', color: '#f59e0b' },
  { key: 'norm', label: '一般', color: '#06b6d4' },
  { key: 'info', label: '提示', color: '#6366f1' }
]
const ACTIONS = [
  { key: 'inApp',   label: '平台站内通知', icon: Bell },
  { key: 'sms',     label: '短信通知',     icon: Message },
  { key: 'email',   label: '邮件',         icon: Message },
  { key: 'webhook', label: 'Webhook',     icon: Setting },
  { key: 'workOrder', label: '生成工单',   icon: CopyDocument },
  { key: 'autoLock', label: '远程拉闸',    icon: Delete }
]

/* ---------- 规则模板 ---------- */
const rules = ref([
  {
    id: 'R-001', name: '热失控早期预警',
    desc: 'PACK 温度急速上升 + 压差超阈值时立即触发',
    enabled: true, hits24h: 3, hits7d: 14, lastHit: '2026-05-17 14:23:18',
    level: 'crit', logic: 'AND', cooldown: 60,
    conditions: [
      { metric: 'pack.temperature_max', op: '>', value: 45, duration: 0 },
      { metric: 'pack.voltage_delta', op: '>', value: 50, duration: 30 }
    ],
    actions: ['inApp', 'sms', 'workOrder', 'autoLock']
  },
  {
    id: 'R-002', name: '绝缘下降',
    desc: '簇级绝缘电阻持续低于安全阈值',
    enabled: true, hits24h: 0, hits7d: 2, lastHit: '2026-05-15 09:11:02',
    level: 'warn', logic: 'AND', cooldown: 300,
    conditions: [
      { metric: 'cluster.insulation', op: '<', value: 500, duration: 60 }
    ],
    actions: ['inApp', 'email', 'workOrder']
  },
  {
    id: 'R-003', name: '舱内烟雾 / 氢气复合预警',
    desc: '烟雾或 H₂ 任一超标即触发',
    enabled: true, hits24h: 0, hits7d: 0, lastHit: '—',
    level: 'crit', logic: 'OR', cooldown: 30,
    conditions: [
      { metric: 'cabin.smoke', op: '>', value: 2.5, duration: 0 },
      { metric: 'cabin.h2', op: '>', value: 200, duration: 0 }
    ],
    actions: ['inApp', 'sms', 'email', 'workOrder', 'autoLock']
  },
  {
    id: 'R-004', name: 'SOH 异常衰减',
    desc: '健康度月度衰减超过 1%',
    enabled: true, hits24h: 0, hits7d: 1, lastHit: '2026-05-10 02:00:00',
    level: 'warn', logic: 'AND', cooldown: 0,
    conditions: [{ metric: 'pack.soh', op: 'change', value: -1, duration: 2592000 }],
    actions: ['inApp', 'email']
  },
  {
    id: 'R-005', name: '消防设施告警',
    desc: '探测器报警或灭火剂压力异常',
    enabled: true, hits24h: 0, hits7d: 0, lastHit: '—',
    level: 'crit', logic: 'OR', cooldown: 60,
    conditions: [
      { metric: 'fire.detector_alarm', op: '>', value: 0, duration: 0 },
      { metric: 'fire.gas_pressure', op: '<', value: 10, duration: 60 }
    ],
    actions: ['inApp', 'sms', 'workOrder']
  },
  {
    id: 'R-006', name: 'IGBT 过温',
    desc: 'PCS IGBT 温度持续偏高',
    enabled: true, hits24h: 1, hits7d: 5, lastHit: '2026-05-17 16:42:08',
    level: 'norm', logic: 'AND', cooldown: 120,
    conditions: [{ metric: 'pcs.igbt_temp', op: '>', value: 75, duration: 30 }],
    actions: ['inApp']
  },
  {
    id: 'R-007', name: 'PCS 效率劣化',
    desc: '转换效率连续低于 95%',
    enabled: false, hits24h: 0, hits7d: 0, lastHit: '—',
    level: 'info', logic: 'AND', cooldown: 600,
    conditions: [{ metric: 'pcs.efficiency', op: '<', value: 95, duration: 300 }],
    actions: ['inApp', 'email']
  },
  {
    id: 'R-008', name: 'SOC 越限',
    desc: 'SOC 越下限或越上限',
    enabled: true, hits24h: 0, hits7d: 8, lastHit: '2026-05-16 04:38:22',
    level: 'norm', logic: 'OR', cooldown: 30,
    conditions: [
      { metric: 'pack.soc', op: '<', value: 5,  duration: 60 },
      { metric: 'pack.soc', op: '>', value: 98, duration: 60 }
    ],
    actions: ['inApp']
  }
])

/* ---------- 当前编辑 ---------- */
const selectedId = ref('R-001')
const selectedRule = computed(() => rules.value.find(r => r.id === selectedId.value))
const search = ref('')
const filterLevel = ref('')
const filterEnabled = ref('')

const filtered = computed(() =>
  rules.value.filter(r =>
    (!search.value || r.name.includes(search.value) || r.id.includes(search.value)) &&
    (!filterLevel.value || r.level === filterLevel.value) &&
    (filterEnabled.value === '' || r.enabled === (filterEnabled.value === 'on'))
  )
)

/* ---------- 增删改 ---------- */
function toggleEnable(r) { r.enabled = !r.enabled; ElMessage.success(`规则 ${r.name} 已${r.enabled?'启用':'停用'}`) }
function dupRule(r) {
  const n = JSON.parse(JSON.stringify(r))
  n.id = 'R-' + String(rules.value.length + 1).padStart(3, '0')
  n.name = r.name + ' (副本)'
  n.hits24h = 0; n.hits7d = 0; n.lastHit = '—'
  rules.value.push(n)
  selectedId.value = n.id
  ElMessage.success('已复制规则')
}
async function deleteRule(r) {
  try {
    await ElMessageBox.confirm(`确认删除规则 "${r.name}"？`, '删除规则', { type: 'warning' })
    rules.value = rules.value.filter(x => x.id !== r.id)
    if (selectedId.value === r.id) selectedId.value = rules.value[0]?.id
    ElMessage.success('已删除')
  } catch {}
}
function addCondition() {
  selectedRule.value.conditions.push({ metric: METRICS[0].key, op: '>', value: 0, duration: 0 })
}
function removeCondition(i) {
  selectedRule.value.conditions.splice(i, 1)
}
function addRule() {
  const n = {
    id: 'R-' + String(rules.value.length + 1).padStart(3, '0'),
    name: '新规则', desc: '', enabled: false, hits24h: 0, hits7d: 0, lastHit: '—',
    level: 'norm', logic: 'AND', cooldown: 60,
    conditions: [{ metric: METRICS[0].key, op: '>', value: 0, duration: 0 }],
    actions: ['inApp']
  }
  rules.value.unshift(n); selectedId.value = n.id
}

/* ---------- 模拟测试 ---------- */
const simResult = ref(null)
function simulate() {
  const r = selectedRule.value
  // 模拟过去 7 天数据匹配
  const periods = []
  const now = dayjs()
  for (let d = 6; d >= 0; d--) {
    for (let h = 0; h < 24; h++) {
      const hit = Math.random() < 0.02 + (r.hits7d > 0 ? 0.01 : 0)
      if (hit) periods.push({
        time: now.subtract(d, 'day').hour(h).minute(Math.floor(Math.random() * 60)).format('MM-DD HH:mm:ss'),
        station: ['常熟新材料园储能站', '昆山光储一体站', '苏州工业园储能电站'][Math.floor(Math.random() * 3)],
        location: `${Math.floor(Math.random() * 4) + 1}#舱 / ${Math.floor(Math.random() * 4) + 1}#簇 / PACK-${String(Math.floor(Math.random() * 16) + 1).padStart(2,'0')}`,
        condition: r.conditions[0],
        actualValue: (r.conditions[0].value * (1.05 + Math.random() * 0.4)).toFixed(2)
      })
    }
  }
  simResult.value = {
    rule: r.id,
    hits: periods.length,
    falsePositives: Math.floor(periods.length * 0.05),
    avgInterval: periods.length > 0 ? Math.floor(7 * 24 * 60 / periods.length) : 0,
    examples: periods.slice(0, 6)
  }
  ElMessage.success(`模拟完成：过去 7 天命中 ${periods.length} 次`)
}

function getMetricMeta(key) { return METRICS.find(m => m.key === key) }
function getLevelMeta(key) { return LEVELS.find(l => l.key === key) }
function getActionMeta(key) { return ACTIONS.find(a => a.key === key) }
</script>

<template>
  <div class="rules">
    <PageHeader
      tag="RULES"
      title="告警规则引擎"
      desc="多维条件 · AND/OR 逻辑 · 持续时间 + 冷却 · 多通道动作 · 历史回放模拟"
    >
      <template #actions>
        <el-button :icon="MagicStick" @click="simulate">模拟测试</el-button>
        <el-button type="primary" :icon="Plus" @click="addRule">新建规则</el-button>
      </template>
    </PageHeader>

    <!-- KPI -->
    <div class="kpi-row">
      <div class="kp">
        <div class="kp-l">规则总数</div>
        <div class="kp-v">{{ rules.length }}</div>
        <div class="kp-s">启用 <b style="color:#22d3a0">{{ rules.filter(r => r.enabled).length }}</b> · 停用 {{ rules.filter(r => !r.enabled).length }}</div>
      </div>
      <div class="kp">
        <div class="kp-l">24h 命中</div>
        <div class="kp-v" style="color:#015eea">{{ rules.reduce((a,b)=>a+b.hits24h,0) }}</div>
        <div class="kp-s">事件触发数</div>
      </div>
      <div class="kp">
        <div class="kp-l">7d 命中</div>
        <div class="kp-v">{{ rules.reduce((a,b)=>a+b.hits7d,0) }}</div>
        <div class="kp-s">趋势 <b style="color:#22d3a0">-12%</b></div>
      </div>
      <div class="kp">
        <div class="kp-l">严重级规则</div>
        <div class="kp-v" style="color:#ef4444">{{ rules.filter(r => r.level === 'crit').length }}</div>
        <div class="kp-s">需自动处置</div>
      </div>
      <div class="kp">
        <div class="kp-l">规则模板库</div>
        <div class="kp-v" style="color:#06b6d4">28</div>
        <div class="kp-s">行业最佳实践</div>
      </div>
    </div>

    <!-- 主体：左侧规则列表 + 右侧编辑器 -->
    <div class="layout">
      <div class="list panel">
        <div class="ls-head">
          <div class="ls-title">规则列表</div>
          <el-input v-model="search" placeholder="搜索" clearable size="small" style="width: 130px" />
        </div>
        <div class="ls-filters">
          <el-select v-model="filterLevel" placeholder="全部级别" clearable size="small" style="width:100%">
            <el-option v-for="l in LEVELS" :key="l.key" :label="l.label" :value="l.key" />
          </el-select>
          <el-select v-model="filterEnabled" placeholder="全部状态" clearable size="small" style="width:100%">
            <el-option label="启用中" value="on" />
            <el-option label="已停用" value="off" />
          </el-select>
        </div>

        <div class="ls-items">
          <div
            v-for="r in filtered" :key="r.id"
            class="ls-item"
            :class="{ active: selectedId === r.id }"
            @click="selectedId = r.id"
          >
            <div class="li-head">
              <span class="li-id">{{ r.id }}</span>
              <el-switch v-model="r.enabled" size="small" @click.stop />
            </div>
            <div class="li-name">{{ r.name }}</div>
            <div class="li-meta">
              <span class="li-lv" :style="{ color: getLevelMeta(r.level).color, background: getLevelMeta(r.level).color + '22' }">{{ getLevelMeta(r.level).label }}</span>
              <span class="li-cnt">7d {{ r.hits7d }} 次</span>
            </div>
          </div>
        </div>
      </div>

      <div class="editor panel" v-if="selectedRule">
        <!-- 编辑器头 -->
        <div class="ed-head">
          <div class="ed-left">
            <input v-model="selectedRule.name" class="ed-name" />
            <div class="ed-id">{{ selectedRule.id }}</div>
          </div>
          <div class="ed-actions">
            <el-button :icon="MagicStick" @click="simulate">模拟测试</el-button>
            <el-button :icon="CopyDocument" @click="dupRule(selectedRule)">复制</el-button>
            <el-button :icon="Delete" type="danger" plain @click="deleteRule(selectedRule)">删除</el-button>
            <el-button type="primary">保存规则</el-button>
          </div>
        </div>

        <!-- 描述 -->
        <div class="form">
          <div class="form-row">
            <div class="form-l">规则描述</div>
            <input v-model="selectedRule.desc" class="form-i" placeholder="简要描述这条规则的目的与适用场景" />
          </div>
          <div class="form-row">
            <div class="form-l">告警级别</div>
            <div class="lv-options">
              <button
                v-for="l in LEVELS" :key="l.key"
                :class="{ active: selectedRule.level === l.key }"
                :style="{ '--c': l.color }"
                @click="selectedRule.level = l.key"
              >{{ l.label }}</button>
            </div>
          </div>
          <div class="form-row">
            <div class="form-l">冷却时间</div>
            <div class="form-cooldown">
              <el-input-number v-model="selectedRule.cooldown" :min="0" :step="30" size="default" />
              <span>秒（同站点 + 同设备同一规则在冷却期内不重复触发）</span>
            </div>
          </div>
        </div>

        <!-- 条件 -->
        <div class="block">
          <div class="bl-head">
            <div class="bl-title">触发条件</div>
            <div class="bl-tools">
              <el-radio-group v-model="selectedRule.logic" size="small">
                <el-radio-button label="AND">全部满足 AND</el-radio-button>
                <el-radio-button label="OR">任一满足 OR</el-radio-button>
              </el-radio-group>
              <el-button :icon="Plus" size="small" @click="addCondition">添加条件</el-button>
            </div>
          </div>
          <div class="conditions">
            <div class="cnd" v-for="(c, i) in selectedRule.conditions" :key="i">
              <div class="cnd-no">{{ i + 1 }}</div>
              <el-select v-model="c.metric" filterable style="width:240px" size="default">
                <el-option-group v-for="cat in [...new Set(METRICS.map(m => m.cat))]" :key="cat" :label="cat">
                  <el-option v-for="m in METRICS.filter(m => m.cat === cat)" :key="m.key" :label="m.label" :value="m.key" />
                </el-option-group>
              </el-select>
              <el-select v-model="c.op" style="width:130px" size="default">
                <el-option v-for="o in OPS" :key="o.key" :label="o.label" :value="o.key" />
              </el-select>
              <el-input-number v-model="c.value" size="default" controls-position="right" />
              <span class="cnd-unit">{{ getMetricMeta(c.metric).unit }}</span>
              <span class="cnd-and">持续</span>
              <el-input-number v-model="c.duration" :min="0" :step="10" size="default" controls-position="right" style="width:120px" />
              <span class="cnd-unit">秒</span>
              <el-button :icon="Delete" text size="small" @click="removeCondition(i)" v-if="selectedRule.conditions.length > 1" />
              <span class="cnd-logic" v-if="i < selectedRule.conditions.length - 1">{{ selectedRule.logic }}</span>
            </div>
          </div>
        </div>

        <!-- 动作 -->
        <div class="block">
          <div class="bl-head">
            <div class="bl-title">触发动作</div>
            <div class="bl-tip">规则命中后按顺序执行</div>
          </div>
          <div class="actions">
            <button
              v-for="a in ACTIONS" :key="a.key"
              class="act"
              :class="{ active: selectedRule.actions.includes(a.key) }"
              @click="selectedRule.actions = selectedRule.actions.includes(a.key) ? selectedRule.actions.filter(x => x !== a.key) : [...selectedRule.actions, a.key]"
            >
              <el-icon><component :is="a.icon" /></el-icon>
              <span>{{ a.label }}</span>
              <el-icon class="check" v-if="selectedRule.actions.includes(a.key)"><CircleCheckFilled /></el-icon>
            </button>
          </div>
        </div>

        <!-- 模拟测试结果 -->
        <div class="block sim" v-if="simResult && simResult.rule === selectedRule.id">
          <div class="bl-head">
            <div class="bl-title"><el-icon><MagicStick /></el-icon> 模拟测试结果</div>
            <div class="bl-tip">基于过去 7 天历史数据回放</div>
          </div>
          <div class="sim-kpi">
            <div><div class="sk-l">总命中</div><div class="sk-v" style="color:#015eea">{{ simResult.hits }}</div></div>
            <div><div class="sk-l">误报</div><div class="sk-v" style="color:#f59e0b">{{ simResult.falsePositives }}</div></div>
            <div><div class="sk-l">命中率</div><div class="sk-v ok">{{ simResult.hits === 0 ? '—' : (((simResult.hits - simResult.falsePositives) / simResult.hits) * 100).toFixed(1) + '%' }}</div></div>
            <div><div class="sk-l">平均间隔</div><div class="sk-v">{{ simResult.avgInterval }} <small>min</small></div></div>
          </div>
          <div class="sim-list" v-if="simResult.examples.length">
            <div class="sl-head">命中样例（前 6 条）</div>
            <div class="sl" v-for="(e, i) in simResult.examples" :key="i">
              <span class="sl-t">{{ e.time }}</span>
              <span class="sl-s">{{ e.station }}</span>
              <span class="sl-l">{{ e.location }}</span>
              <span class="sl-cnd"><b>{{ getMetricMeta(e.condition.metric).label }}</b> = {{ e.actualValue }} {{ getMetricMeta(e.condition.metric).unit }}</span>
            </div>
          </div>
        </div>

        <!-- 命中历史 -->
        <div class="block hits">
          <div class="bl-head">
            <div class="bl-title">命中统计</div>
          </div>
          <div class="hits-grid">
            <div class="hg"><div class="hg-l">24 小时</div><div class="hg-v" style="color:#015eea">{{ selectedRule.hits24h }}</div></div>
            <div class="hg"><div class="hg-l">7 天</div><div class="hg-v">{{ selectedRule.hits7d }}</div></div>
            <div class="hg"><div class="hg-l">最近命中</div><div class="hg-v sm">{{ selectedRule.lastHit }}</div></div>
            <div class="hg"><div class="hg-l">状态</div><div class="hg-v">
              <el-tag :type="selectedRule.enabled ? 'success' : 'info'" size="small">{{ selectedRule.enabled ? '运行中' : '已停用' }}</el-tag>
            </div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.rules { padding-bottom: 24px; }

.kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 16px; }
.kp {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  padding: 16px 18px; box-shadow: $shadow-card; position: relative; overflow: hidden;
  &::after { content: ''; position: absolute; left: 0; bottom: 0; right: 0; height: 2px; background: $grad-cyan; }
}
.kp-l { font-size: 12px; color: $text-muted; }
.kp-v { font-family: $font-num; font-variant-numeric: tabular-nums; font-size: 28px; font-weight: 600; margin: 4px 0; }
.kp-s { font-size: 11px; color: $text-muted; b { font-family: $font-num; } }

.layout { display: grid; grid-template-columns: 320px 1fr; gap: 16px; }
.panel {
  background: $bg-card; border: 1px solid $border-soft; border-radius: $radius;
  box-shadow: $shadow-card;
}

/* === List === */
.list { padding: 16px; display: flex; flex-direction: column; max-height: calc(100vh - 280px); }
.ls-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.ls-title { font-size: 14px; font-weight: 600; }
.ls-filters { display: flex; gap: 8px; margin-bottom: 12px; }
.ls-items { flex: 1; overflow: auto; margin: -4px; padding: 4px; }
.ls-item {
  padding: 12px; border-radius: 8px; cursor: pointer; margin-bottom: 6px;
  border: 1px solid transparent;
  transition: all 0.15s;
  &:hover { background: $bg-soft; }
  &.active { background: rgba(1, 94, 234, 0.05); border-color: rgba(1, 94, 234, 0.2); }
}
.li-head { display: flex; justify-content: space-between; align-items: center; }
.li-id { font-family: $font-num; font-size: 11px; color: $text-muted; }
.li-name { font-size: 13px; font-weight: 600; margin: 6px 0; }
.li-meta { display: flex; gap: 8px; align-items: center; font-size: 11px; }
.li-lv { padding: 2px 8px; border-radius: 4px; font-weight: 500; }
.li-cnt { color: $text-muted; font-family: $font-num; }

/* === Editor === */
.editor { padding: 20px 24px; }
.ed-head { display: flex; justify-content: space-between; align-items: center; padding-bottom: 18px; border-bottom: 1px solid $border-soft; margin-bottom: 18px; }
.ed-left { display: flex; align-items: center; gap: 12px; }
.ed-name { border: none; font-size: 20px; font-weight: 600; padding: 4px 8px; border-radius: 6px; min-width: 200px; outline: none;
  &:focus { background: $bg-soft; box-shadow: 0 0 0 2px rgba(1,94,234,0.2); }
}
.ed-id { font-family: $font-num; font-size: 12px; color: $text-muted; padding: 2px 8px; background: $bg-soft; border-radius: 4px; }
.ed-actions { display: flex; gap: 8px; }

.form { padding: 4px 0 16px; }
.form-row { display: grid; grid-template-columns: 110px 1fr; align-items: center; gap: 16px; padding: 8px 0; }
.form-l { font-size: 13px; color: $text-secondary; }
.form-i { border: 1px solid $border-soft; padding: 8px 12px; border-radius: 6px; font-size: 14px; outline: none; width: 100%; max-width: 600px;
  &:focus { border-color: $brand-blue; box-shadow: 0 0 0 3px rgba(1,94,234,0.08); }
}
.form-cooldown { display: flex; gap: 12px; align-items: center; font-size: 12px; color: $text-muted; }
.lv-options { display: flex; gap: 8px; }
.lv-options button {
  padding: 6px 16px; border: 1.5px solid $border-soft; background: $bg-card;
  border-radius: 6px; font-size: 13px; cursor: pointer; transition: all 0.15s;
  color: $text-secondary;
  &:hover { border-color: var(--c); }
  &.active { background: var(--c); color: #fff; border-color: var(--c); }
}

/* === Block === */
.block {
  background: $bg-soft;
  border-radius: $radius;
  padding: 16px 18px;
  margin-bottom: 14px;
}
.bl-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.bl-title { font-size: 14px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.bl-title .el-icon { color: $brand-blue; }
.bl-tools { display: flex; gap: 10px; align-items: center; }
.bl-tip { font-size: 12px; color: $text-muted; }

.conditions { display: flex; flex-direction: column; gap: 10px; }
.cnd {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  background: $bg-card; border: 1px solid $border-soft; border-radius: 8px;
  position: relative;
  flex-wrap: wrap;
}
.cnd-no { width: 24px; height: 24px; border-radius: 50%; background: $grad-cyan; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; flex-shrink: 0; }
.cnd-unit { font-size: 13px; color: $text-muted; }
.cnd-and { font-size: 12px; color: $text-secondary; }
.cnd-logic {
  position: absolute; left: 50%; bottom: -16px; transform: translateX(-50%);
  background: $brand-blue; color: #fff; font-size: 11px; padding: 1px 8px; border-radius: 10px;
  font-weight: 600;
}

/* === Actions === */
.actions { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.act {
  position: relative;
  background: $bg-card; border: 1.5px solid $border-soft; border-radius: 8px;
  padding: 14px 8px;
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  cursor: pointer; transition: all 0.15s;
  color: $text-secondary;
  .el-icon { font-size: 22px; }
  &:hover { border-color: $brand-blue; color: $brand-blue; }
  &.active {
    background: rgba(1,94,234,0.06);
    border-color: $brand-blue;
    color: $brand-blue;
  }
  .check { position: absolute; top: 4px; right: 4px; color: #22d3a0; font-size: 14px; }
  span { font-size: 12px; }
}

/* === Sim === */
.block.sim { background: linear-gradient(135deg, #fef3c7 0%, #fff7ed 50%, $bg-card 100%); border: 1px solid #fbbf24; }
.sim-kpi { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 12px; }
.sim-kpi > div { background: $bg-card; border-radius: 8px; padding: 12px 16px; }
.sk-l { font-size: 12px; color: $text-muted; }
.sk-v { font-family: $font-num; font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 600; margin-top: 2px; small { font-size: 12px; color: $text-muted; } &.ok { color: #22d3a0; } }
.sim-list { background: $bg-card; border-radius: 8px; padding: 14px 16px; }
.sl-head { font-size: 12px; color: $text-muted; margin-bottom: 8px; }
.sl { display: grid; grid-template-columns: 140px 200px 220px 1fr; gap: 12px; padding: 6px 0; font-size: 12px; border-bottom: 1px dashed $border-soft; }
.sl-t { font-family: $font-num; color: $text-secondary; }
.sl-s { font-weight: 600; }
.sl-l { color: $text-secondary; }
.sl-cnd { color: $text-muted; b { color: $text-primary; } }

/* === Hits === */
.hits-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
.hg { background: $bg-card; border-radius: 8px; padding: 14px 16px; }
.hg-l { font-size: 12px; color: $text-muted; }
.hg-v { font-family: $font-num; font-variant-numeric: tabular-nums; font-size: 20px; font-weight: 600; margin-top: 4px; &.sm { font-size: 13px; font-weight: 500; } }

@media (max-width: 1400px) {
  .kpi-row { grid-template-columns: repeat(3, 1fr); }
  .actions { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
}
</style>
