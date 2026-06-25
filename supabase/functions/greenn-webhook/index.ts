// ════════════════════════════════════════════════════════════════════
// Edge Function: greenn-webhook
// Recebe os avisos de venda da Greenn e grava na MESMA tabela public.vendas
// usada pela Hotmart. O segredo aqui é TRADUZIR o jeito da Greenn para o
// vocabulário que o dashboard já entende (padrão Hotmart) — assim as funções
// vendas_por_produto / funil_resumo continuam funcionando sem reescrever nada.
//
// URL final (depois de publicar):
//   https://fjlbvoephhextnxemygf.supabase.co/functions/v1/greenn-webhook?token=SEGREDO
//
// Segurança: a Greenn NÃO tem um "hottok" como a Hotmart. Então protegemos a
// função com um token secreto NA URL (?token=...), comparado com o segredo
// GREENN_WEBHOOK_TOKEN. Sem o token certo, o aviso é RECUSADO — ninguém
// consegue inventar vendas no seu banco.
//
// ⚠️ MODO DEFENSIVO: escrito ANTES de ver um payload real da Greenn. A doc
// oficial mostra os campos vazios, então lemos vários caminhos possíveis para
// cada dado (pick) e guardamos o payload inteiro em `raw`. Quando a primeira
// venda real cair, conferimos os nomes exatos (sobretudo o rastreio em
// saleMetas) e ajustamos o que precisar — nada se perde nesse meio-tempo.
//
// Sem SDK: usa fetch puro contra o PostgREST, no mesmo estilo da hotmart-webhook.
// ════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_TOKEN = (Deno.env.get('GREENN_WEBHOOK_TOKEN') ?? '').trim()

// Pega o primeiro valor "de verdade" de uma lista de caminhos possíveis.
function pick(...vals: unknown[]): any {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v
  return null
}

