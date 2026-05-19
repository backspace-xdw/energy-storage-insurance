import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/', redirect: '/login' },
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/Index.vue'),
    meta: { title: '登录', public: true }
  },
  {
    path: '/app',
    component: () => import('@/layouts/ConsoleLayout.vue'),
    redirect: '/app/dashboard',
    children: [
      { path: 'dashboard',    name: 'Dashboard',    component: () => import('@/views/dashboard/Index.vue'),    meta: { title: '平台总览' } },
      { path: 'realtime',     name: 'Realtime',     component: () => import('@/views/realtime/Index.vue'),     meta: { title: '实时监控' } },
      { path: 'pcs',          name: 'PCS',          component: () => import('@/views/pcs/Index.vue'),          meta: { title: 'PCS 变流器' } },
      { path: 'replay',       name: 'Replay',       component: () => import('@/views/replay/Index.vue'),       meta: { title: '数据回放' } },
      { path: 'ingest',       name: 'Ingest',       component: () => import('@/views/ingest/Index.vue'),       meta: { title: '数据采集网关' } },
      { path: 'rules',        name: 'Rules',        component: () => import('@/views/rules/Index.vue'),        meta: { title: '告警规则引擎' } },
      { path: 'devices',      name: 'Devices',      component: () => import('@/views/devices/Index.vue'),      meta: { title: '承保设备管理' } },
      { path: 'evidence',     name: 'Evidence',     component: () => import('@/views/evidence/Index.vue'),     meta: { title: '承保证据固化' } },
      { path: 'underwriting', name: 'Underwriting', component: () => import('@/views/underwriting/Index.vue'), meta: { title: '自主核保' } },
      { path: 'renewal',      name: 'Renewal',      component: () => import('@/views/renewal/Index.vue'),      meta: { title: '智能续保' } },
      { path: 'incident',     name: 'Incident',     component: () => import('@/views/incident/Index.vue'),     meta: { title: '事故溯源' } },
      { path: 'risk',         name: 'Risk',         component: () => import('@/views/risk/Index.vue'),         meta: { title: '风险监测' } },
      { path: 'system',       name: 'System',       component: () => import('@/views/system/Index.vue'),       meta: { title: '系统管理' } }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const auth = useAuthStore()
  if (!to.meta?.public && !auth.isLoggedIn) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/login' && auth.isLoggedIn) {
    return { path: '/app/dashboard' }
  }
})

router.afterEach((to) => {
  if (to.meta?.title) {
    document.title = `${to.meta.title} | 储能保险承保运营数据管理与分析平台`
  }
})

export default router
