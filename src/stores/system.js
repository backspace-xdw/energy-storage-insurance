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

  // settings overrides
  const settings = ref(saved.settings || {})

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
  }
  function setSetting(key, value) { settings.value = { ...settings.value, [key]: value } }

  watch([userOverrides, addedUsers, removedUserIds, rolePerms, interfaceStatus, settings], () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        userOverrides: userOverrides.value,
        addedUsers: addedUsers.value,
        removedUserIds: removedUserIds.value,
        rolePerms: rolePerms.value,
        interfaceStatus: interfaceStatus.value,
        settings: settings.value
      }))
    } catch {}
  }, { deep: true })

  return {
    userOverrides, addedUsers, removedUserIds, rolePerms, interfaceStatus, settings,
    setUser, addUser, removeUser, setRolePerms, setInterfaceStatus, setSetting
  }
})
