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
    const flagged = (item as any)?.__promoted === true
    if (flagged) {
      promotedItems.push(item)
      return
    }
    if (item.url && isAdvertUrl(item.url)) {
      promotedItems.push(item)
    } else {
      normalItems.push(item)
    }
  })
  
  // Tek grid: promoted önce, sonra diğerleri; başlık yok
  const sortedItems = [...promotedItems, ...normalItems]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {sortedItems.map((it, idx) => {
        const flagged = (it as any)?.__promoted === true || (it.url && isAdvertUrl(it.url))
        return (
          <CarCard
            key={`item-${idx}`}
            item={it}
            isPromoted={!!flagged}
          />
        )
      })}
    </div>
  )
}
