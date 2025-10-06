interface AdvertCacheData {
  adverts: AdvertItem[]
  lastUpdated: number
}

interface AdvertItem {
  id: string
  url: string
  title: string
  price: string
  imageUrl: string
  location: string
  year: string
  km: string
  createdAt: any
  isPromoted: boolean
}

const ADVERT_CACHE_KEY = 'advert_cache'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 saat

export function getAdvertCache(): AdvertItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const cached = localStorage.getItem(ADVERT_CACHE_KEY)
    if (!cached) return []
    
    const data: AdvertCacheData = JSON.parse(cached)
    const now = Date.now()
    
    // Cache süresi dolmuş mu kontrol et
    if (now - data.lastUpdated > CACHE_DURATION) {
      clearAdvertCache()
      return []
    }
    
    return data.adverts || []
  } catch (error) {
    console.error('Advert cache okuma hatası:', error)
    return []
  }
}

export function setAdvertCache(adverts: AdvertItem[]): void {
  if (typeof window === 'undefined') return
  
  try {
    const data: AdvertCacheData = {
      adverts,
      lastUpdated: Date.now()
    }
    localStorage.setItem(ADVERT_CACHE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Advert cache yazma hatası:', error)
  }
}

export function clearAdvertCache(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(ADVERT_CACHE_KEY)
  } catch (error) {
    console.error('Advert cache temizleme hatası:', error)
  }
}

export function getLastAdvertUpdateTime(): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    const cached = localStorage.getItem(ADVERT_CACHE_KEY)
    if (!cached) return null
    
    const data: AdvertCacheData = JSON.parse(cached)
    return new Date(data.lastUpdated).toLocaleString('tr-TR')
  } catch (error) {
    console.error('Advert cache zaman okuma hatası:', error)
    return null
  }
}
