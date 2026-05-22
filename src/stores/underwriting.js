import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'esi.underwriting.v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export const useUnderwritingStore = defineStore('underwriting', () => {
  const saved = load()

  // decisions: { [stationId]: { status, approvedAt, rate, coverage, deductible, premium, by } }
  // status: 'pending' | 'approved' | 'rejected' | 'policied'
  const decisions = ref(saved.decisions || {})

  function getDecision(sid) {
    return decisions.value[sid] || { status: 'pending' }
  }

  function setDecision(sid, patch) {
    decisions.value = { ...decisions.value, [sid]: { ...decisions.value[sid], ...patch } }
  }

  function clearDecision(sid) {
    const next = { ...decisions.value }
    delete next[sid]
    decisions.value = next
  }

  watch(decisions, () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ decisions: decisions.value })) } catch {}
  }, { deep: true })

  return { decisions, getDecision, setDecision, clearDecision }
})
