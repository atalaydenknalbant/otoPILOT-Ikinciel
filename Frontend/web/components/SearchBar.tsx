"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { parseWithLocalModel, scrapeSearch } from '../lib/api'

export default function SearchBar({
  aiMode,
  onModeChange,
  onResults,
  onLoading,
  onParsed,
  modelReady,
  onModelReady,
}: {
  aiMode: boolean
  onModeChange: (b: boolean) => void
  onResults: (items: any[]) => void
  onLoading: (b: boolean) => void
  onParsed?: (json: any) => void
  modelReady: boolean
  onModelReady: (b: boolean) => void
}) {
  const [q, setQ] = useState(
    `boyasız, 2020'den yeni, 3.000.000 TL altındaki maksimum 100000 km beyaz veya siyah renkli bmw 3 serisi otomatik vitesli arabaları bul., en yeni ilana göre sırala`
  )
  const debounced = useDebounce(q, 400)

  useEffect(() => {
    if (!aiMode) return
    if (!debounced.trim()) return
    let cancelled = false
    ;(async () => {
      onLoading(true)
      try {
        const parsed = await parseWithLocalModel(debounced)
        if (!cancelled) onParsed?.(parsed)
        const items = await scrapeSearch(parsed)
        if (!cancelled) onResults(items)
        if (!cancelled) onModelReady(true)
      } finally {
        if (!cancelled) onLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [debounced, aiMode])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onLoading(true)
    try {
      if (aiMode) {
        const parsed = await parseWithLocalModel(q)
        onParsed?.(parsed)
        const items = await scrapeSearch(parsed)
        onResults(items)
        onModelReady(true)
      } else {
        const items = await scrapeSearch({ searchText: q })
        onResults(items)
      }
    } finally {
      onLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-3">
        <div className="inline-flex rounded-full bg-gray-100 p-1">
          <button
            className={`px-3 py-1 text-sm rounded-full ${!aiMode ? 'bg-white shadow-sm' : 'text-gray-600'}`}
            onClick={() => onModeChange(false)}
          >
            Manuel Arama
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-full ${aiMode ? 'bg-white shadow-sm' : 'text-gray-600'}`}
            onClick={() => onModeChange(true)}
          >
            AI ile Arama
          </button>
        </div>
        {aiMode && !modelReady && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            Model yüklenene kadar lütfen Manuel Arama kullanın.
          </div>
        )}
      </div>
      <form onSubmit={onSubmit} className="search-pill flex items-center gap-3 px-4 py-2">
        <span className="text-gray-500">🔎</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={aiMode ? 'Örn: 2020+ dizel SUV 700k TL altı' : 'Anahtar kelime ile ara'}
          className="flex-1 bg-transparent outline-none py-2"
        />
        <button className="btn btn-primary" type="submit">Ara</button>
      </form>
    </div>
  )
}

function useDebounce<T>(value: T, delay = 400) {
  const [v, setV] = useState(value)
  const t = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(() => setV(value), delay)
    return () => { if (t.current) clearTimeout(t.current) }
  }, [value, delay])
  return v
}

