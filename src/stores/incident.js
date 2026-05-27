import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'esi.incident.v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch { return {} }
}

export const useIncidentStore = defineStore('incident', () => {
  const saved = load()

  // 用户审批/界定状态：每个 id -> { status, responsibility, ratio, note, conclusion, decidedAt, by, claim }
  // status: 'pending' | 'tracing' | 'traced' | 'closed' | 'claimed'
  const decisions = ref(saved.decisions || {})
  // 用户手动创建的事故（持久化追加到列表）
  const userIncidents = ref(saved.userIncidents || [])

  function getDecision(id) { return decisions.value[id] || { status: 'pending' } }
  function setDecision(id, patch) {
    decisions.value = { ...decisions.value, [id]: { ...decisions.value[id], ...patch } }
  }
  function clearDecision(id) {
    const next = { ...decisions.value }; delete next[id]
    decisions.value = next
  }
  function addIncident(inc) {
    userIncidents.value = [inc, ...userIncidents.value]
  }
  function removeUserIncident(id) {
    userIncidents.value = userIncidents.value.filter(i => i.id !== id)
  }

  watch([decisions, userIncidents], () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        decisions: decisions.value,
        userIncidents: userIncidents.value
      }))
    } catch {}
  }, { deep: true })

  return {
    decisions, userIncidents,
    getDecision, setDecision, clearDecision,
    addIncident, removeUserIncident
  }
})
