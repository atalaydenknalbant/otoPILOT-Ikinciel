export type SearchItem = {
  imageUrl?: string
  url?: string
  title?: string
  model?: string
  year?: string | number
  km?: string | number
  location?: string
  price?: string | number
  date?: string
  source?: string
}

export type Parsed = {
  [key: string]: string | number | string[] | boolean | undefined
  marka?: string
  model?: string
  siralama?: string
  il?: string[]
  _lock_marka?: boolean
  _lock_model?: boolean
  ana_kategori?: string[]
  renkler?: string[]
  vites?: string[]
  arac_durumu?: string[]
  boya_degişen_parca?: string[]
  searchText?: string
  minYil?: number
  maxYil?: number
  minFiyat?: number
  maxFiyat?: number
  minKm?: number
  maxKm?: number
  takasa_uygun?: string
  agir_hasar_kayitli?: string
}
