import { sbInsertIgnore } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Beacon de VISUALIZAÇÃO da página de upsell (/acompanhamento-up). O front manda
// um id de sessão do navegador; gravamos insert-ignore em upsell_views, então
// recargas na mesma sessão não recontam. É a etapa "foram pra página de upsell"
// do funil pós-compra (dashboard → aba Funil / Upsell).

type Body = { id?: string; slug?: string; xcod?: string }

export async function POST(req: Request) {
  let b: Body
  try { b = await req.json() } catch { return Response.json({ ok: false }, { status: 400 }) }
  if (!b.id) return Response.json({ ok: false }, { status: 400 })

  try {
    await sbInsertIgnore('upsell_views', {
      id: b.id,
      slug: b.slug || 'acompanhamento-up',
      xcod: b.xcod ?? null,
      viewed_at: new Date().toISOString(),
    })
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 500 })
  }
}
