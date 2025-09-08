// Arama sonuçları ve filtreler için cache utility fonksiyonları

import type { SearchItem, Parsed } from './types'

interface SearchCache {
  items: SearchItem[]
  parsed: Parsed
  timestamp: number
  version: string
}

const SEARCH_CACHE_KEY_AI = 'search_cache_ai'
const SEARCH_CACHE_KEY_MANUAL = 'search_cache_manual'
const CACHE_VERSION = '1.0.0'

export const getSearchCache = (isAiMode: boolean = false): SearchCache | null => {
  if (typeof window === 'undefined') {
    return null
  }
  
  try {
    const cacheKey = isAiMode ? SEARCH_CACHE_KEY_AI : SEARCH_CACHE_KEY_MANUAL
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null

    const parsed: SearchCache = JSON.parse(cached)
    
    // Cache süresi kontrolü (24 saat - site içi gezinme için)
    const isExpired = Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000
    if (isExpired) {
      clearSearchCache(isAiMode)
      return null
    }
    
    return parsed
  } catch (error) {
    console.error('Search cache okuma hatası:', error)
    return null
  }
}

export const setSearchCache = (items: SearchItem[], parsed: Parsed, isAiMode: boolean = false): void => {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const cacheKey = isAiMode ? SEARCH_CACHE_KEY_AI : SEARCH_CACHE_KEY_MANUAL
    const cacheData: SearchCache = {
      items,
      parsed,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  } catch (error) {
    console.error('Search cache yazma hatası:', error)
  }
}

export const clearSearchCache = (isAiMode: boolean = false): void => {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const cacheKey = isAiMode ? SEARCH_CACHE_KEY_AI : SEARCH_CACHE_KEY_MANUAL
    localStorage.removeItem(cacheKey)
  } catch (error) {
    console.error('Search cache temizleme hatası:', error)
  }
}

export const getLastSearchTime = (isAiMode: boolean = false): string | null => {
  if (typeof window === 'undefined') {
    return null
  }
  
  try {
    const cacheKey = isAiMode ? SEARCH_CACHE_KEY_AI : SEARCH_CACHE_KEY_MANUAL
    const cached = localStorage.getItem(cacheKey)
    if (!cached) return null
    
    const parsed: SearchCache = JSON.parse(cached)
    return new Date(parsed.timestamp).toLocaleString('tr-TR')
  } catch (error) {
    console.error('Son arama zamanı okuma hatası:', error)
    return null
  }
}

// Cache cleanup'ı kaldırıldı - cache kalıcı olsun
export const setupCacheCleanup = (): void => {
  // Cache artık kalıcı - sayfa değişimlerinde korunur
  return
}
