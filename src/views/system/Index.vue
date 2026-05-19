<script setup>
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import { Plus, Edit, Delete, Setting, User, Lock, Link, Document } from '@element-plus/icons-vue'

const activeTab = ref('users')

const users = [
  { id: 1, name: '王核保', role: '核保员', dept: '财险一部', last: '2026-05-18 09:12', status: 'active' },
  { id: 2, name: '李风控', role: '风控员', dept: '风控管理部', last: '2026-05-18 08:45', status: 'active' },
  { id: 3, name: '张理赔', role: '理赔员', dept: '理赔中心', last: '2026-05-17 17:28', status: 'active' },
  { id: 4, name: '赵运维', role: '运营商', dept: '常熟储能站', last: '2026-05-18 10:02', status: 'active' },
  { id: 5, name: '陈审计', role: '审计员', dept: '合规部', last: '2026-05-15 14:31', status: 'inactive' }
]

const roles = [
  { name: '核保员', permissions: ['承保设备查看', '核保决策', '生成核保报告'], count: 14 },
  { name: '续保员', permissions: ['续保查看', '续保策略生成', '推送续保提醒'], count: 8 },
  { name: '理赔员', permissions: ['事故溯源', '理赔证据查看', '生成理赔报告'], count: 12 },
  { name: '风控员', permissions: ['全量数据查看', '风险评分', '风险预警'], count: 6 },
  { name: '运营商', permissions: ['本站设备查看', '告警处置', '巡检记录'], count: 38 },
  { name: '审计员', permissions: ['全量审计日志', '操作回溯', '只读'], count: 3 },
  { name: '系统管理员', permissions: ['全部权限'], count: 2 }
]

const interfaces = [
  { name: 'BMS 电池管理接口', protocol: 'MQTT / HTTP', host: 'bms.cs-station01.local', status: 'online', latency: '32 ms', stations: 6 },
  { name: '消防监控接口', protocol: 'OPC UA', host: 'opcua://fire.station-cluster:4840', status: 'online', latency: '48 ms', stations: 6 },
  { name: '运维管理接口', protocol: 'REST API', host: 'https://ops.platform.com/api', status: 'online', latency: '124 ms', stations: 5 },
  { name: '视频云接口', protocol: 'WebService', host: 'video.cs-cloud.com', status: 'online', latency: '86 ms', stations: 6 },
  { name: '站控/EMS 接口', protocol: 'DB-View', host: 'mysql://ems-replica:3306', status: 'online', latency: '12 ms', stations: 6 },
  { name: '保险业务系统对接', protocol: 'REST API', host: 'https://insurance-core.com/v2', status: 'online', latency: '156 ms', stations: 6 },
  { name: '环境监测接口', protocol: 'MQTT', host: 'env.iot.platform:1883', status: 'warning', latency: '328 ms', stations: 4 }
]

const logs = [
  { time: '2026-05-18 10:14:23', user: '王核保', action: '导出', target: '核保评估报告 / 常熟新材料园储能站', ip: '10.42.18.7' },
  { time: '2026-05-18 09:58:01', user: '李风控', action: '查询', target: '风险监测 / 告警明细', ip: '10.42.18.12' },
  { time: '2026-05-18 09:32:18', user: 'system', action: '存证', target: '承保证据 EV30041 / 上链 #1827532', ip: '127.0.0.1' },
  { time: '2026-05-18 09:11:04', user: '张理赔', action: '查看', target: '事故溯源 INC-2026-007', ip: '10.42.18.21' },
  { time: '2026-05-18 08:46:22', user: '赵运维', action: '处置', target: '告警 AL20003 / 已恢复', ip: '60.205.x.x' },
  { time: '2026-05-17 22:00:01', user: 'system', action: '续保提醒', target: 'JT-2026-10003 / T-7天', ip: '127.0.0.1' }
]
</script>

