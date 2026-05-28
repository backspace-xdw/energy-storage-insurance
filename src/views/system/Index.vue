<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import dayjs from 'dayjs'
import echarts from '@/utils/echarts'
import PageHeader from '@/components/PageHeader.vue'
import ChartCard from '@/components/ChartCard.vue'
import {
  Plus, Edit, Delete, Setting, User, Lock, Link, Document,
  Search, Check, Connection, Monitor, RefreshLeft, DataAnalysis, Clock
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSystemStore } from '@/stores/system'

const store = useSystemStore()
const activeTab = ref('users')

/* ---------- 用户 ---------- */
const seedUsers = [
  { id: 1, name: '王核保', role: '核保员', dept: '财险一部', last: '2026-05-18 09:12', status: 'active' },
  { id: 2, name: '李风控', role: '风控员', dept: '风控管理部', last: '2026-05-18 08:45', status: 'active' },
  { id: 3, name: '张理赔', role: '理赔员', dept: '理赔中心', last: '2026-05-17 17:28', status: 'active' },
  { id: 4, name: '赵运维', role: '运营商', dept: '常熟储能站', last: '2026-05-18 10:02', status: 'active' },
  { id: 5, name: '陈审计', role: '审计员', dept: '合规部', last: '2026-05-15 14:31', status: 'inactive' }
]
const userSearch = ref('')
const allUsers = computed(() => {
  const merged = seedUsers
    .filter(u => !store.removedUserIds.includes(u.id))
    .map(u => ({ ...u, ...(store.userOverrides[u.id] || {}) }))
  return [...store.addedUsers, ...merged]
})
const filteredUsers = computed(() =>
  allUsers.value.filter(u =>
    !userSearch.value || (u.name + u.role + u.dept).toLowerCase().includes(userSearch.value.toLowerCase())
  )
)
const userStats = computed(() => ({
  total: allUsers.value.length,
  active: allUsers.value.filter(u => u.status === 'active').length,
  inactive: allUsers.value.filter(u => u.status !== 'active').length
}))

/* ---------- 用户增/编/删 ---------- */
const userDialog = ref(false)
const editingUser = ref(null)  // 编辑时存原对象，null 表示新增
const userForm = reactive({ name: '', role: '核保员', dept: '', status: 'active' })
function openAddUser() {
  editingUser.value = null
  userForm.name = ''; userForm.role = '核保员'; userForm.dept = ''; userForm.status = 'active'
  userDialog.value = true
}
function openEditUser(u) {
  editingUser.value = u
  userForm.name = u.name; userForm.role = u.role; userForm.dept = u.dept; userForm.status = u.status
  userDialog.value = true
}
function submitUser() {
  if (!userForm.name.trim() || !userForm.dept.trim()) {
    ElMessage.warning('请填写姓名和部门'); return
  }
  if (editingUser.value) {
    store.setUser(editingUser.value.id, { ...userForm })
    ElMessage.success(`用户 ${userForm.name} 已更新`)
  } else {
    const nextId = Math.max(0, ...allUsers.value.map(u => u.id)) + 1
    store.addUser({ id: nextId, ...userForm, last: dayjs().format('YYYY-MM-DD HH:mm:ss') })
    ElMessage.success(`已新增用户 ${userForm.name}`)
  }
  userDialog.value = false
}
async function toggleUserActive(u) {
  const next = u.status === 'active' ? 'inactive' : 'active'
  try {
    await ElMessageBox.confirm(
      `确认${next === 'inactive' ? '禁用' : '启用'}用户 ${u.name}？`,
      next === 'inactive' ? '禁用用户' : '启用用户',
      { type: next === 'inactive' ? 'warning' : 'success' }
    )
  } catch { return }
  if (store.addedUsers.find(x => x.id === u.id)) {
    // 在 addedUsers 里直接改
    const arr = store.addedUsers.map(x => x.id === u.id ? { ...x, status: next } : x)
    store.addedUsers.splice(0, store.addedUsers.length, ...arr)
  } else {
    store.setUser(u.id, { status: next })
  }
  ElMessage.success(`已${next === 'active' ? '启用' : '禁用'}`)
}
async function deleteUser(u) {
  try {
    await ElMessageBox.confirm(`确认删除用户 ${u.name}？此操作将记录到审计日志`, '删除用户', { type: 'error' })
  } catch { return }
  store.removeUser(u.id)
  ElMessage.success('已删除')
}

/* ---------- 角色权限 ---------- */
const seedRoles = [
  { name: '核保员', defaultPerms: ['承保设备查看', '核保决策', '生成核保报告'], count: 14 },
  { name: '续保员', defaultPerms: ['续保查看', '续保策略生成', '推送续保提醒'], count: 8 },
  { name: '理赔员', defaultPerms: ['事故溯源', '理赔证据查看', '生成理赔报告'], count: 12 },
  { name: '风控员', defaultPerms: ['全量数据查看', '风险评分', '风险预警'], count: 6 },
  { name: '运营商', defaultPerms: ['本站设备查看', '告警处置', '巡检记录'], count: 38 },
  { name: '审计员', defaultPerms: ['全量审计日志', '操作回溯', '只读'], count: 3 },
  { name: '系统管理员', defaultPerms: ['全部权限'], count: 2 }
]
const ALL_PERMS = [
  '承保设备查看', '核保决策', '生成核保报告', '生成保单',
  '续保查看', '续保策略生成', '推送续保提醒', '签发续保保单',
  '事故溯源', '理赔证据查看', '生成理赔报告', '提交理赔',
  '全量数据查看', '风险评分', '风险预警', '告警处置',
  '本站设备查看', '巡检记录', '操作日志', '审计日志查看',
  '用户管理', '角色权限管理', '接口配置', '平台设置', '全部权限'
]
const rolesWithPerms = computed(() =>
  seedRoles.map(r => ({ ...r, permissions: store.rolePerms[r.name] || r.defaultPerms }))
)

const roleDialog = ref(false)
const editingRole = ref(null)
const roleForm = reactive({ permissions: [] })
function openEditRole(r) {
  editingRole.value = r
  roleForm.permissions = [...r.permissions]
  roleDialog.value = true
}
function submitRole() {
  store.setRolePerms(editingRole.value.name, roleForm.permissions)
  roleDialog.value = false
  ElMessage.success(`角色 ${editingRole.value.name} 权限已更新 (${roleForm.permissions.length} 项)`)
}

