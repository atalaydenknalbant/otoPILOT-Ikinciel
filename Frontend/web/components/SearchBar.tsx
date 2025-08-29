"use client"
import { useState } from 'react'
import type React from 'react'
import { parseWithLocalModel, scrapeSearch } from '../lib/api'
import type { Parsed, SearchItem } from '../types'

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
  onResults: (items: SearchItem[]) => void
  onLoading: (b: boolean) => void
  onParsed?: (json: Parsed) => void
  modelReady: boolean
  onModelReady: (b: boolean) => void
  parsed?: Parsed
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
        const parsedJson: unknown = await parseWithLocalModel(q)
        const lockMarka = Boolean(parsed?.['_lock_marka'])
        const lockModel = Boolean(parsed?.['_lock_model'])
        const base: Parsed = parsedJson && typeof parsedJson === 'object' ? { ...(parsedJson as Parsed) } : {}
        if (lockMarka) base.marka = parsed?.marka ?? base.marka
        if (lockModel) base.model = parsed?.model ?? base.model
        if (lockMarka) base._lock_marka = true
        if (lockModel) base._lock_model = true
        onParsed?.(base)
        const items = await scrapeSearch(base)
        onResults(items)
        onModelReady(true)
      } else {
        const next: Parsed = { ...(parsed || {}), searchText: q }
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
            Filtrelerle Ara
          </button>
          <button
            className={`px-3 py-1 text-sm rounded-full ${aiMode ? 'bg-white shadow-sm' : 'text-gray-600'}`}
            onClick={() => onModeChange(true)}
          >
            Yapay Zeka ile Ara
          </button>
        </div>
        {aiMode && !modelReady && (
          <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
            Yapay zeka modeli yükleniyor; bu sırada filtrelerle arama yapabilirsiniz.
          </div>
        )}
        {aiMode && modelReady && (
          <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            Yapay zeka modeli yüklendi.
          </div>
        )}
      </div>
      {/* Manual mode: no button here; search is triggered by ParsedChips "Uygula" */}
      {!aiMode ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl shadow-sm">
            <span>ℹ️</span>
            <span>
              Yapay zeka modeli yüklenene kadar arama yapmak için <span className="font-semibold">filtreleri</span> doldurun ve aşağıdaki <b>Uygula</b> butonuna basın.
            </span>
          </div>
        </div>
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
          <button className="btn btn-gradient" type="submit">Yapay Zeka ile Ara</button>
        </form>
      )}

    </div>
  )
}