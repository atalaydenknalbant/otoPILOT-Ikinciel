"use client"
import Header from '../components/Header'
import ResultList from '../components/ResultList'
import ModelStatus from '../components/ModelStatus'
import { useState } from 'react'
import ParsedChips from '../components/ParsedChips'
import { scrapeSearch } from '../lib/api'

export default function Page() {
  const [aiMode, setAiMode] = useState(false)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [parsed, setParsed] = useState<any | null>({
    ana_kategori: [],
    renkler: [],
    vites: [],
    arac_durumu: [],
    boya_degişen_parca: [],
  })
  const [modelReady, setModelReady] = useState(false)
  const onApplyParsed = async (next: any) => {
    setParsed(next)
    setLoading(true)
    try {
      const items = await scrapeSearch(next)
      setItems(items)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main>
      <Header
        aiMode={aiMode}
        onModeChange={setAiMode}
        onResults={setItems}
        onLoading={setLoading}
        onParsed={setParsed}
        modelReady={modelReady}
        onModelReady={setModelReady}
        parsed={parsed}
      />

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6 mt-6">
        {/* Model durum göstergesi - ileride WebLLM için kullanılacak */}
        <ModelStatus aiMode={aiMode} />
      </section>

      {/* Algılanan Filtreler - AI ya da Manuel her iki modda da tek kaynak */}
      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6 mt-6">
        <ParsedChips
          parsed={parsed}
          loading={loading}
          onChange={setParsed}
          onApply={onApplyParsed}
        />
      </section>

      <section className="mx-auto w-full max-w-[1400px] px-4 md:px-6 mt-8">
        <ResultList items={items} loading={loading} />
      </section>
    </main>
  )
}
