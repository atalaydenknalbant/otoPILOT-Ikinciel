export type ParsedFilters = {
  searchText?: string
  brand?: string
  model?: string
  minYear?: number
  maxPrice?: number
  ana_kategori?: string[]
  renkler?: string[]
  vites?: string[]
  arac_durumu?: string[]
  boya_degişen_parca?: string[]
}

export type CarItem = {
  imageUrl?: string
  url?: string
  title?: string
  model?: string
  year?: number | string
  km?: number | string
  location?: string
  price?: string | number
  date?: string
  source?: string
}

export type SearchItem = CarItem

export type Parsed = ParsedFilters

export type ScrapeResponse = {
  items: CarItem[]
  filters?: Record<string, unknown>
}