/* ---------- 接口对接 ---------- */
const seedInterfaces = [
  { name: 'BMS 电池管理接口', protocol: 'MQTT / HTTP', host: 'bms.cs-station01.local', status: 'online', latency: '32 ms', stations: 6 },
  { name: '消防监控接口', protocol: 'OPC UA', host: 'opcua://fire.station-cluster:4840', status: 'online', latency: '48 ms', stations: 6 },
  { name: '运维管理接口', protocol: 'REST API', host: 'https://ops.platform.com/api', status: 'online', latency: '124 ms', stations: 5 },
  { name: '视频云接口', protocol: 'WebService', host: 'video.cs-cloud.com', status: 'online', latency: '86 ms', stations: 6 },
  { name: '站控/EMS 接口', protocol: 'DB-View', host: 'mysql://ems-replica:3306', status: 'online', latency: '12 ms', stations: 6 },
  { name: '保险业务系统对接', protocol: 'REST API', host: 'https://insurance-core.com/v2', status: 'online', latency: '156 ms', stations: 6 },
  { name: '环境监测接口', protocol: 'MQTT', host: 'env.iot.platform:1883', status: 'warning', latency: '328 ms', stations: 4 }
]
const interfaces = computed(() =>
  seedInterfaces.map(i => ({ ...i, ...(store.interfaceStatus[i.name] || {}) }))
)
const testingInterface = ref(null)
async function testInterface(iface) {
  testingInterface.value = iface.name
  ElMessage.info(`正在测试 ${iface.name}…`)
  await new Promise(r => setTimeout(r, 900 + Math.random() * 700))
  const lat = Math.floor(20 + Math.random() * 200)
  const status = lat > 200 ? 'warning' : 'online'
  store.setInterfaceStatus(iface.name, {
    latency: lat + ' ms',
    status,
    testedAt: dayjs().format('YYYY-MM-DD HH:mm:ss')
  })
  testingInterface.value = null
  ElMessage[status === 'online' ? 'success' : 'warning'](`${iface.name} ${status === 'online' ? '连接正常' : '延迟偏高'} (${lat}ms)`)
}

