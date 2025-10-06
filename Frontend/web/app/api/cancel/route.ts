export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const runId = req.headers.get('x-run-id') || ''
    const res = await fetch('http://127.0.0.1:8080/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(runId ? { 'x-run-id': runId } : {}) },
      body: JSON.stringify({ runId }),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    return new Response(JSON.stringify(data), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ error: 'proxy_error', detail: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

