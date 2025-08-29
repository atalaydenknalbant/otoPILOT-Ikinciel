"use client"

export default function ModelStatus({ modelReady, progress }: { modelReady: boolean; progress?: number | null }) {
  if (!modelReady) {
    return (
      <div className="card p-3 flex items-center gap-3">
        <div className="w-48 h-2 rounded-full bar-indeterminate" />
        <div className="text-sm text-gray-600">Yapay zeka modeli yükleniyor… {typeof progress === 'number' ? `%${progress}` : ''}</div>
      </div>
    )
  }

  // Model hazır: hiçbir şey gösterme
  return null
}
