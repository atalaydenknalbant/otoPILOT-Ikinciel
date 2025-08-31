import type { ParsedFilters, CarItem, ScrapeResponse } from './types'

// Frontend calls go through Next.js API routes to avoid CORS.
// Backend is proxied server-side from /api/* to http://127.0.0.1:8080/*
const API_BASE = ''

// POST /parse with { query }
export async function parseWithLocalModel(query: string): Promise<ParsedFilters> {
  try {
    const res = await fetch(`${API_BASE}/api/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (res.ok) return await res.json()
  } catch {}
  // Fallback: basit çıkarım
  const maxPrice = query.match(/(\d{2,6})\s*(k|bin|k\s*tl|tl)/i)?.[1]
  const year = query.match(/(20\d{2}|19\d{2})/i)?.[1]
  return {
    searchText: query,
    maxPrice: maxPrice ? Number(maxPrice) * (/(k|bin)/i.test(query) ? 1000 : 1) : undefined,
    minYear: year ? Number(year) : undefined,
  }
}

// POST /scrape with parsed params. Returns items and optional normalized filters.
export async function scrapeSearch(filters: ParsedFilters): Promise<ScrapeResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters),
    })
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) {
        return { items: data as CarItem[] }
      }
      const items = (data?.items || []) as CarItem[]
      const filt = (data?.filters || undefined) as Record<string, unknown> | undefined
      return { items, filters: filt }
    }
  } catch {}
  // Mock sonuçlar (backend kapalıysa)
  return { items: [
    {
      imageUrl: 'https://picsum.photos/seed/car1/640/360',
      url: '#',
      title: '2020 Ford Focus 1.5 TDCi',
      year: 2020,
      km: 72000,
      location: 'İstanbul',
      price: '690.000 TL',
      date: 'Bugün',
      source: 'Mock',
    },
    {
      imageUrl: 'https://picsum.photos/seed/car2/640/360',
      url: '#',
      title: '2019 Renault Megane 1.3 TCe',
      year: 2019,
      km: 54000,
      location: 'Ankara',
      price: '630.000 TL',
      date: 'Dün',
      source: 'Mock',
    },
  ] }
}
