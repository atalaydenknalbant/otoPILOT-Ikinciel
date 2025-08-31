export type ParsedFilters = {
  searchText?: string
  brand?: string
  model?: string
  minYear?: number
  maxPrice?: number
}

export type CarItem = {
  imageUrl?: string
  url?: string
  title?: string
  model?: string
  year?: number | string
  km?: number | string
  location?: string
  price?: string
  date?: string
  source?: string
}

export type ScrapeResponse = {
  items: CarItem[]
  filters?: Record<string, unknown>
}
