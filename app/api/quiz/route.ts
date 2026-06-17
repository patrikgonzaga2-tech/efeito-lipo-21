import { sbInsert, sbInsertIgnore, sbUpsert } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  id?: string
  action?: 'pageview' | 'start' | 'step' | 'complete' | 'checkout'
  variante?: string
  intro_ab?: string // teste A/B da 1ª tela: 'A' (original) | 'B' (nova)
  utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string; utm_term?: string
  sck?: string; referrer?: string; user_agent?: string
  reached_index?: number
  step_index?: number
  step_id?: string
  answer?: string
  answers?: Record<string, unknown>
  altura?: number | null
  peso?: number | null
  meta_peso?: number | null
}

export async function POST(req: Request) {
  let b: Body
  try { b = await req.json() } catch { return Response.json({ ok: false }, { status: 400 }) }

  const { id, action } = b
  if (!id || !action) return Response.json({ ok: false }, { status: 400 })

  const now = new Date().toISOString()

  try {
    if (action === 'pageview') {
      // Visualização real da 1ª tela (após alguns segundos visível — alinhado
      // ao Meta). insert-ignore: cria a sessão SÓ se ainda não existir; se a
      // pessoa já clicou em "começar" antes (sessão já 'started'/'completed'),
      // NÃO rebaixa o status de volta pra 'pageview'.
      await sbInsertIgnore('quiz_sessions', {
        id, status: 'pageview', reached_index: 0, updated_at: now,
        variante: b.variante ?? null, intro_ab: b.intro_ab ?? null,
        utm_source: b.utm_source ?? null, utm_medium: b.utm_medium ?? null,
        utm_campaign: b.utm_campaign ?? null, utm_content: b.utm_content ?? null, utm_term: b.utm_term ?? null,
        sck: b.sck ?? null, referrer: b.referrer ?? null, user_agent: b.user_agent ?? null,
      })
      await sbInsert('quiz_events', { session_id: id, event: 'pageview' })
    } else if (action === 'start') {
      await sbUpsert('quiz_sessions', {
        id, status: 'started', reached_index: 0, updated_at: now,
        variante: b.variante ?? null, intro_ab: b.intro_ab ?? null,
        utm_source: b.utm_source ?? null, utm_medium: b.utm_medium ?? null,
        utm_campaign: b.utm_campaign ?? null, utm_content: b.utm_content ?? null, utm_term: b.utm_term ?? null,
        sck: b.sck ?? null, referrer: b.referrer ?? null, user_agent: b.user_agent ?? null,
      })
      await sbInsert('quiz_events', { session_id: id, event: 'start' })
    } else if (action === 'step') {
      await sbUpsert('quiz_sessions', { id, reached_index: b.reached_index ?? 0, answers: b.answers ?? {}, updated_at: now })
      await sbInsert('quiz_events', { session_id: id, event: 'step', step_id: b.step_id ?? null, step_index: b.step_index ?? null, answer: b.answer ?? null })
    } else if (action === 'complete') {
      await sbUpsert('quiz_sessions', {
        id, status: 'completed', reached_index: b.reached_index ?? 0,
        altura: b.altura ?? null, peso: b.peso ?? null, meta_peso: b.meta_peso ?? null,
        answers: b.answers ?? {}, completed_at: now, updated_at: now,
      })
      await sbInsert('quiz_events', { session_id: id, event: 'complete' })
    } else if (action === 'checkout') {
      await sbUpsert('quiz_sessions', { id, checkout_clicked: true, checkout_at: now, updated_at: now })
      await sbInsert('quiz_events', { session_id: id, event: 'checkout' })
    }
    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: false }, { status: 200 })
  }
}