/* ---------- 审计日志 ---------- */
const seedLogs = [
  { time: '2026-05-18 10:14:23', user: '王核保', action: '导出', target: '核保评估报告 / 常熟新材料园储能站', ip: '10.42.18.7' },
  { time: '2026-05-18 09:58:01', user: '李风控', action: '查询', target: '风险监测 / 告警明细', ip: '10.42.18.12' },
  { time: '2026-05-18 09:32:18', user: 'system', action: '存证', target: '承保证据 EV30041 / 上链 #1827532', ip: '127.0.0.1' },
  { time: '2026-05-18 09:11:04', user: '张理赔', action: '查看', target: '事故溯源 INC-2026-007', ip: '10.42.18.21' },
  { time: '2026-05-18 08:46:22', user: '赵运维', action: '处置', target: '告警 AL20003 / 已恢复', ip: '60.205.x.x' },
  { time: '2026-05-17 22:00:01', user: 'system', action: '续保提醒', target: 'JT-2026-10003 / T-7天', ip: '127.0.0.1' },
  { time: '2026-05-17 16:44:30', user: '王核保', action: '通过核保', target: '常熟新材料园储能站 / 0.95% 费率', ip: '10.42.18.7' },
  { time: '2026-05-17 15:30:00', user: 'system', action: '存证', target: '承保证据 EV30040 / 上链 #1827520', ip: '127.0.0.1' },
  { time: '2026-05-17 14:12:08', user: '陈审计', action: '查看', target: '审计日志 / 5月汇总', ip: '10.42.18.30' }
]
const logSearch = ref('')
const logAction = ref('')
const logDateRange = ref([])
const filteredLogs = computed(() =>
  seedLogs.filter(l => {
    if (logSearch.value && !(l.user + l.target).toLowerCase().includes(logSearch.value.toLowerCase())) return false
    if (logAction.value && l.action !== logAction.value) return false
    if (logDateRange.value?.length === 2) {
      const [s, e] = logDateRange.value
      const t = dayjs(l.time)
      if (s && t.isBefore(dayjs(s))) return false
      if (e && t.isAfter(dayjs(e).endOf('day'))) return false
    }
    return true
  })
)
function exportLogs() {
  const header = ['时间', '用户', '操作', '对象/内容', 'IP']
  const fields = ['time', 'user', 'action', 'target', 'ip']
  const csv = [header.join(',')]
  filteredLogs.value.forEach(r => {
    csv.push(fields.map(f => {
      const v = r[f]
      const s = v == null ? '' : String(v).replace(/"/g, '""')
      return /[,"\n]/.test(s) ? `"${s}"` : s
    }).join(','))
  })
  const blob = new Blob(['﻿' + csv.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `审计日志-${dayjs().format('YYYYMMDD-HHmm')}.csv`; a.click()
  URL.revokeObjectURL(url)
  ElMessage.success(`已导出 ${filteredLogs.value.length} 条审计日志`)
}

/* ---------- 平台设置（可编辑） ---------- */
const SETTING_DEFAULTS = {
  hotDays: 90, warmDays: 365, coldDesc: '1 年以上',
  evidenceYears: '保险期 + 5 年',
  tls: 'TLS 1.3', storageEnc: 'AES-256', blockchain: true, twoFA: true,
  uptime: 99.9, ifaceUptime: 99.5, faultResp: 30, support: '7×24'
}
const settingDraft = reactive({ ...SETTING_DEFAULTS, ...store.settings })
function saveSettings() {
  // 写历史快照（保存前的当前值）
  store.snapshotSettings({ ...store.settings })
  Object.keys(settingDraft).forEach(k => store.setSetting(k, settingDraft[k]))
  ElMessage.success('平台设置已保存（历史快照已保留）')
}
function resetSettings() {
  store.snapshotSettings({ ...store.settings })
  Object.assign(settingDraft, SETTING_DEFAULTS)
  Object.keys(SETTING_DEFAULTS).forEach(k => store.setSetting(k, SETTING_DEFAULTS[k]))
  ElMessage.info('已恢复默认设置（已自动保留快照）')
}

/* ---------- 用户批量操作 ---------- */
const userBatchSel = ref([])
const allUsersSelected = computed(() => {
  return filteredUsers.value.length > 0 && filteredUsers.value.every(u => userBatchSel.value.includes(u.id))
})
function toggleUserBatchAll(checked) {
  userBatchSel.value = checked ? filteredUsers.value.map(u => u.id) : []
}
async function batchUserStatus(targetStatus) {
  if (!userBatchSel.value.length) { ElMessage.warning('请勾选用户'); return }
  try {
    await ElMessageBox.confirm(
      `将对 ${userBatchSel.value.length} 个用户执行「${targetStatus === 'active' ? '启用' : '禁用'}」`,
      '批量状态调整',
      { type: 'warning' }
    )
  } catch { return }
  userBatchSel.value.forEach(id => {
    const isAdded = store.addedUsers.find(u => u.id === id)
    if (isAdded) {
      const arr = store.addedUsers.map(u => u.id === id ? { ...u, status: targetStatus } : u)
      store.addedUsers.splice(0, store.addedUsers.length, ...arr)
    } else {
      store.setUser(id, { status: targetStatus })
    }
  })
  const n = userBatchSel.value.length
  userBatchSel.value = []
  ElMessage.success(`已批量${targetStatus === 'active' ? '启用' : '禁用'} ${n} 个用户`)
}
const assignRoleDialog = ref(false)
const assignRole = ref('核保员')
function openAssignRole() {
  if (!userBatchSel.value.length) { ElMessage.warning('请勾选用户'); return }
  assignRoleDialog.value = true
}
function submitAssignRole() {
  userBatchSel.value.forEach(id => {
    const isAdded = store.addedUsers.find(u => u.id === id)
    if (isAdded) {
      const arr = store.addedUsers.map(u => u.id === id ? { ...u, role: assignRole.value } : u)
      store.addedUsers.splice(0, store.addedUsers.length, ...arr)
    } else {
      store.setUser(id, { role: assignRole.value })
    }
  })
  const n = userBatchSel.value.length
  userBatchSel.value = []
  assignRoleDialog.value = false
  ElMessage.success(`已批量分配角色「${assignRole.value}」给 ${n} 个用户`)
}

/* ---------- 接口批量测试 ---------- */
const batchTesting = ref(false)
async function batchTestAll() {
  batchTesting.value = true
  for (const iface of interfaces.value) {
    await testInterface(iface)
  }
  batchTesting.value = false
  ElMessage.success(`已完成 ${interfaces.value.length} 个接口的批量测试`)
}

/* ---------- 接口监控历史 dialog ---------- */
const ifaceHistoryDialog = ref(false)
const ifaceHistoryName = ref('')
const ifaceHistoryEl = ref(null)
let ifaceHistoryChart = null
function openInterfaceHistory(iface) {
  ifaceHistoryName.value = iface.name
  ifaceHistoryDialog.value = true
  nextTick(() => {
    if (ifaceHistoryEl.value) {
      ifaceHistoryChart?.dispose()
      ifaceHistoryChart = echarts.init(ifaceHistoryEl.value)
      renderHistoryChart()
    }
  })
}
function renderHistoryChart() {
  if (!ifaceHistoryChart) return
  const list = (store.interfaceHistory[ifaceHistoryName.value] || []).slice().reverse()
  if (!list.length) {
    ifaceHistoryChart.setOption({
      title: { text: '尚无测试历史', left: 'center', top: 'center', textStyle: { color: '#8a93a8', fontSize: 13, fontWeight: 'normal' } }
    })
    return
  }
  ifaceHistoryChart.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 16, top: 28, bottom: 30 },
    xAxis: {
      type: 'category', data: list.map(p => dayjs(p.time).format('HH:mm:ss')),
      axisLabel: { color: '#525c75', fontSize: 11 }
    },
    yAxis: { type: 'value', name: '延迟 (ms)', splitLine: { lineStyle: { color: '#eef0f7' } } },
    series: [{
      type: 'line', smooth: true, showSymbol: true, symbolSize: 8,
      data: list.map(p => parseInt(p.latency) || 0),
      lineStyle: { color: '#015eea', width: 2.5 },
      itemStyle: { color: (p) => p.value > 200 ? '#f59e0b' : '#22d3a0' },
      areaStyle: { color: 'rgba(1,94,234,0.08)' },
      markLine: { symbol: 'none', data: [
        { yAxis: 200, label: { formatter: '阈值 200ms', color: '#ef4444' }, lineStyle: { color: '#ef4444', type: 'dashed' } }
      ]}
    }]
  })
}
watch(ifaceHistoryDialog, (v) => {
  if (!v) { ifaceHistoryChart?.dispose(); ifaceHistoryChart = null }
})

/* ---------- 日志详情抽屉 + 操作类型分布 ---------- */
const logDetailDrawer = ref(false)
const logDetail = ref(null)
function openLogDetail(log) { logDetail.value = log; logDetailDrawer.value = true }

const logActionStats = computed(() => {
  const stats = {}
  filteredLogs.value.forEach(l => { stats[l.action] = (stats[l.action] || 0) + 1 })
  return stats
})
const logActionColors = {
  '查询': '#06b6d4', '查看': '#015eea', '导出': '#f59e0b',
  '存证': '#22d3a0', '处置': '#6366f1', '通过核保': '#22d3a0', '续保提醒': '#06b6d4'
}
const logPieOption = computed(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 0, icon: 'circle', textStyle: { fontSize: 11 } },
  series: [{
    type: 'pie', radius: ['52%', '76%'],
    avoidLabelOverlap: false, label: { show: false }, labelLine: { show: false },
    data: Object.entries(logActionStats.value).map(([k, v]) => ({
      name: k, value: v, itemStyle: { color: logActionColors[k] || '#8a93a8' }
    }))
  }]
}))

