import { NextRequest, NextResponse } from 'next/server'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../../../lib/firebase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    if (!userId) {
      return NextResponse.json({ error: 'userId gerekli' }, { status: 400 })
    }

    const listingsQ = query(
      collection(db, 'listings'),
      where('userId', '==', userId)
    )
    const listingsSnap = await getDocs(listingsQ)
    const items = listingsSnap.docs
      .map(d => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => {
        const ta = (a as any)?.createdAt?.toMillis ? (a as any).createdAt.toMillis() : new Date(a.createdAt || 0).getTime()
        const tb = (b as any)?.createdAt?.toMillis ? (b as any).createdAt.toMillis() : new Date(b.createdAt || 0).getTime()
        return tb - ta
      })

    // URL'lere göre aktif promoted var mı?
    const urls = items.map(i => i.url).filter(Boolean) as string[]
    const promotedMap: Record<string, boolean> = {}
    // Firestore 'in' limit 10 olduğu için parçalayarak sorgula
    for (let i = 0; i < urls.length; i += 10) {
      const batch = urls.slice(i, i + 10)
      const promoQ = query(collection(db, 'promoted_listings'), where('url', 'in', batch))
      const snap = await getDocs(promoQ)
      snap.forEach(d => {
        const u = (d.data() as any)?.url
        if (u) promotedMap[u] = true
      })
    }

    const result = items.map(it => ({ ...it, isPromoted: !!promotedMap[it.url as string] }))
    return NextResponse.json({ items: result })
  } catch (err) {
    console.error('user-promoted-ads error:', err)
    return NextResponse.json({ items: [] })
  }
}
