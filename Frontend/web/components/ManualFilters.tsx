"use client"
import { useState } from 'react'
import { scrapeSearch } from '../lib/api'
import type { ParsedFilters, ScrapeResponse } from '../lib/types'
import type { SearchItem } from '../types'
import type React from 'react'

export default function ManualFilters({ onResults, onLoading }: { onResults: (items: SearchItem[]) => void, onLoading: (b: boolean) => void }) {
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [minYear, setMinYear] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    onLoading(true)
    try {
      const norm = (s: string) => s ? s.trim().replace(/\s+/g, ' ') : ''
      const cap = (s: string) => norm(s).replace(/(^|\s)\S/g, (t) => t.toUpperCase())
      const b = cap(brand)
      const m = cap(model)
      const payload: ParsedFilters = {
        brand: b || undefined,
        model: m || undefined,
        minYear: minYear ? Number(minYear) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        // Arama ifadesini de iletelim
        searchText: [b, m].filter(Boolean).join(' ').trim() || undefined,
      }
      const res: ScrapeResponse = await scrapeSearch(payload)
      const items = res.items as unknown as SearchItem[]
      onResults(items)
    } finally { onLoading(false) }
  }

  return (
    <form onSubmit={submit} className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
      <input className="search-pill px-3 py-2" placeholder="Marka" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <input className="search-pill px-3 py-2" placeholder="Model" value={model} onChange={(e) => setModel(e.target.value)} />
      <input className="search-pill px-3 py-2" placeholder="Min Yıl" value={minYear} onChange={(e) => setMinYear(e.target.value)} />
      <input className="search-pill px-3 py-2" placeholder="Max Fiyat" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
      <div className="col-span-full">
        <button className="btn btn-primary w-full md:w-auto">Filtrele</button>
      </div>
    </form>
  )
}
