import { NextRequest, NextResponse } from 'next/server'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Firestore 'in' operatörü en fazla 10 eleman destekler; parçalayarak sorgularız
async function fetchPromotedMap(urls: string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  const col = collection(db, 'promoted_listings')
  const chunks: string[][] = []
  for (let i = 0; i < urls.length; i += 10) chunks.push(urls.slice(i, i + 10))
  for (const ch of chunks) {
    const qy = query(col, where('url', 'in', ch))
    const snap = await getDocs(qy)
    snap.forEach(d => {
      const u = (d.data() as any)?.url
      if (u) out[u] = true
    })
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as any
    const urls: string[] = Array.isArray(body?.urls) ? body.urls : []
    if (!urls.length) return NextResponse.json({ map: {} })

    const map = await fetchPromotedMap(urls)
    return NextResponse.json({ map })
  } catch (err) {
    console.error('mark-promoted API error:', err)
    return NextResponse.json({ map: {} })
  }
}