<template>
  <div class="system">
    <PageHeader
      tag="SYSTEM"
      title="系统管理"
      desc="用户 · 角色 · 权限 · 接口 · 审计日志"
    />

    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane name="users">
        <template #label>
          <span class="tab-l"><el-icon><User /></el-icon> 用户管理</span>
        </template>
        <div class="card">
          <div class="tc-head">
            <div class="title">系统用户</div>
            <el-button type="primary" :icon="Plus">新增用户</el-button>
          </div>
          <el-table :data="users" stripe>
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
            <el-table-column label="操作" width="160">
              <template #default>
                <el-button text type="primary" :icon="Edit">编辑</el-button>
                <el-button text type="primary" :icon="Delete">禁用</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane name="roles">
        <template #label>
          <span class="tab-l"><el-icon><Lock /></el-icon> 角色权限</span>
        </template>
        <div class="role-grid">
          <div class="role-card" v-for="r in roles" :key="r.name">
            <div class="rc-head">
              <div class="rc-name">{{ r.name }}</div>
              <el-tag size="small">{{ r.count }} 人</el-tag>
            </div>
            <div class="rc-perms">
              <div class="rc-perm" v-for="p in r.permissions" :key="p">· {{ p }}</div>
            </div>
            <div class="rc-actions">
              <el-button size="small" text type="primary">配置权限</el-button>
            </div>
          </div>
        </div>
      </el-tab-pane>

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
                <span :style="{ color: parseInt(row.latency) > 200 ? '#f59e0b' : '#22d3a0' }">{{ row.latency }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="stations" label="覆盖站点" width="100" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="row.status === 'online' ? 'success' : 'warning'" size="small">
                  <span class="status-dot" :style="{ background: row.status === 'online' ? '#22d3a0' : '#f59e0b' }" />
                  {{ row.status === 'online' ? '在线' : '延迟高' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160">
              <template #default>
                <el-button text type="primary">测试连接</el-button>
                <el-button text type="primary">配置</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>

      <el-tab-pane name="logs">
        <template #label>
          <span class="tab-l"><el-icon><Document /></el-icon> 审计日志</span>
        </template>
        <div class="card">
          <div class="tc-head">
            <div class="title">操作审计日志</div>
            <div style="display:flex;gap:12px">
              <el-date-picker type="daterange" size="small" />
              <el-button size="small">导出</el-button>
            </div>
          </div>
          <el-table :data="logs" stripe>
            <el-table-column prop="time" label="时间" width="180" />
            <el-table-column prop="user" label="用户" width="110" />
            <el-table-column prop="action" label="操作类型" width="100">
              <template #default="{ row }">
                <el-tag size="small" effect="plain"
                  :type="row.action === '导出' ? 'warning' : row.action === '存证' ? 'success' : ''"
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

      <el-tab-pane name="settings">
        <template #label>
          <span class="tab-l"><el-icon><Setting /></el-icon> 平台设置</span>
        </template>
        <div class="card setting">
          <div class="set-section">
            <div class="ss-title">数据保留策略</div>
            <div class="ss-grid">
              <div class="ss-item"><span>热数据（高速查询）</span><b>近 3 个月</b></div>
              <div class="ss-item"><span>温数据（常规存储）</span><b>近 1 年</b></div>
              <div class="ss-item"><span>冷数据（压缩归档）</span><b>1 年以上</b></div>
              <div class="ss-item"><span>承保 / 理赔证据</span><b>保险期 + 5 年</b></div>
            </div>
          </div>
          <div class="set-section">
            <div class="ss-title">安全配置</div>
            <div class="ss-grid">
              <div class="ss-item"><span>传输加密</span><b>TLS 1.3</b></div>
              <div class="ss-item"><span>存储加密</span><b>AES-256</b></div>
              <div class="ss-item"><span>证据存证</span><b>区块链 ✓</b></div>
              <div class="ss-item"><span>登录方式</span><b>密码 + 短信 2FA</b></div>
            </div>
          </div>
          <div class="set-section">
            <div class="ss-title">服务承诺</div>
            <div class="ss-grid">
              <div class="ss-item"><span>平台可用性</span><b>≥ 99.9%</b></div>
              <div class="ss-item"><span>接口可用性</span><b>≥ 99.5%</b></div>
              <div class="ss-item"><span>故障响应</span><b>≤ 30 min</b></div>
              <div class="ss-item"><span>技术支持</span><b>7×24 小时</b></div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.tab-l { display: inline-flex; align-items: center; gap: 6px; }
.tabs { background: $bg-card; border-radius: $radius; padding: 8px 20px 20px; box-shadow: $shadow-card; }

.card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 18px 20px;
}
.tc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.title { font-size: 15px; font-weight: 600; }

.role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 8px 0; }
.role-card {
  background: $bg-card; border: 1px solid $border-soft;
  border-radius: $radius; padding: 20px;
  &:hover { box-shadow: $shadow-card-hover; }
}
.rc-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding-bottom: 12px; border-bottom: 1px solid $border-soft; }
.rc-name { font-size: 15px; font-weight: 600; }
.rc-perm { font-size: 13px; color: $text-secondary; padding: 4px 0; }
.rc-actions { margin-top: 12px; text-align: right; }

.host { background: $bg-soft; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
.status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }

.audit-note { display: flex; align-items: center; gap: 6px; margin-top: 14px; padding: 10px 14px; background: $bg-soft; border-radius: 8px; font-size: 12px; color: $text-muted; }

.setting .set-section { margin-bottom: 24px; }
.ss-title { font-size: 14px; font-weight: 600; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid $border-soft; }
.ss-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.ss-item { background: $bg-soft; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; font-size: 13px; }
.ss-item b { color: $brand-blue; }

@media (max-width: 1100px) {
  .role-grid, .ss-grid { grid-template-columns: 1fr; }
}
</style>
