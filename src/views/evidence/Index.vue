<script setup>
import { ref, computed, reactive } from 'vue'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import { evidences as seedEvidences, stations } from '@/mock/data'
import {
  Lock, Download, Plus, Check, Search, DocumentCopy,
  CircleCheckFilled, Loading, Warning
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

/* ---------- 数据（可变 ref，方便新增） ---------- */
const evidences = ref([...seedEvidences])

/* ---------- 过滤 ---------- */
const search = ref('')
const filterType = ref('')
const filterStatus = ref('')

const filtered = computed(() =>
  evidences.value.filter(e =>
    (!search.value || e.id.includes(search.value) || e.stationName.includes(search.value) || e.hash.includes(search.value)) &&
    (!filterType.value || e.type === filterType.value) &&
    (!filterStatus.value || e.status === filterStatus.value)
  )
)
const hasFilter = computed(() => !!(search.value || filterType.value || filterStatus.value))
function clearFilters() { search.value = ''; filterType.value = ''; filterStatus.value = '' }

const TYPES = ['承保设备基线', '关键阈值基线', '环境基线', '消防设施基线', '视觉图像基线']
const TYPE_COLORS = {
  '承保设备基线': '#015eea',
  '关键阈值基线': '#06b6d4',
  '环境基线':     '#22d3a0',
  '消防设施基线': '#ef4444',
  '视觉图像基线': '#6366f1'
}
const typeDist = computed(() => TYPES.map(t => ({
  type: t,
  color: TYPE_COLORS[t],
  count: evidences.value.filter(e => e.type === t).length
})))

const totalChain = computed(() => evidences.value.filter(e => e.status === '已上链').length)

/* ---------- 详情抽屉 ---------- */
const detail = ref(null)
const drawerVisible = ref(false)
function openDetail(row) { detail.value = row; drawerVisible.value = true }

/* ---------- 按类型生成 JSON 预览 ---------- */
function buildEvidencePayload(ev) {
  const base = {
    evidenceId: ev.id,
    stationId: stations.find(s => s.name === ev.stationName)?.id || 'ST?',
    stationName: ev.stationName,
    type: ev.type,
    snapshotTime: ev.createTime,
    operator: ev.operator,
    chain: 'EvidenceChain-v1',
    hash: ev.hash,
    chainHeight: ev.chainHeight,
    signed: true
  }
  switch (ev.type) {
    case '承保设备基线': return {
      ...base,
      baseline: {
        cabins: 4, clusters: 16, packs: 256,
        vendor: '宁德时代', cellChemistry: 'LFP',
        nominalVoltage_V: 47.36, nominalCapacity_Ah: 280,
        bmsModel: 'B-MAX-2024', firmwareVersion: '2.4.6'
      }
    }
    case '关键阈值基线': return {
      ...base,
      baseline: {
        pack_voltage_normal: [46.5, 47.8],
        cell_voltage_delta_mV_max: 50,
        pack_temp_normal_C: [-10, 35],
        pack_temp_alarm_C: 45,
        insulation_min_kOhm: 500,
        soc_safe_range: [10, 90]
      }
    }
    case '环境基线': return {
      ...base,
      baseline: {
        ambient_temp_C: [22, 28], humidity_pct: [35, 55],
        smoke_mg_m3_max: 1.5, h2_ppm_max: 100, voc_ppm_max: 80,
        airflow_m3_h_min: 1200
      }
    }
    case '消防设施基线': return {
      ...base,
      baseline: {
        system: '七氟丙烷+水喷淋',
        agent_pressure_MPa: [11.5, 12.8],
        detectors: { smoke: 24, h2: 8, temp: 16, video: 4 },
        last_drill: dayjs(ev.createTime).subtract(40, 'day').format('YYYY-MM-DD'),
        certificate_no: 'XF-2025-' + ev.id.slice(-4)
      }
    }
    case '视觉图像基线': return {
      ...base,
      baseline: {
        imageCount: 48,
        resolution: '4096x2160',
        coverage: ['舱外全景', '舱内主干道', '电池簇正面', '配电室', '消防设施'],
        camera_model: 'HikVision DS-2CD7A87FWD',
        retentionDays: 1095,
        sample_uri: `oss://evidence/${ev.id}/snapshot_001.jpg`
      }
    }
  }
  return base
}

/* ---------- 哈希复制 ---------- */
async function copyHash(hash) {
  try {
    await navigator.clipboard.writeText(hash)
    ElMessage.success('哈希已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败：请手动选择')
  }
}

/* ---------- 校验过程模拟 ---------- */
const verifyDialog = ref(false)
const verifying = reactive({
  evId: '',
  steps: [],
  done: false,
  ok: true
})
const VERIFY_STEPS = [
  { key: 'rehash',  label: '重算 SHA-256 哈希',     ms: 600 },
  { key: 'ts',      label: '校验 RFC 3161 时间戳',   ms: 500 },
  { key: 'chain',   label: '查询区块链节点 (EvidenceChain-v1)', ms: 900 },
  { key: 'sign',    label: '比对操作员签名',         ms: 500 }
]
async function startVerify(row) {
  verifyDialog.value = true
  verifying.evId = row.id
  verifying.done = false
  verifying.ok = true
  verifying.steps = VERIFY_STEPS.map(s => ({ ...s, status: 'pending' }))
  for (let i = 0; i < verifying.steps.length; i++) {
    verifying.steps[i].status = 'running'
    await new Promise(r => setTimeout(r, verifying.steps[i].ms))
    verifying.steps[i].status = 'ok'
  }
  verifying.done = true
  ElMessage.success(`证据 ${row.id} 校验通过`)
}

/* ---------- 新增证据 dialog ---------- */
const createDialog = ref(false)
const createForm = reactive({
  stationName: '',
  type: '',
  operator: '系统自动',
  note: ''
})
function openCreate() {
  createForm.stationName = stations[0].name
  createForm.type = TYPES[0]
  createForm.operator = '系统自动'
  createForm.note = ''
  createDialog.value = true
}
function randHash() {
  return 'sha256:' + Array.from({ length: 8 }, () => Math.random().toString(16).slice(2, 6)).join('')
}
function submitCreate() {
  if (!createForm.stationName || !createForm.type) {
    ElMessage.warning('请完整填写站点与类型')
    return
  }
  const last = evidences.value.reduce((a, e) => Math.max(a, +e.id.slice(2)), 30000)
  const lastBlock = evidences.value.reduce((a, e) => Math.max(a, e.chainHeight), 1800000)
  const now = dayjs()
  const newEv = {
    id: 'EV' + (last + 1),
    stationName: createForm.stationName,
    type: createForm.type,
    createTime: now.format('YYYY-MM-DD HH:mm:ss'),
    hash: randHash(),
    chainHeight: lastBlock + 12,
    timestamp: now.format('YYYY-MM-DDTHH:mm:ssZ'),
    status: '已固化',
    fileSize: Math.floor(20 + Math.random() * 240) + ' KB',
    operator: createForm.operator,
    note: createForm.note
  }
  evidences.value = [newEv, ...evidences.value]
  createDialog.value = false
  ElMessage.success(`已固化新证据 ${newEv.id}，30s 内将自动上链`)
  // 30s 后转已上链
  setTimeout(() => {
    const idx = evidences.value.findIndex(e => e.id === newEv.id)
    if (idx >= 0) {
      evidences.value[idx] = { ...evidences.value[idx], status: '已上链', chainHeight: evidences.value[idx].chainHeight + Math.floor(Math.random() * 50) }
    }
  }, 30000)
}

/* ---------- 下载/导出 ---------- */
function downloadJson(filename, obj) {
  const text = JSON.stringify(obj, null, 2)
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
function downloadCsv(filename, rows, header) {
  const csv = [header.join(',')]
  rows.forEach(r => {
    csv.push(header.map(f => {
      const v = r[f]
      const s = v == null ? '' : String(v).replace(/"/g, '""')
      return /[,"\n]/.test(s) ? `"${s}"` : s
    }).join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function downloadEvidence(row) {
  const payload = buildEvidencePayload(row)
  downloadJson(`${row.id}-evidence.json`, payload)
  ElMessage.success(`已导出证据 ${row.id} 的 JSON 包`)
}

function exportReport() {
  downloadCsv(
    `证据存证报告-${dayjs().format('YYYY-MM-DD')}.csv`,
    filtered.value,
    ['id', 'stationName', 'type', 'createTime', 'hash', 'chainHeight', 'timestamp', 'status', 'fileSize', 'operator']
  )
  ElMessage.success(`已导出 ${filtered.value.length} 条存证报告`)
}
</script>

<template>
  <div class="evidence">
    <PageHeader
      tag="EVIDENCE"
      title="承保证据固化与存证"
      desc="加密固化 · 时间戳认证 · 哈希校验 · 区块链存证"
    >
      <template #actions>
        <el-button :icon="Download" @click="exportReport">导出存证报告</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">一键固化新证据</el-button>
      </template>
    </PageHeader>

    <div class="kpi-row">
      <div class="mini-card">
        <div class="mc-icon"><el-icon><Lock /></el-icon></div>
        <div>
          <div class="mc-label">已固化证据</div>
          <div class="mc-value">{{ evidences.length }} <span>条</span></div>
        </div>
      </div>
      <div class="mini-card">
        <div class="mc-icon" style="background:linear-gradient(135deg,#22d3a0,#06b6d4)"><el-icon><Check /></el-icon></div>
        <div>
          <div class="mc-label">已上链记录</div>
          <div class="mc-value">{{ totalChain }} <span>条</span></div>
        </div>
      </div>
      <div class="mini-card">
        <div class="mc-icon" style="background:linear-gradient(135deg,#6366f1,#015eea)"><el-icon><Search /></el-icon></div>
        <div>
          <div class="mc-label">本月校验次数</div>
          <div class="mc-value">142 <span>次</span></div>
        </div>
      </div>
      <div class="mini-card">
        <div class="mc-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444)"><el-icon><Warning /></el-icon></div>
        <div>
          <div class="mc-label">争议数</div>
          <div class="mc-value">0 <span>起</span></div>
        </div>
      </div>
    </div>

    <!-- 类型分布条 -->
    <div class="dist-card">
      <div class="dist-head">
        <span class="dh-title">证据类型分布</span>
        <span class="dh-sub">总计 {{ evidences.length }} 条 · 点击 chip 按类型筛选</span>
      </div>
      <div class="dist-bar">
        <button
          v-for="d in typeDist" :key="d.type"
          v-show="d.count > 0"
          class="dist-seg"
          :class="{ active: filterType === d.type }"
          :style="{ flex: d.count, background: d.color }"
          :title="`${d.type} - ${d.count} 条`"
          @click="filterType = filterType === d.type ? '' : d.type"
        >
          <span class="ds-l">{{ d.type }}</span>
          <span class="ds-n">{{ d.count }}</span>
        </button>
      </div>
    </div>

    <div class="filter-card">
      <el-input
        v-model="search"
        placeholder="搜索证据编号 / 站点 / 哈希"
        clearable
        :prefix-icon="Search"
        style="width: 280px"
      />
      <el-select v-model="filterType" placeholder="按证据类型筛选" clearable style="width: 180px">
        <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" clearable style="width: 120px">
        <el-option label="已上链" value="已上链" />
        <el-option label="已固化" value="已固化" />
      </el-select>
      <el-button v-if="hasFilter" text type="primary" @click="clearFilters">清空筛选</el-button>
      <div class="filter-tip">
        <el-icon><Lock /></el-icon>
        共 {{ filtered.length }} 条证据 · 全部经哈希校验
      </div>
    </div>

    <div class="table-wrap">
      <el-table :data="filtered" stripe style="width: 100%">
        <el-table-column prop="id" label="证据编号" width="120" sortable />
        <el-table-column prop="stationName" label="站点" min-width="200" />
        <el-table-column prop="type" label="证据类型" width="160">
          <template #default="{ row }">
            <el-tag size="small" effect="plain" :style="{ borderColor: TYPE_COLORS[row.type], color: TYPE_COLORS[row.type] }">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="存证时间" width="170" sortable />
        <el-table-column label="哈希" width="230">
          <template #default="{ row }">
            <el-tooltip :content="row.hash" placement="top" effect="dark">
              <code class="hash clickable" @click.stop="copyHash(row.hash)">
                {{ row.hash.slice(0, 26) }}…
                <el-icon class="hash-copy"><DocumentCopy /></el-icon>
              </code>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="区块高度" width="110">
          <template #default="{ row }">
            <span class="chain">#{{ row.chainHeight.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === '已上链' ? 'success' : 'warning'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text type="primary" @click="startVerify(row)">校验</el-button>
            <el-button text type="primary" @click="downloadEvidence(row)">下载</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <div class="tb-empty">
            <div>无匹配证据</div>
            <el-button v-if="hasFilter" text type="primary" @click="clearFilters">清空筛选</el-button>
          </div>
        </template>
      </el-table>
    </div>

    <!-- 详情抽屉 -->
    <el-drawer v-model="drawerVisible" title="证据详情" size="560">
      <template v-if="detail">
        <div class="d-section">
          <div class="d-row">
            <div>
              <div class="d-label">证据编号</div>
              <div class="d-value mono">{{ detail.id }}</div>
            </div>
            <el-tag :type="detail.status === '已上链' ? 'success' : 'warning'" size="small">{{ detail.status }}</el-tag>
          </div>
        </div>
        <div class="d-section">
          <div class="d-label">站点</div>
          <div class="d-value">{{ detail.stationName }}</div>
        </div>
        <div class="d-section">
          <div class="d-label">证据类型</div>
          <el-tag effect="plain" :style="{ borderColor: TYPE_COLORS[detail.type], color: TYPE_COLORS[detail.type] }">{{ detail.type }}</el-tag>
        </div>
        <div class="d-section">
          <div class="d-label">存证时间</div>
          <div class="d-value">{{ detail.createTime }}</div>
        </div>
        <div class="d-section">
          <div class="d-label-row">
            <span class="d-label">完整哈希 (SHA-256)</span>
            <el-button text type="primary" size="small" :icon="DocumentCopy" @click="copyHash(detail.hash)">复制</el-button>
          </div>
          <code class="mono code-block">{{ detail.hash }}</code>
        </div>
        <div class="d-section">
          <div class="d-label">区块链信息</div>
          <div class="d-grid">
            <div><span class="dg-l">链高度</span><span class="dg-v">#{{ detail.chainHeight.toLocaleString() }}</span></div>
            <div><span class="dg-l">时间戳</span><span class="dg-v">{{ detail.timestamp }}</span></div>
            <div><span class="dg-l">操作员</span><span class="dg-v">{{ detail.operator }}</span></div>
            <div><span class="dg-l">大小</span><span class="dg-v">{{ detail.fileSize }}</span></div>
          </div>
        </div>
        <div class="d-section">
          <div class="d-label">证据内容预览 (按类型生成)</div>
          <pre class="preview">{{ JSON.stringify(buildEvidencePayload(detail), null, 2) }}</pre>
        </div>
        <div class="d-actions">
          <el-button type="primary" :icon="Check" @click="startVerify(detail)">立即校验</el-button>
          <el-button :icon="Download" @click="downloadEvidence(detail)">下载证据包</el-button>
        </div>
      </template>
    </el-drawer>

    <!-- 校验过程对话框 -->
    <el-dialog v-model="verifyDialog" :title="`校验证据 ${verifying.evId}`" width="500" :close-on-click-modal="false">
      <div class="vf-list">
        <div
          v-for="s in verifying.steps" :key="s.key"
          class="vf-step" :class="s.status"
        >
          <div class="vf-icon">
            <el-icon v-if="s.status === 'pending'" color="#c4cad8"><Loading /></el-icon>
            <el-icon v-else-if="s.status === 'running'" color="#015eea" class="vf-spin"><Loading /></el-icon>
            <el-icon v-else-if="s.status === 'ok'" color="#22d3a0"><CircleCheckFilled /></el-icon>
          </div>
          <div class="vf-l">{{ s.label }}</div>
          <div class="vf-t">{{ s.status === 'ok' ? '✓ 通过' : s.status === 'running' ? '校验中…' : '等待' }}</div>
        </div>
      </div>
      <div class="vf-result" v-if="verifying.done">
        <el-icon style="color:#22d3a0;font-size:18px"><CircleCheckFilled /></el-icon>
        校验通过 · 证据完整性与链上记录一致
      </div>
      <template #footer>
        <el-button v-if="!verifying.done" disabled>校验进行中…</el-button>
        <el-button v-else type="primary" @click="verifyDialog = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新建证据对话框 -->
    <el-dialog v-model="createDialog" title="一键固化新证据" width="520">
      <el-form :model="createForm" label-width="90px" label-position="left">
        <el-form-item label="所属站点">
          <el-select v-model="createForm.stationName" placeholder="选择站点" style="width:100%">
            <el-option v-for="s in stations" :key="s.id" :label="s.name" :value="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="证据类型">
          <el-select v-model="createForm.type" placeholder="选择类型" style="width:100%">
            <el-option v-for="t in TYPES" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作员">
          <el-select v-model="createForm.operator" style="width:100%">
            <el-option label="系统自动" value="系统自动" />
            <el-option label="核保员A" value="核保员A" />
            <el-option label="核保员B" value="核保员B" />
            <el-option label="风控员C" value="风控员C" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="createForm.note" type="textarea" :rows="3" placeholder="可选：补充说明（不上链）" />
        </el-form-item>
        <div class="cf-tip">
          <el-icon><Lock /></el-icon>
          系统将生成 SHA-256 哈希 + RFC 3161 时间戳，并在 30 秒内提交至 EvidenceChain-v1
        </div>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :icon="Lock" @click="submitCreate">固化并存证</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 16px; }
.mini-card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px;
  display: flex; align-items: center; gap: 14px;
  box-shadow: $shadow-card;
}
.mc-icon {
  width: 44px; height: 44px; border-radius: 10px;
  background: $grad-cyan; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.mc-label { font-size: 12px; color: $text-muted; }
.mc-value { font-size: 22px; font-weight: 600; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; }
.mc-value span { font-size: 12px; color: $text-muted; font-weight: 400; margin-left: 4px; }

/* === 类型分布条 === */
.dist-card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 14px 18px; margin-bottom: 16px; box-shadow: $shadow-card;
}
.dist-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.dh-title { font-size: 13px; font-weight: 600; }
.dh-sub { font-size: 11px; color: $text-muted; }
.dist-bar { display: flex; height: 32px; border-radius: 8px; overflow: hidden; box-shadow: inset 0 1px 2px rgba(0,0,0,0.04); }
.dist-seg {
  border: 0; color: #fff; cursor: pointer; padding: 0 12px;
  display: flex; align-items: center; justify-content: space-between;
  font-size: 12px; gap: 8px;
  transition: filter 0.15s, transform 0.15s;
  &:hover { filter: brightness(1.08); }
  &.active { box-shadow: inset 0 0 0 2px #fff, inset 0 0 0 4px currentColor; }
  .ds-l { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ds-n { font-family: $font-num; font-weight: 700; }
}

.filter-card {
  display: flex; align-items: center; gap: 12px;
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 12px 16px; margin-bottom: 16px;
  box-shadow: $shadow-card; flex-wrap: wrap;
}
.filter-tip {
  margin-left: auto; display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: $text-muted;
}

.table-wrap {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 12px;
  box-shadow: $shadow-card;
}
.tb-empty { padding: 32px 0; color: $text-muted; display: flex; flex-direction: column; gap: 8px; align-items: center; }
.hash { background: $bg-soft; padding: 3px 8px; border-radius: 4px; font-size: 12px; color: $brand-blue;
  display: inline-flex; align-items: center; gap: 4px;
  font-family: monospace;
}
.hash.clickable { cursor: pointer; transition: background 0.15s; &:hover { background: rgba(1,94,234,0.1); } }
.hash-copy { font-size: 11px; opacity: 0.5; }
.hash.clickable:hover .hash-copy { opacity: 1; }
.chain { font-family: monospace; color: $brand-blue; font-weight: 600; }

/* === 抽屉 === */
.d-section { margin-bottom: 18px; }
.d-row { display: flex; justify-content: space-between; align-items: center; }
.d-label { font-size: 12px; color: $text-muted; margin-bottom: 4px; letter-spacing: 0.5px; }
.d-label-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.d-value { font-size: 14px; }
.mono { font-family: monospace; }
.code-block { display: block; background: $bg-soft; padding: 10px 14px; border-radius: 6px; font-size: 12px; word-break: break-all; color: $brand-blue; }
.d-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
.d-grid > div { display: flex; justify-content: space-between; font-size: 13px; }
.dg-l { color: $text-muted; }
.dg-v { font-weight: 500; }
.preview {
  background: #0f152f; color: #a5d8ff;
  border-radius: 8px; padding: 14px;
  font-size: 12px; line-height: 1.7; margin: 0;
  font-family: 'JetBrains Mono', Menlo, monospace;
  overflow-x: auto;
  max-height: 320px; overflow-y: auto;
}
.d-actions { display: flex; gap: 12px; margin-top: 16px; }

/* === 校验对话框 === */
.vf-list { display: flex; flex-direction: column; gap: 8px; padding: 4px 0; }
.vf-step {
  display: grid; grid-template-columns: 28px 1fr auto;
  align-items: center; gap: 12px;
  padding: 12px 14px;
  border: 1px solid $border-soft; border-radius: 8px;
  background: $bg-card;
  transition: background 0.2s, border-color 0.2s;
  &.running { background: rgba(1,94,234,0.04); border-color: rgba(1,94,234,0.3); }
  &.ok      { background: rgba(34,211,160,0.04); border-color: rgba(34,211,160,0.25); }
}
.vf-icon { display: flex; align-items: center; justify-content: center; }
.vf-spin :deep(svg) { animation: vfspin 0.9s linear infinite; }
@keyframes vfspin { to { transform: rotate(360deg); } }
.vf-l { font-size: 13px; }
.vf-t { font-size: 11px; color: $text-muted;
  .vf-step.ok & { color: #22d3a0; font-weight: 600; }
  .vf-step.running & { color: #015eea; }
}
.vf-result {
  margin-top: 12px; padding: 10px 14px;
  background: rgba(34,211,160,0.08); border-radius: 8px;
  font-size: 13px; color: $text-secondary;
  display: flex; align-items: center; gap: 8px;
}

/* === 新建表单 === */
.cf-tip {
  margin-top: 4px; padding: 10px 14px;
  background: $bg-soft; border-radius: 8px;
  font-size: 12px; color: $text-secondary;
  display: flex; align-items: center; gap: 6px;
  .el-icon { color: $brand-blue; }
}

@media (max-width: 1100px) {
  .kpi-row { grid-template-columns: repeat(2, 1fr); }
  .dist-bar { height: auto; flex-wrap: wrap; }
  .dist-seg { flex: 1 1 calc(50% - 4px) !important; padding: 8px 12px; }
}
</style>
