<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Odometer, Box, Lock, DataAnalysis, Refresh, Warning, Bell, Setting,
  Bell as BellIcon, ArrowDown, HomeFilled, SwitchButton, UserFilled,
  VideoCamera, Connection, Lightning, VideoPlay, MagicStick,
  Search, Expand, Fold
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { ElMessageBox, ElMessage } from 'element-plus'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const menuItems = [
  { path: '/app/dashboard', title: '平台总览', icon: Odometer },
  { path: '/app/realtime', title: '实时监控', icon: VideoCamera },
  { path: '/app/pcs', title: 'PCS 变流器', icon: Lightning },
  { path: '/app/replay', title: '数据回放', icon: VideoPlay },
  { path: '/app/ingest', title: '数据采集网关', icon: Connection },
  { path: '/app/rules', title: '告警规则引擎', icon: MagicStick },
  { path: '/app/devices', title: '承保设备管理', icon: Box },
  { path: '/app/evidence', title: '承保证据固化', icon: Lock },
  { path: '/app/underwriting', title: '自主核保', icon: DataAnalysis },
  { path: '/app/renewal', title: '智能续保', icon: Refresh },
  { path: '/app/incident', title: '事故溯源', icon: Warning },
  { path: '/app/risk', title: '风险监测', icon: Bell },
  { path: '/app/system', title: '系统管理', icon: Setting }
]

const collapsed = ref(false)
const activeMenu = computed(() => route.path)
const currentTitle = computed(
  () => menuItems.find((m) => m.path === route.path)?.title || '平台'
)

const goHome = () => router.push('/app/dashboard')

async function handleLogout() {
  try {
    await ElMessageBox.confirm('确认退出当前账号？', '退出登录', {
      confirmButtonText: '退出',
      cancelButtonText: '取消',
      type: 'warning'
    })
    auth.logout()
    ElMessage.success('已退出登录')
    router.push('/login')
  } catch {}
}
</script>

<template>
  <div class="console">
    <aside class="sidebar" :class="{ collapsed }">
      <div class="brand" @click="goHome">
        <div class="brand-logo">
          <span>储</span>
        </div>
        <div class="brand-text" v-show="!collapsed">
          <div class="brand-title">储能保险数据平台</div>
          <div class="brand-sub">Energy Storage Insurance</div>
        </div>
      </div>
      <el-menu
        :default-active="activeMenu"
        class="el-menu-vertical"
        background-color="transparent"
        text-color="rgba(255,255,255,0.78)"
        active-text-color="#ffffff"
        :collapse="collapsed"
        router
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>
      <div class="sidebar-footer" v-show="!collapsed">
        <div class="status-dot" />
        <span>全部接口运行中</span>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <div class="topbar-left">
          <el-button
            text
            class="collapse-btn"
            @click="collapsed = !collapsed"
            :icon="collapsed ? Expand : Fold"
          />
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/app/dashboard' }">
              <el-icon><HomeFilled /></el-icon>
              工作台
            </el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="topbar-right">
          <el-input
            placeholder="搜索站点 / 设备 / 报告"
            class="search"
            clearable
            :prefix-icon="Search"
          />
          <el-badge :value="6" class="badge">
            <el-button text :icon="BellIcon" />
          </el-badge>
          <el-dropdown>
            <span class="user">
              <el-avatar :size="32" style="background:linear-gradient(135deg,#06b6d4,#015eea);font-size:13px;font-weight:600;color:#fff">{{ auth.user?.avatar || '用' }}</el-avatar>
              <div class="user-meta">
                <span class="user-name">{{ auth.displayName || '未登录' }}</span>
                <span class="user-role">{{ auth.roleLabel }}</span>
              </div>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :icon="UserFilled">个人中心</el-dropdown-item>
                <el-dropdown-item :icon="Setting">账号设置</el-dropdown-item>
                <el-dropdown-item divided :icon="SwitchButton" @click="handleLogout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.console {
  display: flex;
  min-height: 100vh;
  background: $bg-page;
}

.sidebar {
  width: 240px;
  background: linear-gradient(180deg, $nav-bg 0%, #0a0f24 100%);
  color: $text-on-dark;
  display: flex;
  flex-direction: column;
  transition: width 0.25s;
  position: relative;
  box-shadow: 4px 0 24px rgba(0, 0, 0, 0.05);
  &.collapsed {
    width: 72px;
    .brand-text { display: none; }
  }
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 22px 20px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}
.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: $grad-cyan;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 18px;
  color: #fff;
  flex-shrink: 0;
}
.brand-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
.brand-sub {
  font-size: 11px;
  color: $text-on-dark-soft;
  margin-top: 2px;
  letter-spacing: 0.5px;
}

:deep(.el-menu) {
  padding: 12px 10px;
  border: none;
}
:deep(.el-menu-item) {
  height: 44px;
  line-height: 44px;
  border-radius: 8px;
  margin-bottom: 4px;
  padding-left: 14px !important;
  &:hover {
    background: rgba(255, 255, 255, 0.06) !important;
  }
  &.is-active {
    background: $grad-cyan !important;
    color: #fff !important;
    box-shadow: 0 4px 14px rgba(1, 94, 234, 0.35);
    .el-icon { color: #fff; }
  }
}

.sidebar-footer {
  margin-top: auto;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: $text-on-dark-soft;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.status-dot {
  width: 8px;
  height: 8px;
  background: #22d3a0;
  border-radius: 50%;
  box-shadow: 0 0 0 4px rgba(34, 211, 160, 0.18);
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.topbar {
  height: 64px;
  background: $bg-card;
  padding: 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid $border-soft;
  position: sticky;
  top: 0;
  z-index: 10;
}
.topbar-left { display: flex; align-items: center; gap: 16px; flex-shrink: 0; white-space: nowrap; }
.topbar-left :deep(.el-breadcrumb) { white-space: nowrap; }
.topbar-left :deep(.el-breadcrumb__inner) { white-space: nowrap; }
.collapse-btn { font-size: 18px; }
.topbar-right { display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1; justify-content: flex-end; }
.search { min-width: 0; flex: 0 1 280px; }
.search :deep(.el-input__wrapper) {
  border-radius: 20px;
  background: $bg-soft;
  box-shadow: none;
}
.user {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 20px;
  &:hover { background: $bg-soft; }
}
.user-meta { display: flex; flex-direction: column; line-height: 1.2; }
.user-name { font-size: 13px; color: $text-primary; white-space: nowrap; font-weight: 500; }
.user-role { font-size: 11px; color: $text-muted; white-space: nowrap; }

.content {
  flex: 1;
  padding: 24px 28px;
  overflow: auto;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
