import type { SearchItem } from '../types'

export default function CarCard({ item }: { item: SearchItem }) {
  const {
    imageUrl,
    url,
    title,
    model,
    year,
    km,
    location,
    price,
    date,
    source,
  } = item || {}

  return (
    <article className="card overflow-hidden">
      {imageUrl ? (
        <div className="relative h-44 w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={title || model || 'car'} className="object-cover w-full h-full" />
        </div>
      ) : (
        <div className="h-44 bg-gray-100" />
      )}
      <div className="p-4">
        <a href={url || '#'} target="_blank" rel="noreferrer" className="font-semibold hover:underline line-clamp-2">
          {title || model || 'İlan'}
        </a>
        <div className="mt-1 text-sm text-gray-600">
          {[year && `${year}`, km && `${km} km`, location].filter(Boolean).join(' • ')}
        </div>
        <div className="mt-2 font-bold text-brand-700">{price || '—'}</div>
        <div className="mt-1 text-xs text-gray-500">{date} {source ? `• ${source}` : ''}</div>
      </div>
    </article>
  )
}
