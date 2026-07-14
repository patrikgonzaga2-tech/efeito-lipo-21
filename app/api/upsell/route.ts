import { sbInsertIgnore } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Beacon de VISUALIZAÇÃO da página de upsell (/acompanhamento-up). O front manda
// um id de sessão do navegador; gravamos insert-ignore em upsell_views, então
// recargas na mesma sessão não recontam. É a etapa "foram pra página de upsell"
// do funil pós-compra (dashboard → aba Funil / Upsell).

// canal   = 'pagina' (redirect pós-compra), 'wa' (link do WhatsApp) ou o que
//           vier no ?c= da URL. msg = código da mensagem do roteiro (?m=).
// sale_id = s_id da Greenn = número da compra do Efeito Lipo que originou a
//           visita — é a ponte entre a visualização e a venda do upsell.
// Limitamos o tamanho: são campos que vêm da URL, ou seja, de fora.
type Body = { id?: string; slug?: string; xcod?: string; canal?: string; msg?: string; sale_id?: string }

const clean = (v: unknown, max = 40) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null

export async function POST(req: Request) {
  let b: Body
  try { b = await req.json() } catch { return Response.json({ ok: false }, { status: 400 }) }
  if (!b.id) return Response.json({ ok: false }, { status: 400 })

  try {
    await sbInsertIgnore('upsell_views', {
      id: b.id,
      slug: b.slug || 'acompanhamento-up',
      xcod: b.xcod ?? null,
      canal: clean(b.canal) ?? 'pagina',
      msg: clean(b.msg),
      sale_id: clean(b.sale_id, 24),
      viewed_at: new Date().toISOString(),
    })
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 500 })
  }
}