/* ---------- 系统健康监控 ---------- */
const healthMetrics = reactive({
  cpu: 38, memory: 62, disk: 47,
  diskTotal: 2048, diskUsed: 968,
  uptime: 38, // days
  network: { in: 12.4, out: 8.1 }  // MB/s
})
const healthSeries = reactive({
  cpu: Array.from({ length: 30 }, () => 30 + Math.random() * 20),
  mem: Array.from({ length: 30 }, () => 55 + Math.random() * 15),
  net: Array.from({ length: 30 }, () => 8 + Math.random() * 8)
})
const healthChartEl = ref(null)
let healthChart = null
function renderHealthChart() {
  if (!healthChart) return
  const labels = Array.from({ length: 30 }, (_, i) => `-${(30-i)*2}s`)
  healthChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 0, right: 0, textStyle: { fontSize: 11 } },
    grid: { left: 40, right: 16, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#525c75', fontSize: 10, interval: 4 } },
    yAxis: { type: 'value', min: 0, max: 100, splitLine: { lineStyle: { color: '#eef0f7' } } },
    series: [
      { name: 'CPU %', type: 'line', smooth: true, showSymbol: false, data: [...healthSeries.cpu],
        lineStyle: { color: '#015eea', width: 2 }, areaStyle: { color: 'rgba(1,94,234,0.1)' } },
      { name: '内存 %', type: 'line', smooth: true, showSymbol: false, data: [...healthSeries.mem],
        lineStyle: { color: '#22d3a0', width: 2 }, areaStyle: { color: 'rgba(34,211,160,0.1)' } },
      { name: '网络 MB/s', type: 'line', smooth: true, showSymbol: false, data: [...healthSeries.net],
        lineStyle: { color: '#f59e0b', width: 2 } }
    ]
  })
}
let healthTimer = null
function startHealthMonitor() {
  stopHealthMonitor()
  healthTimer = setInterval(() => {
    healthMetrics.cpu = +(30 + Math.random() * 25).toFixed(0)
    healthMetrics.memory = +(55 + Math.random() * 18).toFixed(0)
    healthMetrics.network.in = +(10 + Math.random() * 8).toFixed(1)
    healthMetrics.network.out = +(5 + Math.random() * 7).toFixed(1)
    healthSeries.cpu.push(healthMetrics.cpu); healthSeries.cpu.shift()
    healthSeries.mem.push(healthMetrics.memory); healthSeries.mem.shift()
    healthSeries.net.push(healthMetrics.network.in); healthSeries.net.shift()
    if (activeTab.value === 'health') renderHealthChart()
  }, 2000)
}
function stopHealthMonitor() { if (healthTimer) { clearInterval(healthTimer); healthTimer = null } }

watch(activeTab, (v) => {
  if (v === 'health') {
    nextTick(() => {
      if (healthChartEl.value) {
        healthChart?.dispose()
        healthChart = echarts.init(healthChartEl.value)
        renderHealthChart()
      }
    })
  }
})

onMounted(() => startHealthMonitor())
onBeforeUnmount(() => {
  stopHealthMonitor()
  healthChart?.dispose()
  ifaceHistoryChart?.dispose()
})

/* ---------- 设置回滚 dialog ---------- */
const rollbackDialog = ref(false)
async function doRollback(id) {
  try {
    await ElMessageBox.confirm('确认回滚到该版本？当前值将被覆盖', '回滚设置', { type: 'warning' })
  } catch { return }
  store.snapshotSettings({ ...store.settings })  // 先保存当前
  const entry = store.rollbackSettings(id)
  if (entry) {
    Object.assign(settingDraft, SETTING_DEFAULTS, entry.snapshot)
    ElMessage.success(`已回滚到 ${dayjs(entry.time).format('MM-DD HH:mm')}`)
  }
  rollbackDialog.value = false
}

/* ---------- 角色权限对比 dialog ---------- */
const compareDialog = ref(false)
const compareRoles = ref([])
function openCompareRoles() {
  if (compareRoles.value.length < 2) {
    compareRoles.value = rolesWithPerms.value.slice(0, 2).map(r => r.name)
  }
  compareDialog.value = true
}
const comparedPermsTable = computed(() => {
  const sel = compareRoles.value.map(name => rolesWithPerms.value.find(r => r.name === name)).filter(Boolean)
  if (sel.length < 2) return []
  return ALL_PERMS.map(p => ({
    perm: p,
    ...Object.fromEntries(sel.map(r => [r.name, r.permissions.includes(p)]))
  }))
})
</script>

