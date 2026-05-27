<script setup>
import { ref, computed, reactive } from 'vue'
import dayjs from 'dayjs'
import PageHeader from '@/components/PageHeader.vue'
import {
  Plus, Edit, Delete, Setting, User, Lock, Link, Document,
  Search, Check, Connection
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
  Object.keys(settingDraft).forEach(k => store.setSetting(k, settingDraft[k]))
  ElMessage.success('平台设置已保存')
}
function resetSettings() {
  Object.assign(settingDraft, SETTING_DEFAULTS)
  Object.keys(SETTING_DEFAULTS).forEach(k => store.setSetting(k, SETTING_DEFAULTS[k]))
  ElMessage.info('已恢复默认设置')
}
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
          <el-table :data="filteredUsers" stripe>
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
            <div class="title">接口对接状态</div>
            <el-tag type="success">{{ interfaces.filter(i => i.status === 'online').length }} / {{ interfaces.length }} 在线</el-tag>
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
            <el-table-column label="操作" width="160">
              <template #default="{ row }">
                <el-button text type="primary"
                  :icon="Connection"
                  :loading="testingInterface === row.name"
                  @click="testInterface(row)"
                >测试连接</el-button>
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
          <el-table :data="filteredLogs" stripe>
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
            <el-button @click="resetSettings">恢复默认</el-button>
            <el-button type="primary" :icon="Check" @click="saveSettings">保存设置</el-button>
          </div>
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

@media (max-width: 1100px) {
  .overview, .role-grid, .ss-grid, .rp-grid { grid-template-columns: 1fr 1fr; }
}
</style>
