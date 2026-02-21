"use client"

interface ModelStatusProps {
  modelReady: boolean
  progress?: number | null
  lastSearchTime?: string | null
  onClearCache?: () => void
  statusText?: string
  activeFile?: string
  errorText?: string
  modelId?: string
}

export default function ModelStatus({
  modelReady,
  progress,
  lastSearchTime,
  onClearCache,
  statusText,
  activeFile,
  errorText,
  modelId,
}: ModelStatusProps) {
  if (errorText) {
    return (
      <div className="card p-3 border border-red-200 bg-red-50">
        <div className="text-sm font-semibold text-red-800">Model yuklenemedi</div>
        <div className="text-xs text-red-700 mt-1">{errorText}</div>
      </div>
    )
  }

  if (!modelReady) {
    return (
      <div className="card p-3 flex items-start gap-3">
        <div className="w-48 h-2 rounded-full bar-indeterminate mt-2" />
        <div className="text-sm text-gray-700">
          <div>WebGPU modeli yukleniyor{typeof progress === 'number' ? ` (%${progress})` : ''}</div>
          {statusText && <div className="text-xs text-gray-500 mt-1">{statusText}</div>}
          {activeFile && <div className="text-xs text-gray-500 mt-1">Dosya: {activeFile}</div>}
          {modelId && <div className="text-xs text-gray-500 mt-1">Model: {modelId}</div>}
        </div>
      </div>
    )
  }

  if (lastSearchTime) {
    return (
      <div className="card p-3 flex items-center justify-between gap-3">
        <div className="text-sm text-gray-600">
          <div>Model hazir: {modelId || 'Yerel WebGPU Model'}</div>
          <div className="text-xs text-gray-500">Son arama: {lastSearchTime}</div>
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

  return (
    <div className="card p-3 text-sm text-gray-600">
      Model hazir: {modelId || 'Yerel WebGPU Model'}
    </div>
  )
}
