"use client"
import { useEffect, useState } from 'react'

export default function ModelStatus({ aiMode }: { aiMode: boolean }) {
  // Gelecekte: WebLLM yükleme ilerlemesi buraya gelecek.
  const [progress, setProgress] = useState<number | null>(null)

  useEffect(() => {
    if (!aiMode) { setProgress(null); return }
    // Placeholder: yerel modele bağlandığımızı varsayalım
    setProgress(null) // null => gizli; sayı => göster
  }, [aiMode])

  if (progress === null) return null

  return (
    <div className="card p-3 flex items-center gap-3">
      <div className="w-48 bg-gray-200 rounded-full h-2 overflow-hidden">
        <div className="bg-brand-600 h-2" style={{ width: `${progress}%` }} />
      </div>
      <div className="text-sm text-gray-600">Model yükleniyor... %{progress}</div>
    </div>
  )
}
