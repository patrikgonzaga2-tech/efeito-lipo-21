import { cookies } from 'next/headers'
import { sbRpc, sbSelect, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'
import { SortableTable, type Metrics, type Row } from '../_sortable'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Anúncios — Efeito Lipo', robots: { index: false, follow: false } }

type Funnel = { spend: number; impressions: number; link_clicks: number; lp_views: number; ic: number; purchases: number; purchase_value: number }
type Conj = Funnel & { adset_id: string; adset_name: string | null; campaign_id: string | null; campaign_name: string | null }
type Ad = Funnel & { ad_id: string; ad_name: string | null; adset_name: string | null; campaign_name: string | null }

const N = (v: unknown) => Number(v) || 0
// Normaliza os números crus (o PostgREST devolve numeric como string).
const mOf = (x: Funnel): Metrics => ({
  spend: N(x.spend), impressions: N(x.impressions), link_clicks: N(x.link_clicks),
  lp_views: N(x.lp_views), ic: N(x.ic), purchases: N(x.purchases), purchase_value: N(x.purchase_value),
})
const add = (a: Metrics, x: Funnel): Metrics => ({
  spend: a.spend + N(x.spend), impressions: a.impressions + N(x.impressions), link_clicks: a.link_clicks + N(x.link_clicks),
  lp_views: a.lp_views + N(x.lp_views), ic: a.ic + N(x.ic), purchases: a.purchases + N(x.purchases), purchase_value: a.purchase_value + N(x.purchase_value),
})
const ZERO: Metrics = { spend: 0, impressions: 0, link_clicks: 0, lp_views: 0, ic: 0, purchases: 0, purchase_value: 0 }

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>{title}</h2>
      {note && <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 10 }}>{note}</p>}
      <div style={{ marginTop: note ? 0 : 10 }}>{children}</div>
    </section>
  )
}

export default async function AnunciosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="anuncios"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  const [conjuntos, ads, statusList] = await Promise.all([
    sbRpc<Conj>('ranking_conjuntos', { p_since: since, p_until: until }),
    sbRpc<Ad>('ranking_anuncios', { p_since: since, p_until: until }),
    sbSelect<{ id: string; status: string }>('meta_status', 'select=id,status'),
  ])
  const statusOf = new Map(statusList.map((s) => [s.id, s.status]))

  // Campanhas = soma os conjuntos por campanha (ativa se algum conjunto ativo).
  const campMap = new Map<string, { name: string; active: boolean; m: Metrics }>()
  for (const c of conjuntos) {
    if (N(c.spend) <= 0) continue
    const key = c.campaign_id || c.adset_id
    const e = campMap.get(key) || { name: c.campaign_name || '(sem campanha)', active: false, m: { ...ZERO } }
    e.m = add(e.m, c)
    if (statusOf.get(c.adset_id) === 'ACTIVE') e.active = true
    campMap.set(key, e)
  }
  const campRows: Row[] = [...campMap.entries()]
    .map(([id, e]) => ({ id, lead: [e.name], status: e.active ? 'ACTIVE' : 'PAUSED', m: e.m }))
  const conjRows: Row[] = conjuntos.filter((c) => N(c.spend) > 0)
    .map((c) => ({ id: c.adset_id, lead: [c.adset_name, c.campaign_name], status: statusOf.get(c.adset_id), m: mOf(c) }))
  const adRows: Row[] = ads.filter((a) => N(a.spend) > 0)
    .map((a) => ({ id: a.ad_id, lead: [a.ad_name, a.adset_name], status: statusOf.get(a.ad_id), m: mOf(a) }))

  return (
    <DashboardShell active="anuncios">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Anúncios</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Funil completo por campanha, conjunto e anúncio. Clique em qualquer métrica (ou Status) para ordenar.</p>
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <Section title="Campanhas" note="Clique numa coluna para ordenar">
        <SortableTable leadHead={['Campanha']} rows={campRows} hasStatus defaultSort="spend" />
      </Section>
      <Section title="Conjuntos" note="Clique numa coluna para ordenar">
        <SortableTable leadHead={['Conjunto', 'Campanha']} rows={conjRows} hasStatus defaultSort="spend" />
      </Section>
      <Section title="Anúncios" note="Clique numa coluna para ordenar · padrão: compras">
        <SortableTable leadHead={['Anúncio', 'Conjunto']} rows={adRows} showRank hasStatus defaultSort="purchases" />
      </Section>
    </DashboardShell>
  )
}
