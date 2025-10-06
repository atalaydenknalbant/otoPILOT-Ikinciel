export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const res = await fetch('http://127.0.0.1:8080/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // ensure server-side fetch, no CORS from browser
      cache: 'no-store',
      // forward client aborts to backend fetch
      signal: (req as Request).signal,
    })
    const data = await res.json()
    return new Response(JSON.stringify(data), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: 'proxy_error', detail: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
