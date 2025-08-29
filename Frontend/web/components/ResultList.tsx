import CarCard from './CarCard'
import type { SearchItem } from '../types'

export default function ResultList({ items, loading }: { items: SearchItem[]; loading: boolean }) {
  if (loading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card h-56 animate-pulse" />
      ))}
    </div>
  )
  if (!items?.length) return <div className="text-gray-500">Sonuç bulunamadı.</div>
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((it, idx) => <CarCard key={idx} item={it} />)}
    </div>
  )
}
