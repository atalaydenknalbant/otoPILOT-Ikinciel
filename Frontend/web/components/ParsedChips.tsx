import { useMemo } from 'react'

type Props = {
  parsed: any
  loading: boolean
  onChange?: (next: any) => void
  onApply?: (next: any) => void
}

export default function ParsedChips({ parsed, loading, onChange, onApply }: Props) {
  const setField = (key: string, value: any) => {
    const next = { ...parsed, [key]: value }
    // marka+model değiştiyse searchText’i güncelle
    if (key === 'marka' || key === 'model') {
      const marka = key === 'marka' ? value : parsed?.marka
      const model = key === 'model' ? value : parsed?.model
      const st = [marka, model].filter(Boolean).join(' ').trim()
      next.searchText = st || parsed?.searchText
    }
    onChange?.(next)
  }

  const txt = (label: string, key: string, placeholder?: string) => (
    <label className="inline-flex items-center gap-2 bg-gray-50/80 border border-gray-200 rounded-full px-2.5 py-1">
      <span className="text-xs text-gray-600">{label}:</span>
      <input
        className="bg-transparent outline-none text-xs font-semibold min-w-[80px]"
        value={parsed?.[key] ?? ''}
        placeholder={placeholder}
        onChange={(e) => setField(key, e.target.value)}
      />
    </label>
  )

  const num = (label: string, key: string, placeholder?: string) => (
    <label className="inline-flex items-center gap-2 bg-gray-50/80 border border-gray-200 rounded-full px-2.5 py-1">
      <span className="text-xs text-gray-600">{label}:</span>
      <input
        type="number"
        className="bg-transparent outline-none text-xs font-semibold w-24"
        value={parsed?.[key] ?? ''}
        placeholder={placeholder}
        onChange={(e) => setField(key, e.target.value ? Number(e.target.value) : '')}
      />
    </label>
  )

  const commaList = (label: string, key: string) => (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500">{label}:</span>
      <input
        className="bg-white border border-gray-200 rounded-full px-2 py-1 text-xs shadow-sm"
        placeholder="virgülle ayırın"
        value={Array.isArray(parsed?.[key]) ? parsed[key].join(', ') : (parsed?.[key] ?? '')}
        onChange={(e) => setField(key, e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
      />
    </div>
  )

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-700">Algılanan Filtreler</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">{loading ? 'Yükleniyor…' : 'Hazır'}</span>
          <button
            className="btn btn-xs btn-primary"
            onClick={() => onApply?.(parsed)}
          >Uygula</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex gap-2 flex-wrap">
          {txt('Marka', 'marka', 'Örn: Renault')}
          {txt('Model', 'model', 'Örn: Megane')}
          {txt('Serbest Arama', 'searchText', 'Örn: Renault Megane')}
          {num('Min Yıl', 'minYil')}
          {num('Max Yıl', 'maxYil')}
          {num('Min Fiyat', 'minFiyat')}
          {num('Max Fiyat', 'maxFiyat')}
          {num('Min Km', 'minKm')}
          {num('Max Km', 'maxKm')}
          {txt('Sıralama', 'siralama')}
          {txt('Takasa Uygun', 'takasa_uygun')}
          {txt('Ağır Hasar Kayıtlı', 'agir_hasar_kayitli')}
        </div>
        <div className="flex gap-3 flex-col">
          {commaList('Ana Kategori', 'ana_kategori')}
          {commaList('Renkler', 'renkler')}
          {commaList('Vites', 'vites')}
          {commaList('Durum', 'arac_durumu')}
          {commaList('Boya/Değişen', 'boya_degişen_parca')}
        </div>
      </div>
    </div>
  )
}
