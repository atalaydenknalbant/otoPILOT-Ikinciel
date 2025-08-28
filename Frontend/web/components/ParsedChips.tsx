import { useEffect, useMemo, useRef, useState } from 'react'
import { loadBrandModels, type BrandModels, getModelsForBrand, filterBrands } from '../lib/brandModel'

type Props = {
  parsed: any
  loading: boolean
  onChange?: (next: any) => void
  onApply?: (next: any) => void
}

export default function ParsedChips({ parsed, loading, onChange, onApply }: Props) {
  // Option sources
  const RENKLER = ["Altın", "Bej", "Beyaz", "Bordo", "Füme", "Gri", "Gri (Gümüş)", "Gri (metalik)", "Gri (titanyum)", "Kahverengi", "Kırmızı", "Lacivert", "Mavi", "Mavi (metalik)", "Mor", "Pembe", "Şampanya", "Sarı", "Siyah", "Turkuaz", "Turuncu", "Yeşil", "Yeşil (metalik)", "Diğer"]
  const VITES = ["Düz", "Otomatik", "Yarı Otomatik"]
  const ARAC_DURUMU = ["İkinci El", "Sıfır", "Yetkili Bayiden Sıfır", "Yurtdışından İthal Sıfır"]
  const AGIR_HASAR = ["Evet", "Hayır"]
  const TAKAS = ["Takasa Uygun", "Takasa Uygun Değil"]
  const ANA_KATEGORI = ["Kiralık Araçlar", "Otomobil", "Arazi, SUV, Pick-up", "Minivan & Panelvan"]
  const SIRALAMA_MAP: Record<string, string> = {
    "Fiyat - Ucuzdan Pahalıya": "price.asc",
    "Fiyat - Pahalıdan Ucuza": "price.desc",
    "Yıl - Yeniden Eskiye": "year.desc",
    "Yıl - Eskiden Yeniye": "year.asc",
    "Kilometre - Düşükten Yükseğe": "km.asc",
    "Kilometre - Yüksekten Düşüğe": "km.desc",
    "Tarih - Yeniden Eskiye": "startedAt.desc",
  }
  const SIRALAMA_LABELS = Object.keys(SIRALAMA_MAP)
  const SIRALAMA_REVERSE: Record<string, string> = useMemo(() => {
    const inv: Record<string, string> = {}
    for (const [label, code] of Object.entries(SIRALAMA_MAP)) inv[code] = label
    return inv
  }, [])

  const setField = (key: string, value: any) => {
    const next: any = { ...parsed, [key]: value }
    if (key === 'marka') next._lock_marka = true
    if (key === 'model') next._lock_model = true
    // siralama için etiket -> kod dönüşümü (ek güvenlik)
    if (key === 'siralama' && value && SIRALAMA_MAP[value]) {
      next.siralama = SIRALAMA_MAP[value]
    }
    if (key === 'marka' || key === 'model') {
      try { console.debug('[ParsedChips] setField', key, value) } catch {}
    }
    onChange?.(next)
  }

  // batch-update helper to avoid stale state when applying multiple field changes at once
  const setFields = (patch: Record<string, any>) => {
    const next: any = { ...parsed, ...patch }
    if (Object.prototype.hasOwnProperty.call(patch, 'marka')) next._lock_marka = true
    if (Object.prototype.hasOwnProperty.call(patch, 'model')) next._lock_model = true
    try { console.debug('[ParsedChips] setFields', patch) } catch {}
    onChange?.(next)
  }

  // helpers: input renderers with optional datalist
  const txt = (label: string, key: string, placeholder?: string, hint?: string, listId?: string) => (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/30">
        <span className="text-xs text-gray-600 whitespace-nowrap">{label}:</span>
        <input
          className="bg-transparent outline-none text-sm font-medium min-w-[120px] placeholder:text-gray-400"
          value={parsed?.[key] ?? ''}
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
    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!ref.current) return
        if (!ref.current.contains(e.target as Node)) setOpen(false)
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
    return (
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen(v=>!v)} className="inline-flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm text-sm min-w-[220px]">
          <span className="text-xs text-gray-600">{label}:</span>
          <span className="text-gray-800 font-medium truncate max-w-[150px]">{summary}</span>
          <span className="text-gray-400">▾</span>
        </button>
        {open && (
          <div className="absolute z-20 mt-2 w-[320px] max-h-64 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg p-3">
            <input className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm mb-2 outline-none" placeholder="Ara..." value={q} onChange={(e)=> setQ(e.target.value)} />
            <div className="grid grid-cols-1 gap-1">
              {list.map(opt => (
                <button key={opt} type="button" className="text-left px-2 py-1 rounded hover:bg-gray-50 text-sm" onClick={() => { onSelect(opt); setOpen(false) }}>{opt}</button>
              ))}
              {!list.length && <div className="text-xs text-gray-500 px-2 py-1">Sonuç yok.</div>}
            </div>
          </div>
        )}
      </div>
    )
  }

  const num = (label: string, key: string, placeholder?: string, hint?: string) => (
    <div className="flex flex-col gap-1">
      <label className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/30">
        <span className="text-xs text-gray-600 whitespace-nowrap">{label}:</span>
        <input
          type="number"
          className="bg-transparent outline-none text-sm font-medium w-28 placeholder:text-gray-400"
          value={parsed?.[key] ?? ''}
          placeholder={placeholder}
          onChange={(e) => setField(key, e.target.value ? Number(e.target.value) : '')}
        />
      </label>
    </div>
  )

  const commaList = (label: string, key: string, hint?: string, listId?: string) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-600 whitespace-nowrap">{label}:</span>
        <input
          className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:ring-2 focus:ring-brand-500/30"
          placeholder="virgülle ayırın"
          value={Array.isArray(parsed?.[key]) ? parsed[key].join(', ') : (parsed?.[key] ?? '')}
          list={listId}
          onChange={(e) => setField(key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
        />
      </div>
    </div>
  )

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
    useEffect(() => {
      const onDoc = (e: MouseEvent) => {
        if (!ref.current) return
        if (!ref.current.contains(e.target as Node)) setOpen(false)
      }
      document.addEventListener('mousedown', onDoc)
      return () => document.removeEventListener('mousedown', onDoc)
    }, [])
    const selected: string[] = Array.isArray(parsed?.[keyName]) ? parsed[keyName] : []
    const summary = selected.length ? `${selected.length} seçili` : 'Seçiniz'
    const rentExclusive = keyName === 'ana_kategori' && selected.includes('Kiralık Araçlar')
    return (
      <div className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen(v => !v)} className="inline-flex items-center justify-between gap-2 bg-white border border-gray-200 rounded-xl px-3 py-1.5 shadow-sm text-sm min-w-[220px]">
          <span className="text-xs text-gray-600">{label}:</span>
          <span className="text-gray-800 font-medium truncate max-w-[140px]">{summary}</span>
          <span className="text-gray-400">▾</span>
        </button>
        {open && (
          <div className="absolute z-20 mt-2 w-[320px] max-h-64 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg p-3">
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
          </div>
        )}
      </div>
    )
  }

  // datalists
  const DataList = ({ id, options }: { id: string; options: string[] }) => (
    <datalist id={id}>
      {options.map((o) => (
        <option value={o} key={o} />
      ))}
    </datalist>
  )

  // Brand & Model pickers (searchable dropdowns with free typing)
  const [brandData, setBrandData] = useState<BrandModels[]>([])
  const [brandOpen, setBrandOpen] = useState(false)
  const [brandQuery, setBrandQuery] = useState('')
  const brandRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    loadBrandModels().then(setBrandData).catch(() => setBrandData([]))
  }, [])
  // If brand changes and current model doesn't belong to the brand, clear it
  const modelOptionsByBrand = useMemo(() => getModelsForBrand(brandData, parsed?.marka), [brandData, parsed?.marka])
  useEffect(() => {
    if (!parsed?.model) return
    if (!modelOptionsByBrand.includes(parsed.model)) {
      setField('model', '')
    }
  }, [parsed?.marka])
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
      {brandOpen && (
        <div className="absolute z-20 mt-2 w-[360px] max-h-64 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg p-2">
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
      )}
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
      {modelOpen && (
        <div className="absolute z-20 mt-2 w-[360px] max-h-64 overflow-auto bg-white border border-gray-200 rounded-xl shadow-lg p-2">
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
      )}
    </div>
  )

  return (
    <div className="rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800">Algılanan Filtreler</h3>
          <p className="text-xs text-gray-500">Manuel düzenleyebilir, ardından Uygula ile sonuçları güncelleyebilirsiniz.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{loading ? 'Yükleniyor…' : 'Hazır'}</span>
          <button
            className="btn btn-xs btn-primary"
            onClick={() => onApply?.(parsed)}
          >Uygula</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex gap-3 flex-wrap content-start">
          <BrandDropdown />
          <ModelDropdown />
          {txt('Serbest Arama', 'searchText', 'Örn: 1.6 tdi, panoramik tavan', 'Standart filtre dışı ifadeleri yazın. Marka/model yazmayın.')}
          {num('Min Yıl', 'minYil', 'YYYY', 'Örn: 2018')}
          {num('Max Yıl', 'maxYil', 'YYYY', 'Örn: 2024')}
          {num('Min Fiyat', 'minFiyat', 'Sayı', 'TL cinsinden sayı girin (ör: 300000)')}
          {num('Max Fiyat', 'maxFiyat', 'Sayı', 'TL cinsinden sayı girin (ör: 3000000)')}
          {num('Min Km', 'minKm', 'Sayı', 'Örn: 0, 10000')}
          {num('Max Km', 'maxKm', 'Sayı', 'Örn: 150000')}
          <SingleSelectDropdown
            label="Sıralama"
            value={SIRALAMA_REVERSE[parsed?.siralama ?? '']}
            options={SIRALAMA_LABELS}
            onSelect={(label) => setField('siralama', SIRALAMA_MAP[label])}
          />
          <SingleSelectDropdown
            label="Takasa Uygun"
            value={parsed?.takasa_uygun}
            options={TAKAS}
            onSelect={(val) => setField('takasa_uygun', val)}
          />
          <SingleSelectDropdown
            label="Ağır Hasar Kayıtlı"
            value={parsed?.agir_hasar_kayitli}
            options={AGIR_HASAR}
            onSelect={(val) => setField('agir_hasar_kayitli', val)}
          />
        </div>
        <div className="flex gap-3 flex-wrap content-start">
          <MultiSelectDropdown label="Ana Kategori" keyName="ana_kategori" options={ANA_KATEGORI} />
          <MultiSelectDropdown label="Renkler" keyName="renkler" options={RENKLER} />
          <MultiSelectDropdown label="Durum" keyName="arac_durumu" options={ARAC_DURUMU} />
          <MultiSelectDropdown label="Boya/Değişen" keyName="boya_degişen_parca" options={["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"]} />
          <MultiSelectDropdown label="Vites" keyName="vites" options={VITES} />
        </div>
      </div>

      {/* datalist containers */}
      <DataList id="dl-renkler" options={RENKLER} />
      <DataList id="dl-vites" options={VITES} />
      <DataList id="dl-durum" options={ARAC_DURUMU} />
      <DataList id="dl-agirhasar" options={AGIR_HASAR} />
      <DataList id="dl-takas" options={TAKAS} />
      <DataList id="dl-siralama" options={SIRALAMA_LABELS} />
      <DataList id="dl-boya" options={["Boyasız, Değişensiz ve Tramersiz", "Boyasız ve Değişensiz", "Boyasız", "Değişensiz", "Tramersiz"]} />
    </div>
  )
}
