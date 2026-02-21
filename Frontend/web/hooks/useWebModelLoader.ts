"use client"
import { useEffect, useRef, useState } from 'react'
import { getLlmModelId, initLocalModel, onLlmProgress } from '../lib/client-llm'

type LoaderState = {
  progress: number
  status: string
  activeFile: string
  error: string
  ready: boolean
  modelId: string
}

export function useWebModelLoader(start: boolean = true): LoaderState {
  const [progress, setProgress] = useState<number>(0)
  const [status, setStatus] = useState<string>('Bekleniyor...')
  const [activeFile, setActiveFile] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [ready, setReady] = useState<boolean>(false)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!start && !ready) {
      startedRef.current = false
    }
  }, [start, ready])

  useEffect(() => {
    if (!start || ready || startedRef.current) return

    startedRef.current = true
    setProgress(0)
    setStatus('Model yukleniyor...')
    setActiveFile('')
    setError('')

    const unsub = onLlmProgress((next) => {
      setProgress(Math.max(0, Math.min(100, Math.floor(next.percent || 0))))
      setStatus(next.stage || 'Model yukleniyor...')
      setActiveFile(next.file || '')
      if (next.error) setError(next.error)
    })

    ;(async () => {
      try {
        await initLocalModel()
        setReady(true)
        setProgress(100)
        setStatus('Model hazir.')
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(msg)
        setStatus('Model yukleme basarisiz.')
      }
    })()

    return () => {
      try {
        unsub?.()
      } catch {}
    }
  }, [start, ready])

  return {
    progress,
    status,
    activeFile,
    error,
    ready,
    modelId: getLlmModelId(),
  }
}
