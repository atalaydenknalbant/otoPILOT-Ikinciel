import { NextRequest, NextResponse } from 'next/server'
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const brand = (searchParams.get('brand') || '').trim()
    const model = (searchParams.get('model') || '').trim()

    if (!brand || !model) {
      return NextResponse.json({ urls: [] })
    }

    const now = Timestamp.now()
    const col = collection(db, 'promoted_listings')

    // 1) brand_lc/model_lc ile eşleşen tüm kayıtları çek (expiresAt JS tarafında filtrelenir)
    const q1 = query(
      col,
      where('brand_lc', '==', brand.toLowerCase()),
      where('model_lc', '==', model.toLowerCase())
    )
    const s1 = await getDocs(q1)

    // 2) Legacy: brand/model alanlarına göre de tara (bazı dokümanlarda *_lc olmayabilir)
    const q2 = query(
      col,
      where('brand', '==', brand),
      where('model', '==', model)
    )
    const s2 = await getDocs(q2)

    const seen = new Set<string>()
    const urls: string[] = []
    const pushIf = (u?: string, exp?: any) => {
      if (!u) return
      // expiresAt kontrolü JS tarafında
      const ok = exp?.toMillis ? exp.toMillis() > Date.now() : (exp ? new Date(exp).getTime() > Date.now() : true)
      if (!ok) return
      if (seen.has(u)) return
      seen.add(u)
      urls.push(u)
    }

    s1.forEach(d => {
      const data = d.data() as any
      pushIf(data?.url, data?.expiresAt)
    })
    s2.forEach(d => {
      const data = d.data() as any
      pushIf(data?.url, data?.expiresAt)
    })
    return NextResponse.json({ urls })
  } catch (error) {
    console.error('promoted-urls API error:', error)
    return NextResponse.json({ urls: [] })
  }
}
