"use client"

import type { ParsedFilters, CarItem, ScrapeResponse } from './types'

// Frontend calls go through Next.js API routes to avoid CORS.
// Backend is proxied server-side from /api/* to http://127.0.0.1:8080/*
const API_BASE = ''

// Global cancellation management for in-flight requests (parse/scrape)
const controllers: Set<AbortController> = new Set()
let currentRunId: string | null = null
type LLMInfo = {
  source: 'onnx' | 'backend' | 'heuristic'
  error?: string
  onnxRawText?: string
  onnxJson?: unknown
}
let lastLLMInfo: LLMInfo | null = null

export function getLastLLMInfo() {
  return lastLLMInfo
}

export function beginNewRun() {
  // Use simple unique id
  currentRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return currentRunId
}

export function getRunId() { return currentRunId }

export function cancelAllPending() {
  for (const c of Array.from(controllers)) {
    try { c.abort() } catch {}
    controllers.delete(c)
  }
}

export async function cancelRun() {
  // Abort browser-side requests immediately
  cancelAllPending()
  // Inform backend to stop ongoing jobs (parse/scrape)
  try {
    if (currentRunId) {
      await fetch(`/api/cancel`, { method: 'POST', headers: { 'x-run-id': currentRunId } })
    }
  } catch {}
  currentRunId = null
}

function createTrackedController(): AbortController {
  const c = new AbortController()
  controllers.add(c)
  const cleanup = () => controllers.delete(c)
  c.signal.addEventListener('abort', cleanup, { once: true })
  return c
}

// POST /parse with { query }
export async function parseWithLocalModel(query: string): Promise<ParsedFilters> {
  try {
    const { runLocalParse } = await import('./client-llm')
    const { json, raw } = await runLocalParse(query)
    if (json && typeof json === 'object') {
      lastLLMInfo = { source: 'onnx', onnxRawText: raw, onnxJson: json }
      return json as ParsedFilters
    }
    lastLLMInfo = { source: 'onnx', onnxRawText: raw, onnxJson: null, error: 'Model gecerli JSON dondurmedi.' }
    throw new Error(`Model JSON cikaramadi: ${raw?.slice(0, 220) || 'bos yanit'}`)
  } catch (e) {
    lastLLMInfo = { source: 'heuristic', error: e instanceof Error ? e.message : String(e) }
    console.error('Yerel model parse hatasi:', e)
  }
  // Fallback: basit cikarim
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
    const ac = createTrackedController()
    const res = await fetch(`${API_BASE}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(currentRunId ? { 'x-run-id': currentRunId } : {}) },
      body: JSON.stringify(filters),
      signal: ac.signal,
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
  // Mock sonuclar (backend kapalIysa)
  return { items: [
    {
      imageUrl: 'https://picsum.photos/seed/car1/640/360',
      url: '#',
      title: '2020 Ford Focus 1.5 TDCi',
      year: 2020,
      km: 72000,
      location: 'Istanbul',
      price: '690.000 TL',
      date: 'Bugun',
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
      date: 'Dun',
      source: 'Mock',
    },
  ] }
}
