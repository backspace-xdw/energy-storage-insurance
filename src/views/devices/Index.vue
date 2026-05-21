<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import DeviceTabs from './DeviceTabs.vue'
import { stations, buildStationTree } from '@/mock/data'
import { Download, Document, Filter, View, Lock, Star, StarFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useDevicesPrefStore } from '@/stores/devicesPref'

const router = useRouter()
const route = useRoute()
const prefStore = useDevicesPrefStore()

const currentStationId = ref(stations[0].id)
const tree = ref(null)
const selectedNode = ref(null)
const treeRef = ref(null)
const activeTab = ref(prefStore.lastTab || 'realtime')

function findNode(root, id) {
  if (!root) return null
  if (root.id === id) return root
  for (const c of root.children || []) {
    const f = findNode(c, id)
    if (f) return f
  }
  return null
}

function loadTree(id, nodeId) {
  tree.value = buildStationTree(id)
  const target = nodeId ? findNode(tree.value, nodeId) : null
  selectedNode.value = target || tree.value
  if (target) {
    nextTick(() => {
      treeRef.value?.setCurrentKey?.(target.id)
    })
  }
}

onMounted(() => {
  // 优先 URL > Pinia 偏好 > 默认
  const q = route.query
  const stationId = q.s || prefStore.lastStationId || stations[0].id
  const nodeId = q.n || prefStore.lastNodeId || ''
  const tab = q.tab || prefStore.lastTab || 'realtime'
  if (stations.find(s => s.id === stationId)) currentStationId.value = stationId
  activeTab.value = tab
  loadTree(currentStationId.value, nodeId)
})

function onSelect(data) { selectedNode.value = data }

/* ---------- 路由/偏好同步 ---------- */
watch([currentStationId, selectedNode, activeTab], () => {
  const sid = currentStationId.value
  const nid = selectedNode.value?.id || ''
  const tab = activeTab.value
  prefStore.lastStationId = sid
  prefStore.lastNodeId = nid
  prefStore.lastTab = tab
  // 仅当不同才 replace，避免无谓 history 操作
  const same = route.query.s === sid && route.query.n === nid && route.query.tab === tab
  if (!same) {
    router.replace({ query: { ...route.query, s: sid, n: nid || undefined, tab } })
  }
}, { deep: false })

function jumpToFavorite(id) {
  // 从 id 推断 station
  // id 形如 st1001-C01-CL1-P07
  const m = id.match(/^([^-]+)-/)
  const sid = m ? m[1] : null
  if (!sid) { ElMessage.error('关注项格式异常'); return }
  if (sid !== currentStationId.value) {
    currentStationId.value = sid
    loadTree(sid, id)
  } else {
    const t = findNode(tree.value, id)
    if (t) {
      selectedNode.value = t
      nextTick(() => treeRef.value?.setCurrentKey?.(id))
    }
  }
  activeTab.value = 'realtime'
}

const filterText = ref('')

const treeProps = { children: 'children', label: 'label' }
const filterNode = (value, data) => {
  if (!value) return true
  const v = value.toLowerCase()
  return data.label.toLowerCase().includes(v) || (data.id && String(data.id).toLowerCase().includes(v))
}
watch(filterText, (v) => { treeRef.value?.filter(v) })

/* ---------- PACK 状态着色（基于温度/SOH） ---------- */
function packStatus(info) {
  if (!info) return null
  if (info.temperatureMax > 35 || info.soh < 93) return 'warn'
  if (info.temperatureMax > 38 || info.soh < 90) return 'err'
  return 'ok'
}
function aggStatus(node) {
  // 子树聚合：err > warn > ok
  if (!node?.children) return null
  let worst = null
  function walk(n) {
    if (n.type === 'pack') {
      const s = packStatus(n.info)
      if (s === 'err') worst = 'err'
      else if (s === 'warn' && worst !== 'err') worst = 'warn'
      else if (s === 'ok' && !worst) worst = 'ok'
    }
    n.children?.forEach(walk)
  }
  walk(node)
  return worst
}
function nodeStatusInfo(data) {
  if (data.type === 'pack') {
    const s = packStatus(data.info)
    return s ? { status: s, label: s === 'err' ? '异常' : s === 'warn' ? '警示' : '正常' } : null
  }
  if (data.type === 'cabin' || data.type === 'cluster') {
    const s = aggStatus(data)
    return s && s !== 'ok' ? { status: s, label: s === 'err' ? '含异常' : '含警示' } : null
  }
  return null
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
  return { type: n.type, label: n.label, info: n.info, node: n }
})

