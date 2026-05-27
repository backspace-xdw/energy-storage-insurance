import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'esi.risk.v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch { return {} }
}

export const useRiskStore = defineStore('risk', () => {
  const saved = load()
  // disposals[alarmId] = { status, handler, note, handledAt }
  const disposals = ref(saved.disposals || {})

  function getDisposal(id) { return disposals.value[id] || null }
  function setDisposal(id, patch) {
    disposals.value = { ...disposals.value, [id]: { ...disposals.value[id], ...patch } }
  }
  function clearDisposal(id) {
    const next = { ...disposals.value }; delete next[id]
    disposals.value = next
  }

  watch(disposals, () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ disposals: disposals.value })) } catch {}
  }, { deep: true })

  return { disposals, getDisposal, setDisposal, clearDisposal }
})
