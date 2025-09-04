"use client"
import { useState } from 'react'
import type React from 'react'
import { parseWithLocalModel, scrapeSearch, beginNewRun, cancelRun, getRunId } from '../lib/api'
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
  loading,
  onCancel,
}: {
  aiMode: boolean
  onModeChange: (b: boolean) => void
  onResults: (items: SearchItem[]) => void
  onLoading: (b: boolean) => void
  onParsed?: (json: Parsed) => void
  modelReady: boolean
  onModelReady: (b: boolean) => void
  parsed?: Parsed
  loading: boolean
  onCancel: () => void
}) {
  const [q, setQ] = useState(
    "boyasız, 2020'den yeni, 3.000.000 TL altındaki maksimum 100000 km beyaz veya siyah renkli bmw 3 serisi otomatik vitesli arabaları bul., en yeni ilana göre sırala"
  )

  function normalizeLLMToTurkish(raw: unknown): Parsed {
    const src = (raw && typeof raw === 'object') ? (raw as Record<string, any>) : {}
    const out: Parsed = { ...(src as any) }
    const map: Record<string, string> = {
      main_category: 'ana_kategori',
      brand: 'marka',
      model: 'model',
      minYear: 'minYil',
      maxYear: 'maxYil',
      minPrice: 'minFiyat',
      maxPrice: 'maxFiyat',
      minKm: 'minKm',
      maxKm: 'maxKm',
      colors: 'renkler',
      gear: 'vites',
      fuel_type: 'yakit_tipi',
      city: 'il',
      status: 'arac_durumu',
      damagestatus: 'boya_degişen_parca',
      severaldamaged: 'agir_hasar_kayitli',
      sort: 'siralama',
      swap: 'takasa_uygun',
    }
    for (const [en, tr] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(src, en) && !Object.prototype.hasOwnProperty.call(out, tr)) {
        (out as any)[tr] = (src as any)[en]
      }
    }
    const arrayKeys = ['ana_kategori','renkler','vites','yakit_tipi','il','boya_degişen_parca','arac_durumu']
    for (const k of arrayKeys) {
      const v = (out as any)[k]
      if (v != null && v !== '' && !Array.isArray(v)) (out as any)[k] = [v]
    }
    return out
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    onLoading(true)
    try {
      const runId = beginNewRun()
      if (aiMode) {
        const parsedJson: unknown = await parseWithLocalModel(q)
        if (getRunId() !== runId) return
        const base: Parsed = normalizeLLMToTurkish(parsedJson)
        onParsed?.(base)
        const resp = await scrapeSearch(base)
        if (getRunId() !== runId) return
        onResults(resp.items)
        if (resp.filters) onParsed?.({ ...base, ...(resp.filters as any) })
        onModelReady(true)
      } else {
        const next: Parsed = { ...(parsed || {}), searchText: q }
        onParsed?.(next)
        const resp = await scrapeSearch(next)
        if (getRunId() !== runId) return
        onResults(resp.items)
        if (resp.filters) onParsed?.({ ...next, ...(resp.filters as any) })
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
              if (e.key === 'Enter') {
                e.preventDefault()
                e.stopPropagation()
              }
            }}
            placeholder={'Örn: 2020+ dizel SUV 700k TL altı'}
            className="flex-1 bg-transparent outline-none py-2"
          />
          {loading ? (
            <button
              type="button"
              aria-label="Durdur"
              title="Durdur"
              className="btn btn-gradient w-10 h-10 p-0 flex items-center justify-center"
              onClick={() => { try { cancelRun() } catch {}; onCancel() }}
            >
              <span style={{ fontSize: 18 }}>⏹</span>
            </button>
          ) : (
            <button className="btn btn-gradient" type="submit">Yapay Zeka ile Ara</button>
          )}
        </form>
      )}

    </div>
  )
}
