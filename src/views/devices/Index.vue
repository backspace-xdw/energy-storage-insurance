<script setup>
import { ref, computed, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import DeviceTabs from './DeviceTabs.vue'
import { stations, buildStationTree } from '@/mock/data'
import { Download, Document, Filter } from '@element-plus/icons-vue'

const currentStationId = ref(stations[0].id)
const tree = ref(null)
const selectedNode = ref(null)

function loadTree(id) {
  tree.value = buildStationTree(id)
  selectedNode.value = tree.value
}

onMounted(() => loadTree(currentStationId.value))

function onSelect(data) { selectedNode.value = data }

const filterText = ref('')
const filterTree = ref(null)

const treeProps = { children: 'children', label: 'label' }
const filterNode = (value, data) => {
  if (!value) return true
  return data.label.toLowerCase().includes(value.toLowerCase())
}

function nodeIconColor(type) {
  return ({ station: '#015eea', cabin: '#06b6d4', cluster: '#6366f1', pack: '#22d3a0' })[type]
}

function nodeIconLetter(type) {
  return ({ station: '站', cabin: '舱', cluster: '簇', pack: 'P' })[type]
}

const detail = computed(() => {
  const n = selectedNode.value
  if (!n) return null
  return { type: n.type, label: n.label, info: n.info }
})
</script>

<template>
  <div class="devices">
    <PageHeader
      tag="DEVICES"
      title="承保设备管理"
      desc="站-舱-簇-PACK 四级数字档案 · 自动构建 · 一键导出"
    >
      <template #actions>
        <el-button :icon="Filter">高级筛选</el-button>
        <el-button :icon="Document">导出台账清单</el-button>
        <el-button type="primary" :icon="Download">生成初始状态评估报告</el-button>
      </template>
    </PageHeader>

    <div class="layout">
      <!-- LEFT: station list + tree -->
      <div class="left">
        <div class="station-picker card">
          <div class="picker-head">
            <div class="pt">承保站点</div>
            <el-tag size="small" type="info">{{ stations.length }} 座</el-tag>
          </div>
          <div
            class="station-item"
            v-for="s in stations"
            :key="s.id"
            :class="{ active: currentStationId === s.id }"
            @click="currentStationId = s.id; loadTree(s.id)"
          >
            <div class="si-dot" :style="{ background: s.riskScore >= 90 ? '#22d3a0' : s.riskScore >= 75 ? '#06b6d4' : s.riskScore >= 60 ? '#f59e0b' : '#ef4444' }" />
            <div class="si-body">
              <div class="si-name">{{ s.name }}</div>
              <div class="si-sub">{{ s.location }} · {{ s.capacityMWh }} MWh · 风险 {{ s.riskScore }}</div>
            </div>
          </div>
        </div>

        <div class="tree-card card">
          <div class="tc-head">
            <div class="pt">设备层级</div>
            <el-input
              v-model="filterText"
              size="small"
              placeholder="搜索 舱/簇/PACK"
              clearable
              style="width: 140px"
            />
          </div>
          <el-tree
            v-if="tree"
            ref="filterTree"
            :data="[tree]"
            :props="treeProps"
            node-key="id"
            highlight-current
            default-expand-all
            :filter-node-method="filterNode"
            @node-click="onSelect"
            class="device-tree"
          >
            <template #default="{ node, data }">
              <div class="tree-node">
                <div class="tn-icon" :style="{ background: nodeIconColor(data.type) }">
                  {{ nodeIconLetter(data.type) }}
                </div>
                <span class="tn-label">{{ node.label }}</span>
              </div>
            </template>
          </el-tree>
        </div>
      </div>

      <!-- RIGHT: detail -->
      <div class="right">
        <div class="card detail" v-if="detail">
          <div class="detail-head">
            <div class="dh-left">
              <el-tag size="small" effect="dark" :color="nodeIconColor(detail.type)" style="border-color: transparent; color: #fff;">
                {{ ({ station: '站点', cabin: '舱级', cluster: '簇级', pack: 'PACK级' })[detail.type] }}
              </el-tag>
              <span class="dt-title">{{ detail.label }}</span>
              <span class="dt-id">ID: {{ detail.info?.id || selectedNode?.id || '—' }}</span>
            </div>
            <div class="dt-actions">
              <el-button :icon="Filter">实时监控</el-button>
              <el-button type="primary" :icon="Document">查看承保证据</el-button>
            </div>
          </div>
          <DeviceTabs :detail="detail" :key="detail.label" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  align-items: flex-start;
}
.left { display: flex; flex-direction: column; gap: 16px; }
.card {
  background: $bg-card;
  border: 1px solid $border-soft;
  border-radius: $radius;
  padding: 16px 18px;
  box-shadow: $shadow-card;
}
.picker-head, .tc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.pt { font-size: 14px; font-weight: 600; }
.station-item {
  display: flex; gap: 10px; padding: 10px;
  border-radius: 8px; cursor: pointer; transition: background 0.15s;
  &:hover { background: $bg-soft; }
  &.active { background: rgba(1, 94, 234, 0.08); }
}
.si-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
.si-name { font-size: 13px; font-weight: 500; }
.si-sub { font-size: 11px; color: $text-muted; margin-top: 2px; }

.device-tree { font-size: 13px; max-height: 50vh; overflow: auto; }
.tree-node { display: flex; align-items: center; gap: 8px; }
.tn-icon {
  width: 22px; height: 22px; border-radius: 6px; color: #fff;
  font-size: 11px; display: flex; align-items: center; justify-content: center;
  font-weight: 600; flex-shrink: 0;
}
.tn-label { font-size: 13px; }

.right { min-width: 0; }
.detail { padding: 18px 22px; }
.detail-head {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
  padding-bottom: 14px; border-bottom: 1px solid $border-soft;
}
.dh-left { display: flex; align-items: center; gap: 10px; }
.dt-title { font-size: 18px; font-weight: 600; }
.dt-id { font-size: 12px; color: $text-muted; font-family: $font-num; padding: 2px 8px; background: $bg-soft; border-radius: 4px; }
.dt-actions { display: flex; gap: 10px; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
}
</style>
