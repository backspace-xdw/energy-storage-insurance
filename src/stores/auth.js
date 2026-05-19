import { defineStore } from 'pinia'

const STORAGE_KEY = 'esi_auth'

export const useAuthStore = defineStore('auth', {
  state: () => {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? JSON.parse(raw) : null
    return {
      user: saved?.user || null,
      token: saved?.token || ''
    }
  },
  getters: {
    isLoggedIn: (s) => !!s.token,
    displayName: (s) => s.user?.name || '',
    roleLabel: (s) => s.user?.roleLabel || ''
  },
  actions: {
    login({ username, password, role }) {
      const accounts = {
        admin:    { pass: 'Esi@2026', name: '系统管理员',  roleLabel: '系统管理员' },
        uwriter:  { pass: 'Esi@2026', name: '王核保',     roleLabel: '保险核保员' },
        risk:     { pass: 'Esi@2026', name: '李风控',     roleLabel: '风控专员' },
        claim:    { pass: 'Esi@2026', name: '张理赔',     roleLabel: '理赔员' },
        operator: { pass: 'Esi@2026', name: '赵运维',     roleLabel: '储能运营商' }
      }
      const acc = accounts[username]
      if (!acc) throw new Error('账号不存在')
      if (acc.pass !== password) throw new Error('密码错误')

      this.user = {
        username,
        name: acc.name,
        roleLabel: role || acc.roleLabel,
        avatar: acc.name.slice(0, 1)
      }
      this.token = 'mock-token-' + Date.now()
      this._save()
      return this.user
    },
    logout() {
      this.user = null
      this.token = ''
      localStorage.removeItem(STORAGE_KEY)
    },
    _save() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: this.user, token: this.token }))
    }
  }
})
