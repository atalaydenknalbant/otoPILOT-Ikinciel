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
  parsed,
}: {
  aiMode: boolean
  onModeChange: (b: boolean) => void
  onResults: (items: any[]) => void
  onLoading: (b: boolean) => void
  onParsed?: (json: any) => void
  modelReady: boolean
  onModelReady: (b: boolean) => void
  parsed?: any
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
        const parsedJson: any = await parseWithLocalModel(debounced)
        const lockMarka = Boolean((parsed as any)?.['_lock_marka'])
        const lockModel = Boolean((parsed as any)?.['_lock_model'])
        let merged: any = (parsedJson && typeof parsedJson === 'object') ? { ...parsedJson } : {}
        if (lockMarka) merged.marka = (parsed as any)?.marka ?? merged.marka
        if (lockModel) merged.model = (parsed as any)?.model ?? merged.model
        if (lockMarka) merged._lock_marka = true
        if (lockModel) merged._lock_model = true
        if (!cancelled) onParsed?.(merged)
        const items = await scrapeSearch(merged)
        if (!cancelled) onResults(items)
        if (!cancelled) onModelReady(true)
      } finally {
        if (!cancelled) onLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [debounced, aiMode, parsed])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onLoading(true)
    try {
      if (aiMode) {
        const parsedJson: any = await parseWithLocalModel(q)
        const lockMarka = Boolean((parsed as any)?.['_lock_marka'])
        const lockModel = Boolean((parsed as any)?.['_lock_model'])
        let merged: any = (parsedJson && typeof parsedJson === 'object') ? { ...parsedJson } : {}
        if (lockMarka) merged.marka = (parsed as any)?.marka ?? merged.marka
        if (lockModel) merged.model = (parsed as any)?.model ?? merged.model
        if (lockMarka) merged._lock_marka = true
        if (lockModel) merged._lock_model = true
        onParsed?.(merged)
        const items = await scrapeSearch(merged)
        onResults(items)
        onModelReady(true)
      } else {
        const next = { ...(parsed || {}), searchText: q }
        onParsed?.(next)
        const items = await scrapeSearch(next)
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
      {/* Manual mode: hide textbox, show model status and guidance */}
      {!aiMode ? (
        <div className="w-full">
          {!modelReady ? (
            <div className="flex flex-col gap-2">
              <div className="text-sm text-gray-700">Model yükleniyor…</div>
              <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="h-2 bg-brand-600 animate-pulse w-1/2"></div>
              </div>
              <div className="text-xs text-gray-500">Model yüklendikten sonra yapay zeka ile arayabilirsiniz.</div>
            </div>
          ) : (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
              Model yüklendi. Yapay zeka ile arayabilirsiniz.
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="search-pill flex items-center gap-3 px-4 py-2">
          <span className="text-gray-500">🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={'Örn: 2020+ dizel SUV 700k TL altı'}
            className="flex-1 bg-transparent outline-none py-2"
          />
          <button className="btn btn-primary" type="submit">Ara</button>
        </form>
      )}
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
