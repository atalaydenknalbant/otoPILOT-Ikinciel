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
  // Otomatik arama kaldırıldı. Artık sadece "Ara" tıklandığında işlem yapılacak.

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
        <form onSubmit={onSubmit} className="flex items-center gap-3">
          <button className="btn btn-primary" type="submit">Ara</button>
          <div className="text-xs text-gray-500">Filtreleri doldurduktan sonra Ara'ya basın.</div>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="search-pill flex items-center gap-3 px-4 py-2">
          <span className="text-gray-500">🔎</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Enter'a basıldığında formun otomatik submit edilmesini engelle
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            placeholder={'Örn: 2020+ dizel SUV 700k TL altı'}
            className="flex-1 bg-transparent outline-none py-2"
          />
          <button className="btn btn-primary" type="submit">Ara</button>
        </form>
      )}
    </div>
  )
}

// not: otomatik arama için kullanılan debounce kaldırıldı
//push oldu
