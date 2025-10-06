"use client"

interface ModelStatusProps {
  modelReady: boolean
  progress?: number | null
  lastSearchTime?: string | null
  onClearCache?: () => void
}

export default function ModelStatus({ modelReady, progress, lastSearchTime, onClearCache }: ModelStatusProps) {
  if (!modelReady) {
    return (
      <div className="card p-3 flex items-center gap-3">
        <div className="w-48 h-2 rounded-full bar-indeterminate" />
        <div className="text-sm text-gray-600">Yapay zeka modeli yükleniyor… {typeof progress === 'number' ? `%${progress}` : ''}</div>
      </div>
    )
  }

  // Model hazır ve cache varsa cache bilgisini göster
  if (lastSearchTime) {
    return (
      <div className="card p-3 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Son arama: {lastSearchTime}
        </div>
        {onClearCache && (
          <button
            onClick={onClearCache}
            className="text-sm text-red-600 hover:text-red-800 underline"
          >
            Arama Sonucunu Temizle
          </button>
        )}
      </div>
    )
  }

  // Model hazır ama cache yok: hiçbir şey gösterme
  return null
}
