import CarCard from './CarCard'
import { useAdverts } from '../contexts/AdvertsContext'
import type { SearchItem } from '../types'

export default function ResultList({ items, loading }: { items: SearchItem[]; loading: boolean }) {
  const { isAdvertUrl } = useAdverts()
  
  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card h-56 animate-pulse" />
      ))}
    </div>
  )
  
  if (!items?.length) return <div className="text-gray-500">Sonuç bulunamadı.</div>
  
  // Öne çıkan ilanları ve normal ilanları ayır
  const promotedItems: SearchItem[] = []
  const normalItems: SearchItem[] = []
  
  items.forEach((item) => {
    if (item.url && isAdvertUrl(item.url)) {
      promotedItems.push(item)
    } else {
      normalItems.push(item)
    }
  })
  
  // Önce öne çıkan ilanları, sonra normal ilanları göster
  const sortedItems = [...promotedItems, ...normalItems]
  
  return (
    <div className="space-y-6">
      {/* Öne Çıkan İlanlar */}
      {promotedItems.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
            Fırsat Araçları
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {promotedItems.map((it, idx) => (
              <CarCard 
                key={`promoted-${idx}`} 
                item={it} 
                isPromoted={true}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Normal İlanlar */}
      {normalItems.length > 0 && (
        <div>
          {promotedItems.length > 0 && (
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Diğer İlanlar
            </h3>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {normalItems.map((it, idx) => (
              <CarCard 
                key={`normal-${idx}`} 
                item={it} 
                isPromoted={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