/* ---------- 详情头操作按钮 ---------- */
function gotoRealtime() {
  ElMessage.success('正在跳转实时监控')
  router.push('/app/realtime')
}
function gotoEvidence() {
  ElMessage.success('正在打开承保证据')
  router.push('/app/evidence')
}

/* ---------- 顶部操作 ---------- */
function exportLedger() {
  const flat = []
  function walk(n, path) {
    flat.push({ path: path + n.label, type: n.type, id: n.id, ...(n.info || {}) })
    n.children?.forEach(c => walk(c, path + n.label + ' / '))
  }
  if (tree.value) walk(tree.value, '')
  const fields = Array.from(new Set(flat.flatMap(r => Object.keys(r))))
  const csv = [fields.join(',')]
  flat.forEach(r => {
    csv.push(fields.map(f => {
      const v = r[f]
      if (v === undefined || v === null) return ''
      const s = String(v).replace(/"/g, '""')
      return /[,"\n]/.test(s) ? `"${s}"` : s
    }).join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${tree.value?.label || 'station'}-台账-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${flat.length} 条台账数据`)
}
</script>

<template>
  <div class="devices">
    <PageHeader
      tag="DEVICES"
      title="承保设备管理"
      desc="站-舱-簇-PACK 四级数字档案 · 自动构建 · 一键导出"
    >
      <template #actions>
        <el-popover
          v-if="prefStore.favoriteCount > 0"
          placement="bottom-end"
          :width="320"
          trigger="click"
        >
          <template #reference>
            <el-button>
              <el-icon style="color:#f59e0b"><StarFilled /></el-icon>
              <span style="margin-left:6px">关注 {{ prefStore.favoriteCount }}</span>
            </el-button>
          </template>
          <div class="fav-pop">
            <div class="fav-head">
              <span>已关注 PACK</span>
              <el-button text type="primary" size="small" @click="prefStore.clearFavorites()">清空</el-button>
            </div>
            <div class="fav-list">
              <div
                v-for="id in prefStore.favoriteList" :key="id"
                class="fav-item"
                @click="jumpToFavorite(id)"
              >
                <el-icon class="fav-star"><StarFilled /></el-icon>
                <code class="fav-id">{{ id }}</code>
              </div>
            </div>
          </div>
        </el-popover>
        <el-button :icon="Document" @click="exportLedger">导出台账清单</el-button>
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
            ref="treeRef"
            :data="[tree]"
            :props="treeProps"
            node-key="id"
            highlight-current
            :default-expanded-keys="[tree.id, ...tree.children.map(c => c.id)]"
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
                <span
                  v-if="nodeStatusInfo(data)"
                  class="tn-dot"
                  :class="nodeStatusInfo(data).status"
                  :title="nodeStatusInfo(data).label"
                />
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
              <el-button :icon="View" @click="gotoRealtime">实时监控</el-button>
              <el-button type="primary" :icon="Lock" @click="gotoEvidence">查看承保证据</el-button>
            </div>
          </div>
          <DeviceTabs :detail="detail" v-model:activeTab="activeTab" :key="detail.label" />
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
.tree-node { display: flex; align-items: center; gap: 8px; width: 100%; }
.tn-icon {
  width: 22px; height: 22px; border-radius: 6px; color: #fff;
  font-size: 11px; display: flex; align-items: center; justify-content: center;
  font-weight: 600; flex-shrink: 0;
}
.tn-label { font-size: 13px; flex: 1; min-width: 0; }
.tn-dot {
  width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; flex-shrink: 0;
  &.ok   { background: #22d3a0; }
  &.warn { background: #f59e0b; box-shadow: 0 0 0 0 rgba(245,158,11,0.5); animation: pulse-warn 1.8s infinite; }
  &.err  { background: #ef4444; box-shadow: 0 0 0 0 rgba(239,68,68,0.5); animation: pulse-err 1.4s infinite; }
}
@keyframes pulse-warn {
  0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0.5); }
  70%  { box-shadow: 0 0 0 5px rgba(245,158,11,0); }
  100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
}
@keyframes pulse-err {
  0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.55); }
  70%  { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
  100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
}

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

/* === Favorites popover === */
.fav-pop { padding: 4px; }
.fav-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;
  font-size: 12px; color: $text-muted;
}
.fav-list { display: flex; flex-direction: column; gap: 4px; max-height: 320px; overflow: auto; }
.fav-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 8px;
  border-radius: 6px; cursor: pointer; transition: background 0.15s;
  &:hover { background: $bg-soft; }
}
.fav-star { color: #f59e0b; font-size: 14px; }
.fav-id { font-size: 12px; color: $text-secondary; font-family: $font-num; }

@media (max-width: 1100px) {
  .layout { grid-template-columns: 1fr; }
}
</style>
