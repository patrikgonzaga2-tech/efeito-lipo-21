export const runtime = 'nodejs'

export async function POST(req: Request) {
  let password = ''
  try { password = (await req.json())?.password || '' } catch { /* noop */ }

  const expected = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!expected || password !== expected) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  const cookie = `qd_auth=${encodeURIComponent(password)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${secure}`
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
  })
}
