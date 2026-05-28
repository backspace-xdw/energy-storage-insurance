import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'esi.system.v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch { return {} }
}

export const useSystemStore = defineStore('system', () => {
  const saved = load()

  // userOverrides[id] = { status, role, dept, name } 覆盖 mock
  const userOverrides = ref(saved.userOverrides || {})
  // addedUsers: [{ id, name, role, dept, status, last }]
  const addedUsers = ref(saved.addedUsers || [])
  // removedUserIds: number[]
  const removedUserIds = ref(saved.removedUserIds || [])

  // rolePerms[name] = string[]
  const rolePerms = ref(saved.rolePerms || {})

  // interfaceStatus[name] = { status, latency, testedAt }
  const interfaceStatus = ref(saved.interfaceStatus || {})
  // interfaceHistory[name] = [{ time, latency, status }] (最近 20 条)
  const interfaceHistory = ref(saved.interfaceHistory || {})

  // settings overrides
  const settings = ref(saved.settings || {})
  // settingsHistory: [{ time, snapshot: {...}, by }] 最近 10 条
  const settingsHistory = ref(saved.settingsHistory || [])

  function setUser(id, patch) {
    userOverrides.value = { ...userOverrides.value, [id]: { ...userOverrides.value[id], ...patch } }
  }
  function addUser(u) { addedUsers.value = [u, ...addedUsers.value] }
  function removeUser(id) {
    addedUsers.value = addedUsers.value.filter(u => u.id !== id)
    removedUserIds.value = [...removedUserIds.value, id]
  }
  function setRolePerms(name, perms) { rolePerms.value = { ...rolePerms.value, [name]: perms } }
  function setInterfaceStatus(name, patch) {
    interfaceStatus.value = { ...interfaceStatus.value, [name]: { ...interfaceStatus.value[name], ...patch } }
    // 同时写入历史（保留最近 20 条）
    const list = interfaceHistory.value[name] || []
    const next = [{ time: patch.testedAt, latency: patch.latency, status: patch.status }, ...list].slice(0, 20)
    interfaceHistory.value = { ...interfaceHistory.value, [name]: next }
  }
  function setSetting(key, value) { settings.value = { ...settings.value, [key]: value } }
  function snapshotSettings(snapshot, by = '当前用户') {
    const entry = {
      id: 'S-' + Date.now(),
      time: new Date().toISOString(),
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      by
    }
    settingsHistory.value = [entry, ...settingsHistory.value].slice(0, 10)
  }
  function rollbackSettings(id) {
    const entry = settingsHistory.value.find(s => s.id === id)
    if (!entry) return null
    settings.value = { ...entry.snapshot }
    return entry
  }

  watch([userOverrides, addedUsers, removedUserIds, rolePerms, interfaceStatus, interfaceHistory, settings, settingsHistory], () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        userOverrides: userOverrides.value,
        addedUsers: addedUsers.value,
        removedUserIds: removedUserIds.value,
        rolePerms: rolePerms.value,
        interfaceStatus: interfaceStatus.value,
        interfaceHistory: interfaceHistory.value,
        settings: settings.value,
        settingsHistory: settingsHistory.value
      }))
    } catch {}
  }, { deep: true })

  return {
    userOverrides, addedUsers, removedUserIds, rolePerms, interfaceStatus, interfaceHistory,
    settings, settingsHistory,
    setUser, addUser, removeUser, setRolePerms, setInterfaceStatus, setSetting,
    snapshotSettings, rollbackSettings
  }
})
