import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL gerekli' }, { status: 400 })
    }

    // Backend'e istek gönder
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    const response = await fetch(`${backendUrl}/scrape-advert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) {
      throw new Error('Backend hatası')
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API hatası:', error)
    return NextResponse.json(
      { error: 'İlan bilgileri alınamadı' },
      { status: 500 }
    )
  }
}
