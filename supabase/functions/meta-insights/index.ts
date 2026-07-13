// ════════════════════════════════════════════════════════════════════
// Edge Function: meta-insights
// Busca na Marketing API do Meta o gasto por ANÚNCIO, por DIA, e grava em
// public.meta_insights (upsert por ad_id+date). Roda de hora em hora (cron).
//
// IMPORTANTE — granularidade = CONJUNTO (adset), não anúncio:
// o utm_term que cai em vendas.tracking_src é o ID DO CONJUNTO (adset.id), não
// do anúncio. (O nome do anúncio vai em utm_content.) Então consultamos o
// /insights de cada id rastreado (view tracked_ad_ids) — o Meta devolve o gasto
// do conjunto, casando pelo MESMO id que veio no link. A coluna `ad_id` guarda
// esse id (= adset.id) por ser a chave de junção com tracking_src.
//
// Re-busca uma janela dos últimos dias a cada execução (o Meta ajusta números
// retroativamente). ?days=N controla a janela (padrão 4; use grande p/ backfill).
//
// ORÇAMENTO DE TEMPO: a Edge Function é morta pelo Supabase aos 150s. A lista de
// ids rastreados só cresce, então as chamadas ao Meta rodam em PARALELO (pool) e
// os lotes são gravados ENQUANTO avançam — nunca "tudo no fim". Se o tempo apertar,
// paramos cedo e gravamos o que já veio (o próximo run completa o resto).
//
// Segredos: META_ACCESS_TOKEN (ads_read), META_AD_ACCOUNT_ID (não usado aqui,
// mas mantido p/ referência). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY do ambiente.
// ════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const META_TOKEN = (Deno.env.get('META_ACCESS_TOKEN') ?? '').trim()
const API = 'https://graph.facebook.com/v25.0'

// Quantos conjuntos processamos ao mesmo tempo, e quando desistimos de começar
// um novo (deixando folga para gravar o que já foi coletado antes dos 150s).
const CONCURRENCY = 10
const TIME_BUDGET_MS = 110_000

function spDate(offsetDays = 0): string {
  const d = new Date(Date.now() - offsetDays * 86400000)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
const num = (v: unknown) => (v === undefined || v === null || v === '' ? null : Number(v))
const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}

// Upsert com merge por chave. Devolve o erro (texto) ou null.
async function upsert(table: string, onConflict: string, body: Record<string, unknown>[]): Promise<string | null> {
  if (body.length === 0) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(body),
    })
    return res.ok ? null : await res.text()
  } catch (e) {
    return String(e)
  }
}

