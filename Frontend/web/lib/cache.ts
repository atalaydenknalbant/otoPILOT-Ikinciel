// Cache utility functions for favorites
export interface CachedFavorites {
  data: any[]
  lastUpdated: string
  version: string
}

const CACHE_KEY = 'favorites_cache'
const CACHE_VERSION = '1.0.0'
export const getCachedFavorites = (): CachedFavorites | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const parsed: CachedFavorites = JSON.parse(cached)
    return parsed
  } catch (error) {
    console.error('Cache okuma hatası:', error)
    return null
  }
}

export const setCachedFavorites = (data: any[]): void => {
  try {
    const cacheData: CachedFavorites = {
      data,
      lastUpdated: new Date().toISOString(),
      version: CACHE_VERSION
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
  } catch (error) {
    console.error('Cache yazma hatası:', error)
  }
}

export const clearCachedFavorites = (): void => {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch (error) {
    console.error('Cache temizleme hatası:', error)
  }
}

export const getLastUpdated = (): string | null => {
  const cached = getCachedFavorites()
  if (!cached) return null
  
  const date = new Date(cached.lastUpdated)
  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
