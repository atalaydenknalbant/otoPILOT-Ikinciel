"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { createPortal } from 'react-dom'
import { loadBrandModels, type BrandModels, getModelsForBrand, filterBrands } from '../lib/brandModel'
import { RENKLER, VITES, ARAC_DURUMU, AGIR_HASAR, TAKAS, ANA_KATEGORI, YAKIT_TIPLERI, SIRALAMA_MAP, BOYA_DEGISEN } from '../constants/filters'

// A narrow map of filter fields we use. Avoids `any` while staying flexible.
type Parsed = {
  [key: string]: string | number | string[] | boolean | undefined
  marka?: string
  model?: string
  siralama?: string
  il?: string
  _lock_marka?: boolean
  _lock_model?: boolean
}

type Props = {
  parsed: Parsed
  loading: boolean
  onChange?: (next: Parsed) => void
  onApply?: (next: Parsed) => void
}

export default function ParsedChips({ parsed, loading, onChange, onApply }: Props) {
  // Option sources
  
  // Kategori çıkarımı için lokal veri indeksini yükle (marka+model -> kategori[])
  const [categoryIndex, setCategoryIndex] = useState<Map<string, Map<string, Set<string>>>>(new Map())
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/data/arabam_sequence_categories.json', { cache: 'force-cache' })
        if (!res.ok) return
        const json = await res.json()
        const cars = json?.arabalar || {}
        const idx = new Map<string, Map<string, Set<string>>>()
        for (const [category, arr] of Object.entries(cars)) {
          const list = Array.isArray(arr) ? (arr as any[]) : []
          for (const item of list) {
            const b = String(item?.marka ?? '')
            if (!b) continue
            const models: string[] = Array.isArray(item?.modeller) ? item.modeller : []
            let modelMap = idx.get(b)
            if (!modelMap) { modelMap = new Map(); idx.set(b, modelMap) }
            for (const m of models) {
              const k = String(m)
              let s = modelMap.get(k)
              if (!s) { s = new Set(); modelMap.set(k, s) }
              s.add(String(category))
            }
          }
        }
        setCategoryIndex(idx)
      } catch {}
    }
    load()
  }, [])

  const inferCategories = (brand?: string, model?: string): string[] => {
    if (!brand || !model) return []
    const m = categoryIndex.get(brand)
    const set = m?.get(model)
    return set ? Array.from(set.values()) : []
  }

  const resetAll = () => {
    const empty: Parsed = {}
    onChange?.(empty)
  }
  const SIRALAMA_LABELS = Object.keys(SIRALAMA_MAP)
  const SIRALAMA_REVERSE: Record<string, string> = useMemo(() => {
    const inv: Record<string, string> = {}
    for (const [label, code] of Object.entries(SIRALAMA_MAP)) inv[code] = label
    return inv
  }, [])

  // Cities (il) loaded from public/data/sehirler.json (file content starts with 'LOCATIONS = ')
  const [sehirler, setSehirler] = useState<string[]>([])
  useEffect(() => {
    const loadCities = async () => {
      try {
        const res = await fetch('/data/sehirler.json')
        const text = await res.text()
        // Strip leading variable assignment if present and parse JSON
        const jsonLike = text.replace(/^\s*LOCATIONS\s*=\s*/, '')
        const obj = JSON.parse(jsonLike)
        const keys = Object.keys(obj)
        setSehirler(keys)
      } catch (e) {
        try { console.warn('[ParsedChips] şehirler yüklenemedi', e) } catch {}
        setSehirler([])
      }
    }
    loadCities()
  }, [])

  const setField = (key: string, value: string | number | string[] | boolean | undefined) => {
    const next: Parsed = { ...parsed, [key]: value }
    if (key === 'marka') next._lock_marka = true
    if (key === 'model') next._lock_model = true
    // siralama için etiket -> kod dönüşümü (ek güvenlik)
    if (key === 'siralama' && typeof value === 'string' && SIRALAMA_MAP[value]) {
      next.siralama = SIRALAMA_MAP[value]
    }
    onChange?.(next)
  }

  // batch-update helper to avoid stale state when applying multiple field changes at once
  const setFields = (patch: Partial<Parsed>) => {
    const next: Parsed = { ...parsed, ...patch }
    if (Object.prototype.hasOwnProperty.call(patch, 'marka')) next._lock_marka = true
    if (Object.prototype.hasOwnProperty.call(patch, 'model')) next._lock_model = true
    onChange?.(next)
  }

  // helpers: input renderers with optional datalist
  const txt = (label: string, key: string, placeholder?: string, listId?: string) => (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/30">
        <span className="text-xs text-gray-600 whitespace-nowrap">{label}:</span>
        <input
          className="bg-transparent outline-none text-sm font-medium min-w-[120px] placeholder:text-gray-400"
          value={(parsed?.[key] as string | number | undefined) ?? ''}
          placeholder={placeholder}
          list={listId}
          onChange={(e) => setField(key, e.target.value)}
        />
      </label>
    </div>
  )

  // Single select compact dropdown
  const SingleSelectDropdown = ({ label, value, onSelect, options }: { label: string; value?: string; onSelect: (v: string) => void; options: string[] }) => {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState('')
    const ref = useRef<HTMLDivElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!ref.current) return
        const t = e.target as Node
        if (!ref.current.contains(t) && !(menuRef.current && menuRef.current.contains(t))) setOpen(false)
      }
      document.addEventListener('mousedown', onDoc)
      return () => document.removeEventListener('mousedown', onDoc)
    }, [])
    const list = useMemo(() => {
      const s = q.trim().toLocaleLowerCase('tr')
      if (!s) return options
      return options.filter(o => o.toLocaleLowerCase('tr').includes(s))
    }, [options, q])
    const summary = value ? value : 'Seçiniz'
    const renderMenu = () => {
      if (!open || !ref.current) return null
      const rect = ref.current.getBoundingClientRect()
      const style: React.CSSProperties = {
        position: 'absolute',
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: 320,
        maxHeight: '16rem',
        overflow: 'auto',
        zIndex: 9999,
      }
      return createPortal(
        <div ref={menuRef} style={style} className="bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <input className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm mb-2 outline-none" placeholder="Ara..." value={q} onChange={(e)=> setQ(e.target.value)} />
          <div className="grid grid-cols-1 gap-1">
            {list.map(opt => (
              <button key={opt} type="button" className="text-left px-2 py-1 rounded hover:bg-gray-50 text-sm" onClick={() => { onSelect(opt); setOpen(false) }}>{opt}</button>
            ))}
            {!list.length && <div className="text-xs text-gray-500 px-2 py-1">Sonuç yok.</div>}
          </div>
        </div>,
        document.body
      )
    }

    return (
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen(v=>!v)} className="inline-flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm text-sm min-w-[220px]">
          <span className="text-xs text-gray-600">{label}:</span>
          <span className="text-gray-800 font-medium truncate max-w-[150px]">{summary}</span>
          <span className="text-gray-400">▾</span>
        </button>
        {renderMenu()}
      </div>
    )
  }

  const num = (label: string, key: string, placeholder?: string) => (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/30">
        <span className="text-xs text-gray-600 whitespace-nowrap">{label}:</span>
        <input
          type="number"
          className="bg-transparent outline-none text-sm font-medium w-28 placeholder:text-gray-400"
          value={(parsed?.[key] as number | undefined) ?? ''}
          placeholder={placeholder}
          onChange={(e) => setField(key, e.target.value ? Number(e.target.value) : '')}
        />
      </label>
    </div>
  )

  // not: önceki sürümde kullanılan commaList kaldırıldı (kullanımı yoktu)

  // Toggle helper for arrays
  const toggleArrayItem = (key: string, value: string) => {
    // Özel kural: 'ana_kategori' için 'Kiralık Araçlar' tek başına seçilebilir
    if (key === 'ana_kategori') {
      const RENT = 'Kiralık Araçlar'
      const current: string[] = Array.isArray(parsed?.[key]) ? [...parsed[key]] : []
      const hasRent = current.includes(RENT)
      if (value === RENT) {
        // Kiralık seçilirse sadece o kalsın
        const next = current.includes(RENT) ? current.filter(v => v !== RENT) : [RENT]
        setField(key, next)
        return
      }
      // Diğer bir kategori seçiliyorsa ve Kiralık seçiliyse, önce Kiralık'ı kaldır
      const cleaned = hasRent ? current.filter(v => v !== RENT) : current
      const idx = cleaned.indexOf(value)
      if (idx >= 0) cleaned.splice(idx, 1); else cleaned.push(value)
      setField(key, cleaned)
      return
    }
    const arr: string[] = Array.isArray(parsed?.[key]) ? [...parsed[key]] : []
    const idx = arr.indexOf(value)
    if (idx >= 0) arr.splice(idx, 1); else arr.push(value)
    setField(key, arr)
  }

  // Compact dropdown multi-select
  const MultiSelectDropdown = ({ label, keyName, options }: { label: string; keyName: string; options: string[] }) => {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement | null>(null)
    const menuRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!ref.current) return
        const t = e.target as Node
        if (!ref.current.contains(t) && !(menuRef.current && menuRef.current.contains(t))) setOpen(false)
      }
      document.addEventListener('mousedown', onDoc)
      return () => document.removeEventListener('mousedown', onDoc)
    }, [])
    const selected: string[] = Array.isArray(parsed?.[keyName]) ? parsed[keyName] : []
    const summary = selected.length ? `${selected.length} seçili` : 'Seçiniz'
    const rentExclusive = keyName === 'ana_kategori' && selected.includes('Kiralık Araçlar')
    const renderMenu = () => {
      if (!open || !ref.current) return null
      const rect = ref.current.getBoundingClientRect()
      const style: React.CSSProperties = {
        position: 'absolute',
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: 320,
        maxHeight: '16rem',
        overflow: 'auto',
        zIndex: 9999,
      }
      return createPortal(
        <div ref={menuRef} style={style} className="bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          <div className="grid grid-cols-1 gap-1">
            {options.map((opt) => {
              const checked = selected.includes(opt)
              // Kiralık seçiliyse diğer seçenekleri kilitle
              const disabled = keyName === 'ana_kategori' && rentExclusive && opt !== 'Kiralık Araçlar'
              return (
                <label key={opt} className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`} title={disabled ? 'Kiralık Araçlar seçiliyken diğer kategoriler seçilemez' : ''}>
                  <input type="checkbox" className="accent-brand-600" checked={checked} disabled={disabled} onChange={() => toggleArrayItem(keyName, opt)} />
                  <span>{opt}</span>
                </label>
              )
            })}
          </div>
        </div>,
        document.body
      )
    }

    return (
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen(v => !v)} className="inline-flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm text-sm min-w-[220px]">
          <span className="text-xs text-gray-600">{label}:</span>
          <span className="text-gray-800 font-medium truncate max-w-[140px]">{summary}</span>
          <span className="text-gray-400">▾</span>
        </button>
        {renderMenu()}
      </div>
    )
  }

  // not: eskiden kullanılan datalist renderer kaldırıldı (kullanımı yok)

  // Brand & Model pickers (searchable dropdowns with free typing)
  const [brandData, setBrandData] = useState<BrandModels[]>([])
  const [brandOpen, setBrandOpen] = useState(false)
  const [brandQuery, setBrandQuery] = useState('')
  const brandRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    loadBrandModels().then(setBrandData).catch(() => setBrandData([]))
  }, [])
  // If brand changes and current model doesn't belong to the brand, clear it
  const modelOptionsByBrand = useMemo(
    () => getModelsForBrand(brandData, parsed?.marka),
    [brandData, parsed?.marka]
  )
  useEffect(() => {
    if (!parsed?.model) return
    if (!modelOptionsByBrand.includes(parsed.model)) {
      onChange?.({ ...parsed, model: '', _lock_model: true })
    }
  }, [parsed, modelOptionsByBrand, onChange])
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!brandRef.current) return
      if (!brandRef.current.contains(e.target as Node)) setBrandOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const brandList = useMemo(() => filterBrands(brandData, brandQuery).map(b => b.brand), [brandData, brandQuery])

  const BrandDropdown = () => (
    <div className="relative" ref={brandRef}>
      <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm min-w-[260px]">
        <span className="text-xs text-gray-600">Marka:</span>
        <input
          className="bg-transparent outline-none text-sm font-medium flex-1 placeholder:text-gray-400"
          placeholder="Örn: Renault"
          value={parsed?.marka ?? ''}
          onChange={(e) => {
            const nextVal = e.target.value
            const prev = parsed?.marka ?? ''
            setBrandQuery(nextVal)
            if (nextVal !== prev) {
              setFields({ marka: nextVal, model: '' })
            } else {
              setField('marka', nextVal)
            }
          }}
          onFocus={() => { setBrandQuery(''); setBrandOpen(true) }}
        />
        <button
          type="button"
          className="text-gray-400"
          onClick={() => {
            setBrandOpen(v => {
              const next = !v
              if (next) setBrandQuery('')
              return next
            })
          }}
        >▾</button>
      </div>
      {brandOpen && brandRef.current && createPortal((() => {
        const rect = brandRef.current!.getBoundingClientRect()
        const style: React.CSSProperties = {
          position: 'absolute',
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: 360,
          maxHeight: '16rem',
          overflow: 'auto',
          zIndex: 9999,
        }
        return (
          <div style={style} className="bg-white border border-gray-200 rounded-xl shadow-lg p-2">
            <input
              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm mb-2 outline-none"
              placeholder="Marka ara..."
              value={brandQuery}
              onChange={(e)=> setBrandQuery(e.target.value)}
            />
            <div className="grid grid-cols-1">
              {brandList.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="text-left px-2 py-1 rounded hover:bg-gray-50 text-sm"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setFields({ marka: name, model: '' }); setBrandOpen(false) }}
                >{name}</button>
              ))}
              {!brandList.length && (
                <div className="text-xs text-gray-500 px-2 py-1">Sonuç yok.</div>
              )}
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )

  const [modelOpen, setModelOpen] = useState(false)
  const [modelQuery, setModelQuery] = useState('')
  const modelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!modelRef.current) return
      if (!modelRef.current.contains(e.target as Node)) setModelOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const modelOptions = useMemo(() => getModelsForBrand(brandData, parsed?.marka), [brandData, parsed?.marka])
  const filteredModels = useMemo(() => {
    const s = modelQuery.trim().toLocaleLowerCase('tr')
    if (!s) return modelOptions
    return modelOptions.filter(m => m.toLocaleLowerCase('tr').includes(s))
  }, [modelOptions, modelQuery])

  const ModelDropdown = () => (
    <div className="relative" ref={modelRef}>
      <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm min-w-[260px]">
        <span className="text-xs text-gray-600">Model:</span>
        <input
          className="bg-transparent outline-none text-sm font-medium flex-1 placeholder:text-gray-400"
          placeholder="Örn: Megane"
          value={parsed?.model ?? ''}
          onChange={(e) => { setField('model', e.target.value); setModelQuery(e.target.value) }}
          onFocus={() => setModelOpen(true)}
        />
        <button type="button" className="text-gray-400" onClick={() => setModelOpen(v=>!v)}>▾</button>
      </div>
      {modelOpen && modelRef.current && createPortal((() => {
        const rect = modelRef.current!.getBoundingClientRect()
        const style: React.CSSProperties = {
          position: 'absolute',
          top: rect.bottom + window.scrollY + 8,
          left: rect.left + window.scrollX,
          width: 360,
          maxHeight: '16rem',
          overflow: 'auto',
          zIndex: 9999,
        }
        return (
          <div style={style} className="bg-white border border-gray-200 rounded-xl shadow-lg p-2">
            <input
              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm mb-2 outline-none"
              placeholder="Model ara..."
              value={modelQuery}
              onChange={(e)=> setModelQuery(e.target.value)}
            />
            <div className="grid grid-cols-1">
              {filteredModels.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="text-left px-2 py-1 rounded hover:bg-gray-50 text-sm"
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setField('model', name); setModelOpen(false) }}
                >{name}</button>
              ))}
              {!filteredModels.length && (
                <div className="text-xs text-gray-500 px-2 py-1">Sonuç yok.</div>
              )}
            </div>
          </div>
        )
      })(), document.body)}
    </div>
  )

  return (
    <div className="relative z-[999] rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Algılanan Filtreler</h3>
          <p className="text-xs text-gray-500">Manuel düzenleyebilir, ardından Uygula ile sonuçları güncelleyebilirsiniz.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{loading ? 'Yükleniyor…' : 'Hazır'}</span>
          <button type="button" className="btn btn-ghost text-sm" onClick={resetAll}>Filtreleri Sıfırla</button>
          <button
            className="btn btn-gradient text-sm"
            onClick={() => {
              // Uygula'da marka+model dolu ise ana_kategori'yi otomatik düzelt
              const next = { ...parsed }
              const hasRent = Array.isArray((next as any).ana_kategori) && ((next as any).ana_kategori as string[]).includes('Kiralık Araçlar')
              if (!hasRent && next.marka && next.model) {
                const cats = inferCategories(next.marka, next.model)
                if (cats.length) (next as any).ana_kategori = cats
              }
              onApply?.(next)
            }}
          >Uygula</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex gap-3 flex-wrap content-start">
          <BrandDropdown />
          <ModelDropdown />
          {txt('Serbest Arama', 'searchText', 'Örn: 1.6 tdi, panoramik tavan')}
          {num('Min Yıl', 'minYil', 'YYYY')}
          {num('Max Yıl', 'maxYil', 'YYYY')}
          {num('Min Fiyat', 'minFiyat', 'Sayı')}
          {num('Max Fiyat', 'maxFiyat', 'Sayı')}
          {num('Min Km', 'minKm', 'Sayı')}
          {num('Max Km', 'maxKm', 'Sayı')}
        </div>
        <div className="flex gap-3 flex-wrap content-start">
          <MultiSelectDropdown label="Ana Kategori" keyName="ana_kategori" options={ANA_KATEGORI} />
          <MultiSelectDropdown label="Renkler" keyName="renkler" options={RENKLER} />
          <MultiSelectDropdown label="Durum" keyName="arac_durumu" options={ARAC_DURUMU} />
          <MultiSelectDropdown label="Boya/Değişen" keyName="boya_degişen_parca" options={BOYA_DEGISEN} />
          <MultiSelectDropdown label="Vites" keyName="vites" options={VITES} />
          <MultiSelectDropdown label="Yakıt Tipi" keyName="yakit_tipi" options={YAKIT_TIPLERI} />
          {/* Move compact singles to the bottom of the right column to reduce overall height */}
          <SingleSelectDropdown
            label="Sıralama"
            value={SIRALAMA_REVERSE[parsed?.siralama ?? '']}
            options={SIRALAMA_LABELS}
            onSelect={(label) => setField('siralama', SIRALAMA_MAP[label])}
          />
          <SingleSelectDropdown
            label="Takasa Uygun"
            value={parsed?.takasa_uygun as string | undefined}
            options={TAKAS}
            onSelect={(val) => setField('takasa_uygun', val)}
          />
          <SingleSelectDropdown
            label="Ağır Hasar Kayıtlı"
            value={parsed?.agir_hasar_kayitli as string | undefined}
            options={AGIR_HASAR}
            onSelect={(val) => setField('agir_hasar_kayitli', val)}
          />
          <SingleSelectDropdown
            label="İl"
            value={parsed?.il as string | undefined}
            options={sehirler}
            onSelect={(val) => setField('il', val)}
          />
        </div>
      </div>

      {/* not: datalist containerlar kaldırıldı */}
    </div>
  )
}