Deno.serve(async (req) => {
  if (!META_TOKEN) {
    return Response.json({ ok: false, error: 'falta META_ACCESS_TOKEN' }, { status: 500 })
  }
  const t0 = Date.now()
  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 4, 1), 400)
  const since = spDate(days - 1)
  const until = spDate(0)
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }))

  // 1) Lista de anúncios que aparecem nas nossas sessões/vendas.
  let adIds: string[] = []
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/tracked_ad_ids?select=ad_id`, { headers: sbHeaders, cache: 'no-store' })
    if (!res.ok) return Response.json({ ok: false, step: 'lista-ids', error: await res.text() }, { status: 502 })
    adIds = ((await res.json()) as { ad_id: string }[]).map((r) => r.ad_id).filter(Boolean)
  } catch (e) {
    return Response.json({ ok: false, step: 'lista-ids', error: String(e) }, { status: 502 })
  }
  if (adIds.length === 0) return Response.json({ ok: true, since, until, gravadas: 0, nota: 'sem ids rastreados' })

  // 2) Para cada id (= adset.id), 1 chamada ao /insights dele (dia a dia).
  //    Os nomes de conjunto/campanha vêm como campos do próprio insights.
  //    O funil (page view, IC, compras) vem do array `actions`.
  const fields = 'adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,inline_link_clicks,reach,ctr,cpc,cpm,actions,action_values,date_start'
  // Extrai o valor de uma ação (ex: landing_page_view) do array do Meta.
  const act = (arr: { action_type?: string; value?: string }[] | undefined, type: string): number | null => {
    const a = (arr ?? []).find((x) => x.action_type === type)
    return a ? Number(a.value) : null
  }
  // Campos da chamada level=ad (1 linha por anúncio/dia dentro do conjunto).
  const adFields = 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,inline_link_clicks,ctr,cpc,cpm,actions,action_values,date_start'
  const rows: Record<string, unknown>[] = []      // nível conjunto → meta_insights
  const adRows: Record<string, unknown>[] = []    // nível anúncio → meta_ads
  const statusRows: Record<string, unknown>[] = [] // ativo/pausado → meta_status
  const erros: { ad_id: string; error: unknown }[] = []
  const falhasGravacao: string[] = []
  const nowIso = new Date().toISOString()
  let processados = 0
  let pulados = 0
  let gravadas = 0
  let anuncios = 0

  // Descarrega o que já foi coletado e esvazia os buffers. Chamado durante o
  // loop (a cada lote) e no fim — assim um estouro de tempo nunca zera o run.
  async function flush() {
    const loteRows = rows.splice(0)
    const loteAds = adRows.splice(0)
    const [a, b] = await Promise.all([
      upsert('meta_insights', 'ad_id,date', loteRows),
      upsert('meta_ads', 'ad_id,date', loteAds),
    ])
    // Status é acessório: não derruba o run se falhar.
    await upsert('meta_status', 'id', statusRows.splice(0))
    if (a) falhasGravacao.push(`meta_insights: ${a}`)
    else gravadas += loteRows.length
    if (b) falhasGravacao.push(`meta_ads: ${b}`)
    else anuncios += loteAds.length
  }

  // Coleta os 3 recortes de UM conjunto (insights do conjunto, dos seus anúncios
  // e o status de ambos). Vários destes rodam em paralelo — ver o pool abaixo.
  async function coletar(adId: string) {
    const url =
      `${API}/${adId}/insights?fields=${fields}` +
      `&time_range=${timeRange}&time_increment=1&limit=500` +
      `&access_token=${encodeURIComponent(META_TOKEN)}`
    try {
      const res = await fetch(url)
      const j = await res.json()
      if (!res.ok || j.error) { erros.push({ ad_id: adId, error: j.error ?? `HTTP ${res.status}` }); return }
      for (const d of j.data ?? []) {
        rows.push({
          ad_id: adId, // = adset.id (chave de junção com vendas.tracking_src)
          date: d.date_start,
          ad_name: d.adset_name ?? null, // rótulo legível (nome do conjunto)
          adset_id: d.adset_id ?? adId,
          adset_name: d.adset_name ?? null,
          campaign_id: d.campaign_id ?? null,
          campaign_name: d.campaign_name ?? null,
          spend: num(d.spend),
          impressions: num(d.impressions),
          clicks: num(d.clicks),
          link_clicks: num(d.inline_link_clicks) ?? act(d.actions, 'link_click'),
          lp_views: act(d.actions, 'landing_page_view'),
          ic: act(d.actions, 'initiate_checkout'),
          purchases: act(d.actions, 'purchase'),
          purchase_value: act(d.action_values, 'purchase'),
          reach: num(d.reach),
          ctr: num(d.ctr),
          cpc: num(d.cpc),
          cpm: num(d.cpm),
          currency: 'BRL',
          updated_at: nowIso,
        })
      }

      // 2b) Anúncios do conjunto (level=ad) → meta_ads.
      const adUrl =
        `${API}/${adId}/insights?level=ad&fields=${adFields}` +
        `&time_range=${timeRange}&time_increment=1&limit=500` +
        `&access_token=${encodeURIComponent(META_TOKEN)}`
      const adRes = await fetch(adUrl)
      const adJson = await adRes.json()
      if (adRes.ok && !adJson.error) {
        for (const a of adJson.data ?? []) {
          adRows.push({
            ad_id: a.ad_id,
            date: a.date_start,
            ad_name: a.ad_name ?? null,
            adset_id: a.adset_id ?? adId,
            adset_name: a.adset_name ?? null,
            campaign_id: a.campaign_id ?? null,
            campaign_name: a.campaign_name ?? null,
            spend: num(a.spend),
            impressions: num(a.impressions),
            link_clicks: num(a.inline_link_clicks) ?? act(a.actions, 'link_click'),
            lp_views: act(a.actions, 'landing_page_view'),
            ic: act(a.actions, 'initiate_checkout'),
            purchases: act(a.actions, 'purchase'),
            purchase_value: act(a.action_values, 'purchase'),
            ctr: num(a.ctr),
            cpc: num(a.cpc),
            cpm: num(a.cpm),
            updated_at: nowIso,
          })
        }
      }

      // 2c) Status (ativo/pausado) do conjunto e dos seus anúncios.
      const stUrl =
        `${API}/${adId}?fields=effective_status,ads.limit(200){id,effective_status}` +
        `&access_token=${encodeURIComponent(META_TOKEN)}`
      const stRes = await fetch(stUrl)
      const stJson = await stRes.json()
      if (stRes.ok && !stJson.error) {
        statusRows.push({ id: adId, level: 'adset', status: stJson.effective_status ?? null, updated_at: nowIso })
        for (const a of stJson.ads?.data ?? []) {
          statusRows.push({ id: a.id, level: 'ad', status: a.effective_status ?? null, updated_at: nowIso })
        }
      }
    } catch (e) {
      erros.push({ ad_id: adId, error: String(e) })
    }
  }

  // Pool: CONCURRENCY conjuntos por vez, gravando a cada lote. Se o orçamento de
  // tempo acabar, para de começar novos (os que faltam entram no próximo run).
  for (let i = 0; i < adIds.length; i += CONCURRENCY) {
    if (Date.now() - t0 > TIME_BUDGET_MS) { pulados = adIds.length - i; break }
    const lote = adIds.slice(i, i + CONCURRENCY)
    await Promise.all(lote.map(coletar))
    processados += lote.length
    await flush()
  }
  await flush()

  return Response.json({
    ok: falhasGravacao.length === 0,
    since,
    until,
    conjuntos: adIds.length,
    processados,
    pulados,
    gravadas,
    anuncios,
    falhas: erros.length,
    erro_exemplo: erros[0]?.error ?? null,
    falhas_gravacao: falhasGravacao,
    segundos: Math.round((Date.now() - t0) / 1000),
  })
})
