import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

const STORAGE_KEY = 'esi.devicesPref.v1'

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export const useDevicesPrefStore = defineStore('devicesPref', () => {
  const saved = load()

  const favorites = ref(new Set(Array.isArray(saved.favorites) ? saved.favorites : []))
  const lastStationId = ref(saved.lastStationId || '')
  const lastNodeId = ref(saved.lastNodeId || '')
  const lastTab = ref(saved.lastTab || 'realtime')

  const favoriteList = computed(() => Array.from(favorites.value))
  const favoriteCount = computed(() => favorites.value.size)

  function isFavorite(id) { return favorites.value.has(id) }
  function toggleFavorite(id) {
    if (favorites.value.has(id)) favorites.value.delete(id)
    else favorites.value.add(id)
    favorites.value = new Set(favorites.value)
  }
  function clearFavorites() { favorites.value = new Set() }

  watch([favorites, lastStationId, lastNodeId, lastTab], () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        favorites: Array.from(favorites.value),
        lastStationId: lastStationId.value,
        lastNodeId: lastNodeId.value,
        lastTab: lastTab.value
      }))
    } catch {}
  }, { deep: true })

  return {
    favorites, favoriteList, favoriteCount,
    lastStationId, lastNodeId, lastTab,
    isFavorite, toggleFavorite, clearFavorites
  }
})
