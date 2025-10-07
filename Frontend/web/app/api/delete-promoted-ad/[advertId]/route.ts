import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../../../lib/firebase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { advertId: string } }
) {
  try {
    const { advertId } = params
    const body = await request.json().catch(() => ({} as any))
    const { userId } = body || {}

    if (!advertId) {
      return NextResponse.json({ error: 'advertId gerekli' }, { status: 400 })
    }

    // Önce listings belgesini bul
    const listingSnap = await getDocs(query(collection(db, 'listings'), where('__name__', '==', advertId)))
    if (listingSnap.empty) {
      return NextResponse.json({ error: 'ilan bulunamadı' }, { status: 404 })
    }
    const listingDoc = listingSnap.docs[0]
    const url = (listingDoc.data() as any)?.url

    // İlgili promoted_listings kayıtlarını sil (aynı URL)
    if (url) {
      const promoSnap = await getDocs(query(collection(db, 'promoted_listings'), where('url', '==', url)))
      for (const d of promoSnap.docs) {
        await deleteDoc(doc(db, 'promoted_listings', d.id))
      }
    }

    // İlanı sil
    await deleteDoc(doc(db, 'listings', listingDoc.id))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('delete-promoted-ad error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
