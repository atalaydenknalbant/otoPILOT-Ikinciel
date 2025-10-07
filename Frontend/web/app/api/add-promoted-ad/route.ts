import { NextRequest, NextResponse } from 'next/server'
import { collection, addDoc, Timestamp } from 'firebase/firestore'
import { db } from '../../../lib/firebase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, url, brand, model, title, price, imageUrl, expiresDays } = body || {}

    if (!userId || !url) {
      return NextResponse.json({ error: 'userId ve url zorunludur' }, { status: 400 })
    }

    const createdAt = Timestamp.now()

    // listings kaydı
    await addDoc(collection(db, 'listings'), {
      userId,
      url,
      brand: brand || null,
      model: model || null,
      title: title || null,
      price: price || null,
      imageUrl: imageUrl || null,
      createdAt,
    })

    // promoted kaydı (brand ve model varsa mantıklı)
    if (brand && model) {
      const expiresAt = Timestamp.fromMillis(
        Date.now() + ((typeof expiresDays === 'number' && expiresDays > 0 ? expiresDays : 30) * 24 * 60 * 60 * 1000)
      )
      await addDoc(collection(db, 'promoted_listings'), {
        userId,
        url,
        brand,
        model,
        brand_lc: String(brand).toLowerCase(),
        model_lc: String(model).toLowerCase(),
        title: title || null,
        price: price || null,
        imageUrl: imageUrl || null,
        createdAt,
        expiresAt,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('add-promoted-ad error:', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
