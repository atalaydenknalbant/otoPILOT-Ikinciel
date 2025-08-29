"use client"
import { useEffect, useRef, useState } from 'react'

// Simple mock loader: progresses from 0 to 100 in ~5 seconds, then marks ready
export function useMockModelLoader(start: boolean = true) {
  const [progress, setProgress] = useState<number>(0)
  const [ready, setReady] = useState<boolean>(false)
  // Use ReturnType<typeof setInterval> so it works in browser TS configs
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!start || ready) return
    // Reset
    setProgress(0)
    setReady(false)

    const totalMs = 5000
    const stepMs = 100
    const steps = Math.ceil(totalMs / stepMs)
    let i = 0

    timerRef.current = setInterval(() => {
      i += 1
      const pct = Math.min(100, Math.round((i / steps) * 100))
      setProgress(pct)
      if (pct >= 100 && timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
        setReady(true)
      }
    }, stepMs)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [start, ready])

  return { progress, ready }
}