<template>
  <div class="system">
    <PageHeader
      tag="SYSTEM"
      title="系统管理"
      desc="用户 · 角色 · 权限 · 接口 · 审计日志"
    />

    <!-- 概览卡片 -->
    <div class="overview">
      <div class="ov">
        <div class="ov-icon" style="background:linear-gradient(135deg,#015eea,#1e2188)"><el-icon><User /></el-icon></div>
        <div>
          <div class="ov-l">系统用户</div>
          <div class="ov-v">{{ userStats.total }} <span>启用 {{ userStats.active }} · 禁用 {{ userStats.inactive }}</span></div>
        </div>
      </div>
      <div class="ov">
        <div class="ov-icon" style="background:linear-gradient(135deg,#22d3a0,#06b6d4)"><el-icon><Link /></el-icon></div>
        <div>
          <div class="ov-l">接口在线</div>
          <div class="ov-v">{{ interfaces.filter(i => i.status === 'online').length }} <span>/ {{ interfaces.length }} 接口</span></div>
        </div>
      </div>
      <div class="ov">
        <div class="ov-icon" style="background:linear-gradient(135deg,#6366f1,#015eea)"><el-icon><Lock /></el-icon></div>
        <div>
          <div class="ov-l">角色</div>
          <div class="ov-v">{{ rolesWithPerms.length }} <span>个角色配置</span></div>
        </div>
      </div>
      <div class="ov">
        <div class="ov-icon" style="background:linear-gradient(135deg,#f59e0b,#ef4444)"><el-icon><Document /></el-icon></div>
        <div>
          <div class="ov-l">今日审计</div>
          <div class="ov-v">{{ seedLogs.filter(l => l.time.startsWith(dayjs().format('YYYY-MM-DD'))).length }} <span>条操作</span></div>
        </div>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="tabs">
      <!-- 用户 -->
      <el-tab-pane name="users">
        <template #label>
          <span class="tab-l"><el-icon><User /></el-icon> 用户管理</span>
        </template>
        <div class="card">
          <div class="tc-head">
            <div class="tc-left">
              <div class="title">系统用户 ({{ filteredUsers.length }})</div>
              <el-input v-model="userSearch" placeholder="搜索 姓名/角色/部门" clearable :prefix-icon="Search" size="default" style="width:240px" />
            </div>
            <el-button type="primary" :icon="Plus" @click="openAddUser">新增用户</el-button>
          </div>
          <!-- 批量工具条 -->
          <div class="batch-bar" v-if="filteredUsers.length">
            <el-checkbox
              :model-value="allUsersSelected"
              :indeterminate="userBatchSel.length > 0 && !allUsersSelected"
              @change="toggleUserBatchAll"
            >全选 ({{ filteredUsers.length }})</el-checkbox>
            <span class="batch-info">已选 <b>{{ userBatchSel.length }}</b> 个</span>
            <div class="batch-actions">
              <el-button size="small" type="success" :disabled="!userBatchSel.length" @click="batchUserStatus('active')">批量启用</el-button>
              <el-button size="small" type="warning" plain :disabled="!userBatchSel.length" @click="batchUserStatus('inactive')">批量禁用</el-button>
              <el-button size="small" type="primary" plain :disabled="!userBatchSel.length" @click="openAssignRole">批量分配角色</el-button>
            </div>
          </div>
          <el-table
            :data="filteredUsers" stripe
            row-key="id"
            @selection-change="(rows) => userBatchSel = rows.map(r => r.id)"
          >
            <el-table-column type="selection" width="42" />
            <el-table-column prop="id" label="ID" width="70" />
            <el-table-column prop="name" label="姓名" width="120" />
            <el-table-column prop="role" label="角色" width="120">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.role }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="dept" label="部门" min-width="150" />
            <el-table-column prop="last" label="最近登录" width="170" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
                  {{ row.status === 'active' ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button text type="primary" :icon="Edit" @click="openEditUser(row)">编辑</el-button>
                <el-button text :type="row.status === 'active' ? 'warning' : 'primary'" @click="toggleUserActive(row)">
                  {{ row.status === 'active' ? '禁用' : '启用' }}
                </el-button>
                <el-button text type="danger" :icon="Delete" @click="deleteUser(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 角色权限 -->
      <el-tab-pane name="roles">
        <template #label>
          <span class="tab-l"><el-icon><Lock /></el-icon> 角色权限</span>
        </template>
        <div class="role-toolbar">
          <el-button :icon="DataAnalysis" @click="openCompareRoles">权限差异对比</el-button>
        </div>
        <div class="role-grid">
          <div class="role-card" v-for="r in rolesWithPerms" :key="r.name">
            <div class="rc-head">
              <div class="rc-name">{{ r.name }}</div>
              <el-tag size="small">{{ r.count }} 人</el-tag>
            </div>
            <div class="rc-perms">
              <div class="rc-perm" v-for="p in r.permissions" :key="p">· {{ p }}</div>
            </div>
            <div class="rc-actions">
              <el-tag size="small" type="info" effect="plain">{{ r.permissions.length }} 项</el-tag>
              <el-button size="small" text type="primary" :icon="Setting" @click="openEditRole(r)">配置权限</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- 接口对接 -->
      <el-tab-pane name="interfaces">
        <template #label>
          <span class="tab-l"><el-icon><Link /></el-icon> 接口对接</span>
        </template>
        <div class="card">
          <div class="tc-head">
            <div class="tc-left">
              <div class="title">接口对接状态</div>
              <el-tag type="success">{{ interfaces.filter(i => i.status === 'online').length }} / {{ interfaces.length }} 在线</el-tag>
            </div>
            <el-button type="primary" :icon="Connection" :loading="batchTesting" @click="batchTestAll">批量测试全部</el-button>
          </div>
          <el-table :data="interfaces" stripe>
            <el-table-column prop="name" label="接口名称" min-width="180" />
            <el-table-column prop="protocol" label="协议" width="120">
              <template #default="{ row }">
                <el-tag size="small" effect="plain">{{ row.protocol }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="host" label="目标地址" min-width="240">
              <template #default="{ row }">
                <code class="host">{{ row.host }}</code>
              </template>
            </el-table-column>
            <el-table-column prop="latency" label="延迟" width="100">
              <template #default="{ row }">
                <span :style="{ color: parseInt(row.latency) > 200 ? '#f59e0b' : '#22d3a0', fontWeight: 500 }">{{ row.latency }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="stations" label="覆盖站点" width="100" />
            <el-table-column label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.status === 'online' ? 'success' : 'warning'" size="small">
                  <span class="status-dot" :style="{ background: row.status === 'online' ? '#22d3a0' : '#f59e0b' }" />
                  {{ row.status === 'online' ? '在线' : '延迟高' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button text type="primary"
                  :icon="Connection"
                  :loading="testingInterface === row.name"
                  @click="testInterface(row)"
                >测试</el-button>
                <el-button text type="primary" :icon="DataAnalysis" @click="openInterfaceHistory(row)">
                  历史 ({{ (store.interfaceHistory[row.name] || []).length }})
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <!-- 审计日志 -->
      <el-tab-pane name="logs">
        <template #label>
          <span class="tab-l"><el-icon><Document /></el-icon> 审计日志</span>
        </template>
        <div class="card">
          <div class="tc-head">
            <div class="title">操作审计日志 ({{ filteredLogs.length }})</div>
            <el-button size="default" :icon="Document" @click="exportLogs">导出 CSV</el-button>
          </div>
          <div class="log-summary">
            <div class="ls-chart">
              <ChartCard title="操作类型分布" :option="logPieOption" height="180px" :key="filteredLogs.length" />
            </div>
            <div class="ls-stats">
              <div class="lst-item" v-for="(c, k) in logActionStats" :key="k">
                <span class="lst-dot" :style="{ background: logActionColors[k] || '#8a93a8' }" />
                <span class="lst-label">{{ k }}</span>
                <span class="lst-count">{{ c }}</span>
              </div>
            </div>
          </div>
          <div class="log-filters">
            <el-input v-model="logSearch" placeholder="搜索 用户/对象内容" clearable :prefix-icon="Search" size="default" style="width:240px" />
            <el-select v-model="logAction" placeholder="操作类型" clearable size="default" style="width:130px">
              <el-option label="查询" value="查询" />
              <el-option label="查看" value="查看" />
              <el-option label="导出" value="导出" />
              <el-option label="存证" value="存证" />
              <el-option label="处置" value="处置" />
              <el-option label="通过核保" value="通过核保" />
              <el-option label="续保提醒" value="续保提醒" />
            </el-select>
            <el-date-picker v-model="logDateRange" type="daterange" size="default" range-separator="-" start-placeholder="开始" end-placeholder="结束" style="width:260px" />
          </div>
          <el-table :data="filteredLogs" stripe @row-click="openLogDetail">
            <el-table-column prop="time" label="时间" width="180" />
            <el-table-column prop="user" label="用户" width="110" />
            <el-table-column prop="action" label="操作类型" width="100">
              <template #default="{ row }">
                <el-tag size="small" effect="plain"
                  :type="row.action === '导出' ? 'warning' : row.action === '存证' ? 'success' : row.action === '处置' ? 'primary' : 'info'"
                >{{ row.action }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="target" label="对象 / 内容" min-width="320" />
            <el-table-column prop="ip" label="IP 地址" width="130" />
          </el-table>
          <div class="audit-note">
            <el-icon><Lock /></el-icon>
            审计日志全程留痕、不可删除、不可篡改，保存周期 ≥ 保险期限 + 5 年
          </div>
        </div>
      </el-tab-pane>

      <!-- 平台设置 -->
      <el-tab-pane name="settings">
        <template #label>
          <span class="tab-l"><el-icon><Setting /></el-icon> 平台设置</span>
        </template>
        <div class="card setting">
          <div class="set-section">
            <div class="ss-title">数据保留策略</div>
            <div class="ss-grid">
              <div class="ss-item">
                <span>热数据保留天数</span>
                <el-input-number v-model="settingDraft.hotDays" :min="30" :max="180" :step="15" controls-position="right" />
              </div>
              <div class="ss-item">
                <span>温数据保留天数</span>
                <el-input-number v-model="settingDraft.warmDays" :min="180" :max="730" :step="30" controls-position="right" />
              </div>
              <div class="ss-item">
                <span>冷数据策略</span>
                <el-input v-model="settingDraft.coldDesc" style="width:170px" />
              </div>
              <div class="ss-item">
                <span>承保 / 理赔证据</span>
                <el-input v-model="settingDraft.evidenceYears" style="width:170px" />
              </div>
            </div>
          </div>
          <div class="set-section">
            <div class="ss-title">安全配置</div>
            <div class="ss-grid">
              <div class="ss-item">
                <span>传输加密</span>
                <el-select v-model="settingDraft.tls" style="width:170px">
                  <el-option label="TLS 1.3" value="TLS 1.3" />
                  <el-option label="TLS 1.2" value="TLS 1.2" />
                </el-select>
              </div>
              <div class="ss-item">
                <span>存储加密</span>
                <el-select v-model="settingDraft.storageEnc" style="width:170px">
                  <el-option label="AES-256" value="AES-256" />
                  <el-option label="AES-128" value="AES-128" />
                  <el-option label="SM4" value="SM4" />
                </el-select>
              </div>
              <div class="ss-item">
                <span>证据区块链存证</span>
                <el-switch v-model="settingDraft.blockchain" />
              </div>
              <div class="ss-item">
                <span>短信 2FA 登录</span>
                <el-switch v-model="settingDraft.twoFA" />
              </div>
            </div>
          </div>
          <div class="set-section">
            <div class="ss-title">服务承诺</div>
            <div class="ss-grid">
              <div class="ss-item">
                <span>平台可用性 %</span>
                <el-input-number v-model="settingDraft.uptime" :min="99" :max="100" :step="0.05" :precision="2" controls-position="right" />
              </div>
              <div class="ss-item">
                <span>接口可用性 %</span>
                <el-input-number v-model="settingDraft.ifaceUptime" :min="99" :max="100" :step="0.05" :precision="2" controls-position="right" />
              </div>
              <div class="ss-item">
                <span>故障响应 min</span>
                <el-input-number v-model="settingDraft.faultResp" :min="5" :max="120" :step="5" controls-position="right" />
              </div>
              <div class="ss-item">
                <span>技术支持</span>
                <el-input v-model="settingDraft.support" style="width:170px" />
              </div>
            </div>
          </div>
          <div class="set-actions">
            <el-button :icon="Clock" @click="rollbackDialog = true" :disabled="!store.settingsHistory.length">
              保存历史 ({{ store.settingsHistory.length }})
            </el-button>
            <el-button @click="resetSettings">恢复默认</el-button>
            <el-button type="primary" :icon="Check" @click="saveSettings">保存设置</el-button>
          </div>
        </div>
      </el-tab-pane>

      <!-- 系统健康监控 -->
      <el-tab-pane name="health">
        <template #label>
          <span class="tab-l"><el-icon><Monitor /></el-icon> 系统健康</span>
        </template>
        <div class="health-grid">
          <div class="hm-card">
            <div class="hm-l">CPU 占用</div>
            <div class="hm-v" :class="healthMetrics.cpu > 80 ? 'err' : healthMetrics.cpu > 60 ? 'warn' : ''">
              {{ healthMetrics.cpu }}<small>%</small>
            </div>
            <el-progress :percentage="healthMetrics.cpu" :status="healthMetrics.cpu > 80 ? 'exception' : healthMetrics.cpu > 60 ? 'warning' : 'success'" :show-text="false" />
          </div>
          <div class="hm-card">
            <div class="hm-l">内存占用</div>
            <div class="hm-v" :class="healthMetrics.memory > 85 ? 'err' : healthMetrics.memory > 70 ? 'warn' : ''">
              {{ healthMetrics.memory }}<small>%</small>
            </div>
            <el-progress :percentage="healthMetrics.memory" :status="healthMetrics.memory > 85 ? 'exception' : healthMetrics.memory > 70 ? 'warning' : 'success'" :show-text="false" />
          </div>
          <div class="hm-card">
            <div class="hm-l">磁盘使用</div>
            <div class="hm-v">{{ healthMetrics.disk }}<small>%</small></div>
            <div class="hm-sub">{{ healthMetrics.diskUsed }} / {{ healthMetrics.diskTotal }} GB</div>
            <el-progress :percentage="healthMetrics.disk" status="success" :show-text="false" />
          </div>
          <div class="hm-card">
            <div class="hm-l">网络吞吐</div>
            <div class="hm-v">{{ healthMetrics.network.in }}<small>MB/s ↓</small></div>
            <div class="hm-sub">↑ {{ healthMetrics.network.out }} MB/s</div>
          </div>
          <div class="hm-card">
            <div class="hm-l">运行时长</div>
            <div class="hm-v">{{ healthMetrics.uptime }}<small>天</small></div>
            <div class="hm-sub">无重启故障</div>
          </div>
          <div class="hm-card">
            <div class="hm-l">接口平均延迟</div>
            <div class="hm-v">
              {{ Math.round(interfaces.reduce((s, i) => s + parseInt(i.latency), 0) / interfaces.length) }}<small>ms</small>
            </div>
            <div class="hm-sub">{{ interfaces.filter(i => i.status === 'online').length }} / {{ interfaces.length }} 接口在线</div>
          </div>
        </div>

        <div class="card" style="margin-top:16px">
          <div class="title">实时性能监控 (60s)</div>
          <div ref="healthChartEl" style="width:100%;height:300px;margin-top:12px" />
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 用户 dialog -->
    <el-dialog v-model="userDialog" :title="editingUser ? '编辑用户' : '新增用户'" width="460">
      <el-form label-width="80px" label-position="left">
        <el-form-item label="姓名">
          <el-input v-model="userForm.name" placeholder="姓名" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="userForm.role" style="width:100%">
            <el-option v-for="r in rolesWithPerms" :key="r.name" :label="r.name" :value="r.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="userForm.dept" placeholder="所属部门" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="userForm.status">
            <el-radio value="active">启用</el-radio>
            <el-radio value="inactive">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="userDialog = false">取消</el-button>
        <el-button type="primary" @click="submitUser">{{ editingUser ? '保存' : '创建' }}</el-button>
      </template>
    </el-dialog>

    <!-- 批量分配角色 dialog -->
    <el-dialog v-model="assignRoleDialog" title="批量分配角色" width="420">
      <el-form label-width="80px">
        <el-form-item label="目标用户">
          <el-tag>{{ userBatchSel.length }} 个</el-tag>
        </el-form-item>
        <el-form-item label="分配角色">
          <el-select v-model="assignRole" style="width:100%">
            <el-option v-for="r in rolesWithPerms" :key="r.name" :label="r.name" :value="r.name" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignRoleDialog = false">取消</el-button>
        <el-button type="primary" @click="submitAssignRole">确认分配</el-button>
      </template>
    </el-dialog>

    <!-- 接口监控历史 dialog -->
    <el-dialog v-model="ifaceHistoryDialog" :title="`${ifaceHistoryName} - 监控历史`" width="640">
      <div ref="ifaceHistoryEl" style="width:100%;height:300px" />
      <div class="ih-list">
        <div class="ih-row" v-for="(p, i) in (store.interfaceHistory[ifaceHistoryName] || [])" :key="i">
          <span class="ih-time">{{ dayjs(p.time).format('MM-DD HH:mm:ss') }}</span>
          <span class="ih-latency" :style="{ color: parseInt(p.latency) > 200 ? '#f59e0b' : '#22d3a0' }">{{ p.latency }}</span>
          <el-tag size="small" :type="p.status === 'online' ? 'success' : 'warning'">{{ p.status === 'online' ? '在线' : '延迟高' }}</el-tag>
        </div>
        <div class="ih-empty" v-if="!(store.interfaceHistory[ifaceHistoryName] || []).length">
          暂无测试历史，点击"测试连接"开始记录
        </div>
      </div>
    </el-dialog>

    <!-- 日志详情抽屉 -->
    <el-drawer v-model="logDetailDrawer" title="审计日志详情" size="460" direction="rtl">
      <template v-if="logDetail">
        <div class="ld-section">
          <div class="ld-l">操作时间</div>
          <div class="ld-v mono">{{ logDetail.time }}</div>
        </div>
        <div class="ld-section">
          <div class="ld-l">操作类型</div>
          <el-tag :type="logDetail.action === '导出' ? 'warning' : logDetail.action === '存证' ? 'success' : logDetail.action === '处置' ? 'primary' : 'info'">
            {{ logDetail.action }}
          </el-tag>
        </div>
        <div class="ld-section">
          <div class="ld-l">操作用户</div>
          <div class="ld-v">{{ logDetail.user }}</div>
        </div>
        <div class="ld-section">
          <div class="ld-l">对象 / 内容</div>
          <div class="ld-v">{{ logDetail.target }}</div>
        </div>
        <div class="ld-section">
          <div class="ld-l">IP 地址</div>
          <div class="ld-v mono">{{ logDetail.ip }}</div>
        </div>
        <div class="ld-section">
          <div class="ld-l">完整信息（JSON）</div>
          <pre class="ld-payload">{{ JSON.stringify(logDetail, null, 2) }}</pre>
        </div>
      </template>
    </el-drawer>

    <!-- 设置回滚 dialog -->
    <el-dialog v-model="rollbackDialog" title="平台设置 - 历史快照" width="560">
      <div class="rb-empty" v-if="!store.settingsHistory.length">暂无历史快照</div>
      <div class="rb-list" v-else>
        <div class="rb-row" v-for="s in store.settingsHistory" :key="s.id">
          <div class="rb-info">
            <div class="rb-time">{{ dayjs(s.time).format('YYYY-MM-DD HH:mm:ss') }}</div>
            <div class="rb-by">{{ s.by }}</div>
            <div class="rb-keys">含 {{ Object.keys(s.snapshot).length }} 项设置</div>
          </div>
          <el-button size="small" type="primary" plain :icon="RefreshLeft" @click="doRollback(s.id)">回滚到此版本</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 角色对比 dialog -->
    <el-dialog v-model="compareDialog" title="角色权限差异对比" width="720">
      <div class="rc-pick">
        <el-select v-model="compareRoles" multiple :multiple-limit="3" placeholder="选 2-3 个角色" style="width:100%">
          <el-option v-for="r in rolesWithPerms" :key="r.name" :label="r.name" :value="r.name" />
        </el-select>
      </div>
      <div class="rc-table" v-if="comparedPermsTable.length && compareRoles.length >= 2">
        <div class="rt-head" :style="{ gridTemplateColumns: `2fr repeat(${compareRoles.length}, 1fr)` }">
          <div>权限</div>
          <div v-for="rn in compareRoles" :key="rn">{{ rn }}</div>
        </div>
        <div class="rt-row" v-for="p in comparedPermsTable" :key="p.perm"
          :style="{ gridTemplateColumns: `2fr repeat(${compareRoles.length}, 1fr)` }"
          :class="{ diff: compareRoles.some((r, i) => p[r] !== p[compareRoles[0]]) }"
        >
          <div class="rt-perm">{{ p.perm }}</div>
          <div v-for="rn in compareRoles" :key="rn" class="rt-cell">
            <el-icon v-if="p[rn]" style="color:#22d3a0;font-size:16px"><Check /></el-icon>
            <span v-else style="color:#c4cad8">—</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 角色权限 dialog -->
    <el-dialog v-model="roleDialog" :title="`配置权限 - ${editingRole?.name || ''}`" width="640">
      <div class="rp-tip">已选 <b>{{ roleForm.permissions.length }}</b> 项 / 共 {{ ALL_PERMS.length }} 项</div>
      <el-checkbox-group v-model="roleForm.permissions">
        <div class="rp-grid">
          <el-checkbox v-for="p in ALL_PERMS" :key="p" :value="p">{{ p }}</el-checkbox>
        </div>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="roleDialog = false">取消</el-button>
        <el-button type="primary" @click="submitRole">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.tab-l { display: inline-flex; align-items: center; gap: 6px; }
.tabs { background: $bg-card; border-radius: $radius; padding: 8px 20px 20px; box-shadow: $shadow-card; }

.overview { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
.ov {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 16px 20px; box-shadow: $shadow-card;
  display: flex; align-items: center; gap: 14px;
}
.ov-icon {
  width: 42px; height: 42px; border-radius: 10px; color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
}
.ov-l { font-size: 12px; color: $text-muted; }
.ov-v { font-size: 22px; font-weight: 600; font-family: $font-num;
  font-variant-numeric: tabular-nums lining-nums; margin-top: 2px;
  span { font-size: 11px; color: $text-muted; font-weight: 400; margin-left: 4px; }
}

.card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px;
}
.tc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
.tc-left { display: flex; align-items: center; gap: 16px; }
.title { font-size: 15px; font-weight: 600; }

.log-filters { display: flex; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }

.role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 8px 0; }
.role-card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 20px;
  transition: box-shadow 0.15s, transform 0.15s;
  &:hover { box-shadow: $shadow-card-hover; transform: translateY(-2px); }
}
.rc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid $border-soft; }
.rc-name { font-size: 15px; font-weight: 600; }
.rc-perms { min-height: 100px; }
.rc-perm { font-size: 13px; color: $text-secondary; padding: 4px 0; }
.rc-actions { margin-top: 12px; display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid $border-soft; }

.host { background: $bg-soft; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: $brand-blue; }
.status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }

.audit-note { display: flex; align-items: center; gap: 6px; margin-top: 14px; padding: 10px 14px; background: $bg-soft; border-radius: 8px; font-size: 12px; color: $text-muted; }

.setting .set-section { margin-bottom: 24px; }
.ss-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid $border-soft; }
.ss-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.ss-item {
  background: $bg-soft; padding: 12px 16px; border-radius: 8px;
  display: flex; justify-content: space-between; align-items: center; font-size: 13px;
}
.set-actions { display: flex; justify-content: flex-end; gap: 12px; padding-top: 12px; border-top: 1px solid $border-soft; }

.rp-tip { font-size: 12px; color: $text-muted; margin-bottom: 12px; b { color: $brand-blue; font-family: $font-num; } }
.rp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }

/* === 批量工具条 === */
.batch-bar {
  background: $bg-soft; border-radius: 8px;
  padding: 8px 14px; margin-bottom: 12px;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
}
.batch-info { font-size: 12px; color: $text-secondary; b { color: $brand-blue; font-family: $font-num; } }
.batch-actions { display: flex; gap: 8px; margin-left: auto; }

/* === 日志统计 === */
.log-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 14px; }
.ls-stats { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
.lst-item { display: flex; align-items: center; gap: 10px; padding: 8px 14px;
  background: $bg-soft; border-radius: 6px; font-size: 13px;
}
.lst-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.lst-label { flex: 1; }
.lst-count { font-family: $font-num; font-weight: 600; color: $brand-blue; }

/* === 健康监控 === */
.health-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; padding: 8px 0; }
.hm-card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px; box-shadow: $shadow-card;
}
.hm-l { font-size: 12px; color: $text-muted; }
.hm-v { font-size: 32px; font-weight: 600; font-family: $font-num;
  margin: 6px 0 10px; color: $brand-blue;
  small { font-size: 13px; color: $text-muted; font-weight: 400; margin-left: 4px; }
  &.warn { color: #f59e0b; }
  &.err  { color: #ef4444; }
}
.hm-sub { font-size: 11px; color: $text-muted; margin-bottom: 8px; font-family: $font-num; }

/* === 角色对比 dialog === */
.rc-pick { margin-bottom: 14px; }
.rc-table { border: 1px solid $border-soft; border-radius: 6px; overflow: hidden; }
.rt-head, .rt-row {
  display: grid; gap: 8px; align-items: center;
  padding: 8px 14px; font-size: 12px;
}
.rt-head { background: $bg-soft; color: $text-muted; font-weight: 600; }
.rt-row {
  border-bottom: 1px dashed $border-soft;
  &.diff { background: rgba(245,158,11,0.04); }
  &:last-child { border-bottom: 0; }
}
.rt-perm { font-weight: 500; }
.rt-cell { text-align: center; }

/* === 接口监控历史 === */
.ih-list { margin-top: 12px; max-height: 200px; overflow-y: auto; padding: 4px 0;
  display: flex; flex-direction: column; gap: 4px;
}
.ih-row {
  display: grid; grid-template-columns: 1fr 100px 70px; gap: 12px;
  padding: 6px 12px; font-size: 12px;
  background: $bg-soft; border-radius: 4px;
  align-items: center;
}
.ih-time { font-family: $font-num; color: $text-secondary; }
.ih-latency { font-family: $font-num; font-weight: 600; text-align: right; }
.ih-empty { padding: 24px; text-align: center; color: $text-muted; font-size: 12px; }

/* === 日志详情 drawer === */
.ld-section { margin-bottom: 18px; }
.ld-l { font-size: 11px; color: $text-muted; margin-bottom: 4px; }
.ld-v { font-size: 14px; }
.ld-payload {
  background: #10152e; color: #b3c5ff;
  padding: 12px 14px; border-radius: 6px;
  font-family: 'JetBrains Mono', Menlo, monospace; font-size: 12px; line-height: 1.7;
  margin: 6px 0 0; overflow-x: auto;
}

/* === 设置回滚 dialog === */
.rb-list { display: flex; flex-direction: column; gap: 8px; max-height: 360px; overflow-y: auto; }
.rb-row {
  background: $bg-soft; border-radius: 8px; padding: 12px 14px;
  display: flex; justify-content: space-between; align-items: center;
}
.rb-info { display: flex; flex-direction: column; gap: 2px; }
.rb-time { font-size: 13px; font-weight: 500; font-family: $font-num; }
.rb-by { font-size: 11px; color: $text-muted; }
.rb-keys { font-size: 11px; color: $text-secondary; margin-top: 2px; }
.rb-empty { padding: 32px; text-align: center; color: $text-muted; }

/* === 角色对比工具栏 === */
.role-toolbar { display: flex; justify-content: flex-end; margin-bottom: 12px; padding: 4px 0; }

@media (max-width: 1300px) {
  .health-grid { grid-template-columns: repeat(2, 1fr); }
  .log-summary { grid-template-columns: 1fr; }
}
@media (max-width: 1100px) {
  .overview, .role-grid, .ss-grid, .rp-grid { grid-template-columns: 1fr 1fr; }
}
</style>
