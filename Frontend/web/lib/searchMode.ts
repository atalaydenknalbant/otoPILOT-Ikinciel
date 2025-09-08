// Arama modu için localStorage utility fonksiyonları

const SEARCH_MODE_KEY = 'search_mode'

export type SearchMode = 'manual' | 'ai'

export const getSearchMode = (): SearchMode => {
  // Server-side rendering sırasında localStorage'a erişim yok
  if (typeof window === 'undefined') {
    return 'manual'
  }
  
  try {
    const saved = localStorage.getItem(SEARCH_MODE_KEY)
    return (saved as SearchMode) || 'manual'
  } catch (error) {
    console.error('Search mode okuma hatası:', error)
    return 'manual'
  }
}

export const setSearchMode = (mode: SearchMode): void => {
  try {
    localStorage.setItem(SEARCH_MODE_KEY, mode)
  } catch (error) {
    console.error('Search mode yazma hatası:', error)
  }
}

export const clearSearchMode = (): void => {
  try {
    localStorage.removeItem(SEARCH_MODE_KEY)
  } catch (error) {
    console.error('Search mode temizleme hatası:', error)
  }
}
