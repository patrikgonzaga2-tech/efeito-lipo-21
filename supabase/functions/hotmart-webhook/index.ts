// ════════════════════════════════════════════════════════════════════
// Edge Function: hotmart-webhook
// Recebe os avisos de venda da Hotmart e grava na tabela public.vendas.
//
// URL final (depois de publicar):
//   https://fjlbvoephhextnxemygf.supabase.co/functions/v1/hotmart-webhook
//
// Segurança: a Hotmart manda um token ("hottok"). A função compara com o
// segredo HOTMART_HOTTOK e RECUSA qualquer aviso sem o token certo — assim
// ninguém consegue inventar vendas no seu banco.
//
// Sem SDK: usa fetch puro contra o PostgREST, no mesmo estilo de lib/supabase.ts.
// ════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const HOTTOK = (Deno.env.get('HOTMART_HOTTOK') ?? '').trim()

// Converte timestamp da Hotmart (milissegundos) em ISO. Tolera ausência.
function toISO(ms: unknown): string | null {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(n).toISOString()
}

// Pega o primeiro valor definido de uma lista de caminhos (defensivo: o
// payload da Hotmart varia entre produtos/versões).
function pick(...vals: unknown[]): any {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v
  return null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // ── Segurança: confere o token (header X-HOTMART-HOTTOK ou campo no corpo) ──
  const sent = (req.headers.get('x-hotmart-hottok') ?? body?.hottok ?? '').toString().trim()
  if (!HOTTOK || sent !== HOTTOK) {
    console.warn('[hotmart-webhook] token inválido — aviso recusado')
    return new Response('Unauthorized', { status: 401 })
  }

  // A Hotmart v2 aninha tudo em "data"; a v1 manda mais raso. Cobre os dois.
  const data = body?.data ?? body
  const purchase = data?.purchase ?? {}
  const buyer = data?.buyer ?? {}
  const product = data?.product ?? {}
  const tracking = purchase?.tracking ?? {}
  // A Hotmart v2 manda o rastreio em purchase.origin (sck/src/xcod). Versões/
  // produtos antigos usam purchase.tracking. Lemos os dois, origin primeiro.
  const origin = purchase?.origin ?? {}
  const payment = purchase?.payment ?? {}
  const subscription = data?.subscription ?? {}

  // Comissão do produtor (quanto sobra pra você), quando vier.
  let producerValue: number | null = null
  const commissions = data?.commissions ?? data?.commission ?? []
  if (Array.isArray(commissions)) {
    const prod = commissions.find((c: any) => (c?.source ?? '').toUpperCase() === 'PRODUCER')
    if (prod) producerValue = Number(prod.value ?? prod.amount) || null
  }

  const row = {
    hotmart_event_id: pick(body?.id, body?.event_id, purchase?.transaction),
    event: pick(body?.event, data?.event),
    status: pick(purchase?.status, data?.status),
    transaction: pick(purchase?.transaction, data?.transaction),

    product_id: pick(product?.id, product?.ucode)?.toString() ?? null,
    product_name: pick(product?.name),
    offer_code: pick(purchase?.offer?.code, data?.offer?.code),

    buyer_email: pick(buyer?.email),
    buyer_name: pick(buyer?.name),
    buyer_phone: pick(buyer?.checkout_phone, buyer?.phone),
    buyer_doc: pick(buyer?.document, buyer?.documment),

    price: Number(pick(purchase?.price?.value, purchase?.full_price?.value)) || null,
    full_price: Number(pick(purchase?.full_price?.value, purchase?.price?.value)) || null,
    producer_value: producerValue,
    currency: pick(purchase?.price?.currency_value, purchase?.price?.currency_code, 'BRL'),
    payment_method: pick(payment?.type, payment?.method),
    installments: Number(pick(payment?.installments_number)) || null,

    tracking_src: pick(origin?.src, tracking?.source, tracking?.src),
    tracking_sck: pick(origin?.sck, tracking?.source_sck, tracking?.sck),
    tracking_xcod: pick(origin?.xcod, tracking?.xcod),

    subscription_status: pick(subscription?.status),
    plan_name: pick(subscription?.plan?.name),
    subscriber_code: pick(subscription?.subscriber?.code),

    order_date: toISO(pick(purchase?.order_date, purchase?.date)),
    approved_date: toISO(pick(purchase?.approved_date, purchase?.date_next_charge)),

    raw: body,
  }

  // Grava. on_conflict no hotmart_event_id + ignore-duplicates: se a Hotmart
  // reenviar o MESMO aviso, não duplica a linha.
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/vendas?on_conflict=hotmart_event_id`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify(row),
      },
    )
    if (!res.ok) {
      console.error('[hotmart-webhook] grava falhou:', res.status, await res.text())
      // Responde 200 mesmo assim: a Hotmart desativa o webhook se levar muitos
      // erros. Já temos o log acima pra investigar.
      return new Response('stored-with-warning', { status: 200 })
    }
  } catch (e) {
    console.error('[hotmart-webhook] erro de rede:', e)
    return new Response('error-logged', { status: 200 })
  }

  return new Response('ok', { status: 200 })
})
