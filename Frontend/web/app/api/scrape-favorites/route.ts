import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json()

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Geçerli URL listesi gerekli' }, { status: 400 })
    }

    // Backend'e favori URL'lerini gönder
    const backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8080'
    
    const response = await fetch(`${backendUrl}/scrape-favorites`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ urls })
    })

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Favori scraping hatası:', error)
    return NextResponse.json(
      { error: 'Favori verileri çekilirken hata oluştu' },
      { status: 500 }
    )
  }
}
