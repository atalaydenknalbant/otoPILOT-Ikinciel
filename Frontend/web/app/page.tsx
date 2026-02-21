"use client"
import Header from '../components/Header'
import ResultList from '../components/ResultList'
import ModelStatus from '../components/ModelStatus'
import { useEffect, useState } from 'react'
import ParsedChips from '../components/ParsedChips'
import { scrapeSearch, cancelRun, beginNewRun, getRunId } from '../lib/api'
import { useWebModelLoader } from '../hooks/useWebModelLoader'
import { getSearchMode, setSearchMode } from '../lib/searchMode'
import { getSearchCache, setSearchCache, clearSearchCache, getLastSearchTime, setupCacheCleanup } from '../lib/searchCache'
import type { Parsed, SearchItem } from '../types'

export default function Page() {
  const [aiMode, setAiMode] = useState(false) // Server-side'da her zaman false
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<SearchItem[]>([])
  const [parsed, setParsed] = useState<Parsed>({
    ana_kategori: [],
    renkler: [],
    vites: [],
    arac_durumu: [],
    boya_degişen_parca: [],
  })
  const [lastSearchTime, setLastSearchTime] = useState<string | null>(null)
  const [modelReady, setModelReady] = useState(false)
  const { progress, ready, status, activeFile, error, modelId } = useWebModelLoader(aiMode && !modelReady)
  
  useEffect(() => {
    if (ready) setModelReady(true)
  }, [ready])

  // Client-side'da localStorage'dan arama modunu ve cache'i yükle
  useEffect(() => {
    const savedMode = getSearchMode()
    setAiMode(savedMode === 'ai')
    
    // Cache'den arama sonuçlarını yükle
    const cached = getSearchCache(savedMode === 'ai')
    console.log('Cache yükleniyor (AI:', savedMode === 'ai', '):', cached)
    if (cached) {
      console.log('Cache bulundu, veriler yükleniyor:', cached.items.length, 'araç')
      console.log('Cache\'den yüklenen filtreler:', cached.parsed)
      setItems(cached.items)
      setParsed(cached.parsed)
      setLastSearchTime(getLastSearchTime(savedMode === 'ai'))
    } else {
      console.log('Cache bulunamadı')
    }
    
    // Cache cleanup'ı başlat
    setupCacheCleanup()
  }, [])

  // Arama modu değiştiğinde localStorage'a kaydet
  const handleModeChange = (newAiMode: boolean) => {
    setAiMode(newAiMode)
    setSearchMode(newAiMode ? 'ai' : 'manual')
  }

  // Arama sonuçları geldiğinde cache'e kaydet
  const handleResults = (newItems: SearchItem[], currentParsed?: Parsed) => {
    setItems(newItems)
    // Mevcut parsed değeri ile birlikte cache'e kaydet
    const parsedToUse = currentParsed || parsed
    console.log('Cache\'e kaydediliyor (AI:', aiMode, '):', newItems.length, 'araç')
    setSearchCache(newItems, parsedToUse, aiMode)
    setLastSearchTime(getLastSearchTime(aiMode))
  }

  // Cache temizleme fonksiyonu
  const handleClearCache = () => {
    clearSearchCache(aiMode)
    setItems([])
    setParsed({
      ana_kategori: [],
      renkler: [],
      vites: [],
      arac_durumu: [],
      boya_degişen_parca: [],
    })
    setLastSearchTime(null)
  }
  const onApplyParsed = async (next: Parsed) => {
    setParsed(next)
    setLoading(true)
    try {
      const runId = beginNewRun()
      const resp = await scrapeSearch(next)
      if (getRunId() !== runId) return
      
      const finalParsed = resp.filters ? { ...next, ...(resp.filters as Parsed) } : next
      setItems(resp.items)
      setParsed(finalParsed)
      
      // Cache'e kaydet
      console.log('Cache\'e kaydedilen filtreler (AI:', aiMode, '):', finalParsed)
      setSearchCache(resp.items, finalParsed, aiMode)
      setLastSearchTime(getLastSearchTime(aiMode))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <Header
        aiMode={aiMode}
        onModeChange={handleModeChange}
        onResults={handleResults}
        onLoading={setLoading}
        onParsed={setParsed}
        modelReady={modelReady}
        onModelReady={setModelReady}
        parsed={parsed}
        loading={loading}
        onCancel={() => { cancelRun(); setLoading(false); setItems([]) }}
        currentPage="home"
      />

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6 mt-6">
        {/* Model durum göstergesi */}
        <ModelStatus 
          modelReady={modelReady} 
          progress={progress}
          statusText={status}
          activeFile={activeFile}
          errorText={error}
          modelId={modelId}
          lastSearchTime={lastSearchTime}
          onClearCache={handleClearCache}
        />
      </section>

      {/* Algılanan Filtreler - AI ya da Manuel her iki modda da tek kaynak */}
      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6 mt-6">
        <ParsedChips
          parsed={parsed}
          loading={loading}
          onChange={setParsed}
          onApply={onApplyParsed}
          onCancel={() => { cancelRun(); setLoading(false); setItems([]) }}
        />
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6 mt-8">
        <ResultList items={items} loading={loading} />
      </section>
    </main>
  )
}
