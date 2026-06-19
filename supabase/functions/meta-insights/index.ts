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
// Segredos: META_ACCESS_TOKEN (ads_read), META_AD_ACCOUNT_ID (não usado aqui,
// mas mantido p/ referência). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY do ambiente.
// ════════════════════════════════════════════════════════════════════

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const META_TOKEN = (Deno.env.get('META_ACCESS_TOKEN') ?? '').trim()
const API = 'https://graph.facebook.com/v25.0'

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

Deno.serve(async (req) => {
  if (!META_TOKEN) {
    return Response.json({ ok: false, error: 'falta META_ACCESS_TOKEN' }, { status: 500 })
  }
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
  const rows: Record<string, unknown>[] = []
  const erros: { ad_id: string; error: unknown }[] = []
  const nowIso = new Date().toISOString()

  for (const adId of adIds) {
    const url =
      `${API}/${adId}/insights?fields=${fields}` +
      `&time_range=${timeRange}&time_increment=1&limit=500` +
      `&access_token=${encodeURIComponent(META_TOKEN)}`
    try {
      const res = await fetch(url)
      const j = await res.json()
      if (!res.ok || j.error) { erros.push({ ad_id: adId, error: j.error ?? `HTTP ${res.status}` }); continue }
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
    } catch (e) {
      erros.push({ ad_id: adId, error: String(e) })
    }
  }

  // 3) Upsert (merge por ad_id+date).
  if (rows.length > 0) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/meta_insights?on_conflict=ad_id,date`, {
        method: 'POST',
        headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
      })
      if (!res.ok) return Response.json({ ok: false, step: 'gravar', error: await res.text() }, { status: 502 })
    } catch (e) {
      return Response.json({ ok: false, step: 'gravar', error: String(e) }, { status: 502 })
    }
  }

  return Response.json({ ok: true, since, until, anuncios: adIds.length, gravadas: rows.length, falhas: erros.length })
})
