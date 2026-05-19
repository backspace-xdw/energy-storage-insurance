<script setup>
import { ref, computed } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { evidences } from '@/mock/data'
import { Lock, Download, Plus, Check, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const search = ref('')
const filterType = ref('')
const detail = ref(null)
const drawerVisible = ref(false)

const filtered = computed(() =>
  evidences.filter(e =>
    (!search.value || e.id.includes(search.value) || e.stationName.includes(search.value) || e.hash.includes(search.value)) &&
    (!filterType.value || e.type === filterType.value)
  )
)

function openDetail(row) {
  detail.value = row
  drawerVisible.value = true
}

function verify(row) {
  ElMessage.success(`证据 ${row.id} 校验通过：哈希一致、时间戳有效、链上记录存在`)
}

function fixate() {
  ElMessage.success('已发起一键固化存证，将在 30 秒内完成上链')
}

const types = ['承保设备基线', '关键阈值基线', '环境基线', '消防设施基线', '视觉图像基线']

const totalChain = evidences.filter(e => e.status === '已上链').length
</script>

<template>
  <div class="evidence">
    <PageHeader
      tag="EVIDENCE"
      title="承保证据固化与存证"
      desc="加密固化 · 时间戳认证 · 哈希校验 · 区块链存证"
    >
      <template #actions>
        <el-button :icon="Download">导出存证报告</el-button>
        <el-button type="primary" :icon="Plus" @click="fixate">一键固化新证据</el-button>
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
        <div class="mc-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444)"><el-icon><Lock /></el-icon></div>
        <div>
          <div class="mc-label">争议争议数</div>
          <div class="mc-value">0 <span>起</span></div>
        </div>
      </div>
    </div>

    <div class="filter-card">
      <el-input
        v-model="search"
        placeholder="搜索证据编号 / 站点 / 哈希"
        clearable
        :prefix-icon="Search"
        style="width: 320px"
      />
      <el-select v-model="filterType" placeholder="按证据类型筛选" clearable style="width: 200px">
        <el-option v-for="t in types" :key="t" :label="t" :value="t" />
      </el-select>
      <div class="filter-tip">
        <el-icon><Lock /></el-icon>
        共 {{ filtered.length }} 条证据 · 全部经哈希校验
      </div>
    </div>

    <div class="table-wrap">
      <el-table :data="filtered" stripe style="width: 100%">
        <el-table-column prop="id" label="证据编号" width="120" />
        <el-table-column prop="stationName" label="站点" min-width="200" />
        <el-table-column prop="type" label="证据类型" width="160">
          <template #default="{ row }">
            <el-tag size="small" effect="plain">{{ row.type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="存证时间" width="180" />
        <el-table-column label="哈希" width="240">
          <template #default="{ row }">
            <code class="hash">{{ row.hash.slice(0, 28) }}…</code>
          </template>
        </el-table-column>
        <el-table-column label="区块高度" width="120">
          <template #default="{ row }">
            <span class="chain">#{{ row.chainHeight.toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '已上链' ? 'success' : 'info'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text type="primary" @click="verify(row)">校验</el-button>
            <el-button text type="primary">下载</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-drawer v-model="drawerVisible" title="证据详情" size="540px">
      <template v-if="detail">
        <div class="d-section">
          <div class="d-label">证据编号</div>
          <div class="d-value mono">{{ detail.id }}</div>
        </div>
        <div class="d-section">
          <div class="d-label">站点</div>
          <div class="d-value">{{ detail.stationName }}</div>
        </div>
        <div class="d-section">
          <div class="d-label">证据类型</div>
          <div class="d-value">{{ detail.type }}</div>
        </div>
        <div class="d-section">
          <div class="d-label">存证时间</div>
          <div class="d-value">{{ detail.createTime }}</div>
        </div>
        <div class="d-section">
          <div class="d-label">完整哈希 (SHA-256)</div>
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
          <div class="d-label">证据内容预览</div>
          <pre class="preview">{
  "stationId": "ST1001",
  "snapshotTime": "{{ detail.createTime }}",
  "baseline": {
    "pack_voltage_normal": [46.5, 47.8],
    "pack_temp_normal": [-10, 35],
    "alarm_threshold_overtemp": 45,
    "fire_pressure_normal": [11.5, 12.8]
  },
  "verifier": "system_auto",
  "chain": "EvidenceChain-v1",
  "signed": true
}</pre>
        </div>
        <div class="d-actions">
          <el-button type="primary" :icon="Check" @click="verify(detail)">立即校验</el-button>
          <el-button :icon="Download">下载证据包</el-button>
        </div>
      </template>
    </el-drawer>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
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

.filter-card {
  display: flex; align-items: center; gap: 16px;
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 14px 18px; margin-bottom: 16px;
  box-shadow: $shadow-card;
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
.hash { background: $bg-soft; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: $brand-blue; }
.chain { font-family: monospace; color: $brand-blue; font-weight: 600; }

.d-section { margin-bottom: 20px; }
.d-label { font-size: 12px; color: $text-muted; margin-bottom: 6px; letter-spacing: 0.5px; }
.d-value { font-size: 14px; }
.mono { font-family: monospace; }
.code-block { display: block; background: $bg-soft; padding: 10px 14px; border-radius: 6px; font-size: 12px; word-break: break-all; color: $brand-blue; }
.d-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 18px; }
.d-grid > div { display: flex; justify-content: space-between; font-size: 13px; }
.dg-l { color: $text-muted; }
.dg-v { font-weight: 500; }
.preview {
  background: #0f152f;
  color: #a5d8ff;
  border-radius: 8px;
  padding: 14px;
  font-size: 12px;
  line-height: 1.7;
  margin: 0;
  font-family: monospace;
}
.d-actions { display: flex; gap: 12px; margin-top: 16px; }
</style>
