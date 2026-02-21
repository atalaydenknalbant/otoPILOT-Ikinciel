"use client"
import { useMemo } from 'react'
import { getLastLLMInfo } from '../lib/api'

export default function LLMDebug() {
  // Pull latest info each render; page re-renders on search updates
  const info = useMemo(() => getLastLLMInfo(), []) || getLastLLMInfo()
  const i = getLastLLMInfo()
  if (!i) return null

  const badge = (txt: string, color = 'gray') => (
    <span className={`px-2 py-0.5 text-xs rounded-full bg-${color}-100 text-${color}-800 border border-${color}-200`}>{txt}</span>
  )
  const src = i.source === 'onnx' ? badge('Kaynak: ONNX', 'emerald')
    : i.source === 'backend' ? badge('Kaynak: Backend', 'blue')
    : badge('Kaynak: Heuristik', 'amber')

  return (
    <div className="mt-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-3 mb-2">
        <div className="font-medium text-sm">LLM Durumu</div>
        {src}
        {i.error ? <span className="text-xs text-red-700">{i.error}</span> : null}
      </div>
      {i.onnxRawText ? (
        <div className="mb-2">
          <div className="text-xs text-gray-500 mb-1">ONNX Ham Çıktı</div>
          <pre className="text-xs whitespace-pre-wrap break-words max-h-40 overflow-auto bg-white p-2 rounded border border-gray-200">{i.onnxRawText}</pre>
        </div>
      ) : i.source === 'onnx' ? (
        <div className="text-xs text-amber-700">ONNX çıktı metni alınamadı.</div>
      ) : null}
      {i.onnxJson ? (
        <div>
          <div className="text-xs text-gray-500 mb-1">ONNX JSON</div>
          <pre className="text-xs whitespace-pre-wrap break-words max-h-40 overflow-auto bg-white p-2 rounded border border-gray-200">{JSON.stringify(i.onnxJson, null, 2)}</pre>
        </div>
      ) : i.source === 'onnx' ? (
        <div className="text-xs text-amber-700">ONNX JSON bulunamadı.</div>
      ) : null}
    </div>
  )
}

