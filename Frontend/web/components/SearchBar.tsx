"use client"
import { useEffect, useState } from 'react'
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
  onResults: (items: SearchItem[], parsed?: Parsed) => void
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
  const [stopCooldown, setStopCooldown] = useState(false)
  const [submitCooldown, setSubmitCooldown] = useState(false)

  // Listen for a global cooldown trigger (e.g., cancel from filters panel)
  useEffect(() => {
    const handler = (e: Event) => {
      const ms = (e as CustomEvent<number>).detail || 3000
      setSubmitCooldown(true)
      setTimeout(() => setSubmitCooldown(false), ms)
    }
    window.addEventListener('global-cooldown', handler as EventListener)
    return () => window.removeEventListener('global-cooldown', handler as EventListener)
  }, [])

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
    if (submitCooldown) return
    setSubmitCooldown(true)
    setTimeout(() => setSubmitCooldown(false), 3000)
    onLoading(true)
    try {
      const runId = beginNewRun()

      const mergeAndEmit = async (items: SearchItem[], parsedForEmit?: Parsed) => {
        // 1) Brand/Model'e göre aktif promoted URL'leri al ve scrape edip başa ekle
        let headPromoted: SearchItem[] = []
        try {
          const brandRaw = (parsedForEmit as any)?.marka || (parsedForEmit as any)?.brand
          const modelRaw = (parsedForEmit as any)?.model
          const brand = Array.isArray(brandRaw) ? brandRaw[0] : brandRaw
          const model = Array.isArray(modelRaw) ? modelRaw[0] : modelRaw
          if (brand && model) {
            const qs = new URLSearchParams({ brand: String(brand), model: String(model) }).toString()
            const url = `/api/promoted-urls?${qs}`
            const urlsResp = await fetch(url)
            const urlsJson = urlsResp.ok ? await urlsResp.json() : { urls: [] as string[] }
            const urlsToScrape: string[] = Array.isArray(urlsJson.urls) ? urlsJson.urls : []
            if (urlsToScrape.length) {
              const resp = await fetch('/api/scrape-favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ urls: urlsToScrape })
              })
              if (resp.ok) {
                const data = await resp.json()
                headPromoted = ((data.cars || []) as SearchItem[]).map((it: any) => ({ ...it, __promoted: true }))
              }
            }
          }
        } catch {}

        // 2) Mevcut sonuçlarda promoted olanları üste taşı (relative order korunur)
        try {
          const urls = (items || []).map((it: any) => it?.url).filter(Boolean) as string[]
          if (urls.length) {
            const resp = await fetch('/api/mark-promoted', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urls })
            })
            const json = resp.ok ? await resp.json() : { map: {} as Record<string, boolean> }
            const map = (json?.map || {}) as Record<string, boolean>
            const promoted: SearchItem[] = []
            const others: SearchItem[] = []
            for (const it of items) {
              const u = (it as any)?.url
              if (u && map[u]) promoted.push({ ...(it as any), __promoted: true })
              else others.push(it)
            }
            const seen = new Set<string>()
            const addUnique = (arr: SearchItem[], bucket: SearchItem[]) => {
              for (const it of arr) {
                const u = (it as any)?.url
                if (!u || seen.has(u)) continue
                seen.add(u)
                bucket.push(it)
              }
            }
            const finalList: SearchItem[] = []
            addUnique(headPromoted, finalList)
            addUnique(promoted, finalList)
            addUnique(others, finalList)
            onResults(finalList, parsedForEmit)
            return
          }
        } catch {}

        // 3) Fallback: sadece headPromoted + items (de-dup)
        const seen = new Set<string>()
        const finalList: SearchItem[] = []
        const addUnique2 = (arr: SearchItem[]) => {
          for (const it of arr) {
            const u = (it as any)?.url
            if (!u || seen.has(u)) continue
            seen.add(u)
            finalList.push(it)
          }
        }
        addUnique2(headPromoted)
        addUnique2(items)
        onResults(finalList, parsedForEmit)
      }

      if (aiMode) {
        const parsedJson: unknown = await parseWithLocalModel(q)
        if (getRunId() !== runId) return
        const base: Parsed = normalizeLLMToTurkish(parsedJson)
        onParsed?.(base)
        const resp = await scrapeSearch(base)
        if (getRunId() !== runId) return
        if (resp.filters) {
          const finalParsed = { ...base, ...(resp.filters as any) }
          onParsed?.(finalParsed)
          await mergeAndEmit(resp.items, finalParsed)
        } else {
          await mergeAndEmit(resp.items, base)
        }
        onModelReady(true)
      } else {
        const next: Parsed = { ...(parsed || {}), searchText: q }
        onParsed?.(next)
        const resp = await scrapeSearch(next)
        if (getRunId() !== runId) return
        if (resp.filters) {
          const finalParsed = { ...next, ...(resp.filters as any) }
          onParsed?.(finalParsed)
          await mergeAndEmit(resp.items, finalParsed)
        } else {
          await mergeAndEmit(resp.items, next)
        }
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
              title={stopCooldown ? 'Bekleyin…' : 'Durdur'}
              className={`btn btn-gradient w-10 h-10 p-0 flex items-center justify-center ${stopCooldown ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
              disabled={stopCooldown}
              onClick={() => {
                if (stopCooldown) return
                setStopCooldown(true)
                try { cancelRun() } catch {}
                onCancel()
                // Also start submit cooldown so the submit button is disabled right after cancel
                setSubmitCooldown(true)
                const ms = 3000
                // Broadcast to sync cooldown with other components
                try { window.dispatchEvent(new CustomEvent('global-cooldown', { detail: ms })) } catch {}
                setTimeout(() => setStopCooldown(false), ms)
                setTimeout(() => setSubmitCooldown(false), ms)
              }}
            >
              <span style={{ fontSize: 18 }}>⏹</span>
            </button>
          ) : (
            <button
              className={`btn btn-gradient ${submitCooldown ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
              type="submit"
              disabled={submitCooldown}
              title={submitCooldown ? 'Bekleyin…' : 'Yapay Zeka ile Ara'}
            >
              Yapay Zeka ile Ara
            </button>
          )}
        </form>
      )}

    </div>
  )
}
