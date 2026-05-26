import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'esi.renewal.v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export const useRenewalStore = defineStore('renewal', () => {
  const saved = load()

  // decisions[sid] = { status, decidedAt, rateAdjust, coverage, deductible, premium, by, note }
  // status: 'pending' | 'agreed' | 'repriced' | 'declined' | 'deferred' | 'policied'
  const decisions = ref(saved.decisions || {})
  // notifications: [{ id, stationId, stationName, channel, time, by }]
  const notifications = ref(saved.notifications || [])

  function getDecision(sid) { return decisions.value[sid] || { status: 'pending' } }
  function setDecision(sid, patch) {
    decisions.value = { ...decisions.value, [sid]: { ...decisions.value[sid], ...patch } }
  }
  function clearDecision(sid) {
    const next = { ...decisions.value }
    delete next[sid]
    decisions.value = next
  }

  function pushNotification(n) {
    notifications.value = [{ id: 'N-' + Date.now(), time: new Date().toISOString(), ...n }, ...notifications.value].slice(0, 50)
  }
  function clearNotifications() { notifications.value = [] }

  watch([decisions, notifications], () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        decisions: decisions.value,
        notifications: notifications.value
      }))
    } catch {}
  }, { deep: true })

  return {
    decisions, notifications,
    getDecision, setDecision, clearDecision,
    pushNotification, clearNotifications
  }
})