// Converte data da Greenn em ISO. CONFIRMADO no payload real: a Greenn manda em
// UTC com "Z" (ex.: "2026-06-25T21:01:22.000000Z") — então respeitamos o fuso que
// vier. Só assumimos horário de Brasília (-03:00) se a data vier SEM fuso
// (ex.: "2021-09-24 18:10:30"), por segurança. Tolera também epoch.
function toISO(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number') {
    const d = new Date(v)
    return isFinite(d.getTime()) ? d.toISOString() : null
  }
  const s = String(v).trim()
  // Tem fuso explícito (Z ou ±HH:MM)? Respeita como veio.
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s)
    return isFinite(d.getTime()) ? d.toISOString() : null
  }
  // Sem fuso: assume horário de Brasília (-03:00).
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/)
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}-03:00`)
    return isFinite(d.getTime()) ? d.toISOString() : null
  }
  const d = new Date(s)
  return isFinite(d.getTime()) ? d.toISOString() : null
}

// Traduz o status da Greenn → evento/status no vocabulário do dashboard (Hotmart).
// O dashboard só CONTA venda em PURCHASE_APPROVED e reembolso em
// PURCHASE_REFUNDED / PURCHASE_CHARGEBACK. Os demais entram como histórico.
function mapStatus(status: unknown): { event: string; status: string | null } {
  switch (String(status ?? '').toLowerCase()) {
    case 'paid':            return { event: 'PURCHASE_APPROVED',        status: 'APPROVED' }
    case 'refunded':        return { event: 'PURCHASE_REFUNDED',        status: 'REFUNDED' }
    case 'chargedback':     return { event: 'PURCHASE_CHARGEBACK',      status: 'CHARGEBACK' }
    case 'waiting_payment': return { event: 'PURCHASE_WAITING_PAYMENT', status: 'WAITING_PAYMENT' }
    case 'refused':         return { event: 'PURCHASE_REFUSED',         status: 'REFUSED' }
    case 'created':         return { event: 'PURCHASE_CREATED',         status: 'CREATED' }
    case 'canceled':
    case 'cancelled':       return { event: 'PURCHASE_CANCELED',        status: 'CANCELED' }
    default: {
      const up = String(status ?? '').toUpperCase()
      return { event: up ? `GREENN_${up}` : 'GREENN_UNKNOWN', status: up || null }
    }
  }
}

// O rastreio da Greenn vem num array saleMetas: [{ meta_key, meta_value }, ...].
// Achatamos para um dicionário { src: ..., utm_term: ... } pra consultar fácil.
function metasToMap(metas: unknown): Record<string, any> {
  const map: Record<string, any> = {}
  if (Array.isArray(metas)) {
    for (const m of metas) {
      const k = pick((m as any)?.meta_key, (m as any)?.key, (m as any)?.name)
      const v = pick((m as any)?.meta_value, (m as any)?.value)
      if (k != null) map[String(k).toLowerCase().trim()] = v
    }
  }
  return map
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  // ── Segurança: token na URL (?token=) ou no header / corpo ──
  let bodyText = ''
  let body: any
  try {
    bodyText = await req.text()
    body = JSON.parse(bodyText)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const url = new URL(req.url)
  const sent = (
    url.searchParams.get('token') ??
    req.headers.get('x-greenn-token') ??
    body?.token ??
    ''
  ).toString().trim()
  if (!WEBHOOK_TOKEN || sent !== WEBHOOK_TOKEN) {
    console.warn('[greenn-webhook] token inválido — aviso recusado')
    return new Response('Unauthorized', { status: 401 })
  }

  // A Greenn pode aninhar em "data" em algumas versões; cobrimos os dois.
  const data = body?.data ?? body
  const sale = data?.sale ?? data?.transaction ?? {}
  const product = data?.product ?? {}
  const client = data?.client ?? data?.buyer ?? data?.customer ?? {}
  const seller = data?.seller ?? {}
  const metas = metasToMap(data?.saleMetas ?? data?.sale_metas ?? body?.saleMetas)

  // ── Só processamos VENDAS (type "sale" / event "saleUpdated") ──
  // A Greenn manda no MESMO webhook eventos de "contract" (status da assinatura:
  // criada/ativa/encerrada). Esses NÃO são vendas — o dinheiro entra pelos
  // eventos de venda (cada cobrança vira um saleUpdated). Ignoramos os demais
  // pra não sujar a tabela. (Tudo do contrato segue disponível se um dia
  // quisermos medir churn de assinatura.)
  const evType = String(pick(body?.type, data?.type) ?? '').toLowerCase()
  const evName = String(pick(body?.event, data?.event) ?? '').toLowerCase()
  const isSale = evType === 'sale' || evName === 'saleupdated' || (sale && (sale.id || sale.status))
  if (!isSale) {
    // Evento de ASSINATURA (contract): grava na tabela `assinaturas` (não em
    // vendas). É o que permite medir MRR/churn da Comunidade. Mesmo padrão da
    // venda: dedup por contrato+status, payload inteiro em raw.
    const isContract = evType === 'contract' || evName === 'contractupdated' || !!data?.contract
    if (isContract) {
      const contract = data?.contract ?? {}
      const currentSale = data?.currentSale ?? data?.sale ?? {}
      const cstatus = String(pick(data?.currentStatus, contract?.status) ?? '').toLowerCase()
      const cid = pick(contract?.id, data?.contract_id)?.toString() ?? null
      const arow = {
        gateway: 'greenn',
        greenn_event_id: cid ? `greenn-contract-${cid}-${cstatus || 'na'}` : null,
        event: pick(body?.event, data?.event),
        contract_id: cid,
        subscription_id: pick(currentSale?.subscription_id, data?.subscription_id)?.toString() ?? null,
        status: cstatus || null,
        old_status: pick(data?.oldStatus, data?.old_status),
        product_id: pick(product?.id)?.toString() ?? null,
        product_name: pick(product?.name),
        plan_amount: Number(pick(product?.amount, data?.offer?.amount, currentSale?.amount)) || null,
        plan_period_days: Number(pick(product?.period)) || null,
        buyer_email: pick(client?.email),
        buyer_name: pick(client?.name),
        started_at: toISO(pick(contract?.start_date, contract?.created_at)),
        current_period_end: toISO(pick(contract?.current_period_end)),
        raw: body,
      }
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/assinaturas?on_conflict=greenn_event_id`,
          {
            method: 'POST',
            headers: {
              apikey: SERVICE_KEY,
              Authorization: `Bearer ${SERVICE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=ignore-duplicates,return=minimal',
            },
            body: JSON.stringify(arow),
          },
        )
        if (!res.ok) console.error('[greenn-webhook] assinatura grava falhou:', res.status, await res.text())
      } catch (e) {
        console.error('[greenn-webhook] assinatura erro de rede:', e)
      }
      return new Response('subscription-stored', { status: 200 })
    }
    console.log('[greenn-webhook] evento ignorado:', evType || evName || '?')
    return new Response('ignored', { status: 200 })
  }

  // Status: a Greenn manda no topo (currentStatus); fallback p/ sale.status.
  const rawStatus = pick(data?.currentStatus, data?.current_status, sale?.status)
  const mapped = mapStatus(rawStatus)

  // Id da compra. Na Greenn o sale.id se REPETE a cada mudança de status, então
  // ele é a nossa `transaction` (igual entre os avisos da mesma compra).
  const saleId = pick(sale?.id, data?.sale_id, data?.id)?.toString() ?? null

  // Chave anti-duplicação: combina compra + status. Assim cada transição
  // (created → paid → refunded) vira UMA linha, mas reenvios do MESMO aviso não
  // duplicam. (Vai na coluna hotmart_event_id, que aqui funciona como "id único
  // do evento" — o nome é histórico, o papel é genérico.)
  const eventKey = saleId ? `greenn-${saleId}-${String(rawStatus ?? 'na').toLowerCase()}` : null

  const row = {
    gateway: 'greenn',

    hotmart_event_id: eventKey,
    event: mapped.event,
    status: mapped.status,
    transaction: saleId,

    product_id: pick(product?.id, product?.product_id)?.toString() ?? null,
    product_name: pick(product?.name, product?.title),
    offer_code: pick(product?.offer, data?.offer?.hash, data?.offer?.code),

    buyer_email: pick(client?.email),
    buyer_name: pick(client?.name, client?.full_name),
    buyer_phone: pick(client?.cellphone, client?.phone, client?.cell_phone),
    buyer_doc: pick(client?.cpf_cnpj, client?.document, client?.cpf),

    // Valores. CONFIRMADO no payload real:
    //   sale.amount  = valor pago pelo cliente (ex.: 210)
    //   sale.fee     = taxa da Greenn (ex.: 23.78)
    //   sale.seller_balance = LÍQUIDO que sobra pro produtor (ex.: 186.22) ← este!
    price: Number(pick(sale?.amount, sale?.total, product?.amount)) || null,
    full_price: Number(pick(product?.amount, data?.offer?.amount, sale?.amount)) || null,
    producer_value: Number(pick(sale?.seller_balance, sale?.net_amount, sale?.liquid_amount, seller?.amount)) || null,
    currency: pick(data?.currency, sale?.currency, 'BRL'),
    payment_method: pick(sale?.method, sale?.payment_method),
    installments: Number(pick(sale?.installments, sale?.installment)) || null,

    // Rastreio (a ponte com o Meta / quiz). CONFIRMADO: a regra do dashboard é
    // tracking_src = utm_term = id do CONJUNTO de anúncios (numérico). O xcod é a
    // ponte pro ANÚNCIO (nome via quiz_sessions.utm_content). Guardamos também o
    // utm_source em tracking_sck pra não perder a origem ("comercial", "organico"
    // etc). Vendas orgânicas/comerciais não têm utm_term → corretamente ficam sem
    // conjunto. Tudo fica em raw de qualquer forma.
    tracking_src: pick(metas['utm_term'], metas['src']),
    tracking_sck: pick(metas['sck'], metas['utm_source']),
    tracking_xcod: pick(metas['xcod'], metas['utm_content']),

    subscription_status: pick(data?.contract?.status, data?.subscription?.status),
    plan_name: pick(data?.subscription?.plan?.name, String(product?.type ?? '').toUpperCase() === 'SUBSCRIPTION' ? product?.name : null),
    subscriber_code: pick(sale?.subscription_id, data?.contract?.id, data?.subscription?.id)?.toString() ?? null,

    order_date: toISO(pick(sale?.created_at, data?.created_at)),
    approved_date: toISO(pick(sale?.paid_at, mapped.event === 'PURCHASE_APPROVED' ? sale?.updated_at : null)),

    raw: body,
  }

  // Grava. on_conflict no hotmart_event_id + ignore-duplicates: se a Greenn
  // reenviar o MESMO aviso (mesma compra + mesmo status), não duplica a linha.
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
      console.error('[greenn-webhook] grava falhou:', res.status, await res.text())
      // Responde 200 mesmo assim: gateways desativam o webhook se levarem muitos
      // erros. O log acima já serve pra investigar.
      return new Response('stored-with-warning', { status: 200 })
    }
  } catch (e) {
    console.error('[greenn-webhook] erro de rede:', e)
    return new Response('error-logged', { status: 200 })
  }

  return new Response('ok', { status: 200 })
})
