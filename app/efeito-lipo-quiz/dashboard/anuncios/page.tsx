import { cookies } from 'next/headers'
import { sbRpc, sbSelect, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Anúncios — Efeito Lipo', robots: { index: false, follow: false } }

// Base de métricas (mesma forma em campanha, conjunto e anúncio).
type Funnel = { spend: number; impressions: number; link_clicks: number; lp_views: number; ic: number; purchases: number; purchase_value: number }
type Conj = Funnel & { adset_id: string; adset_name: string | null; campaign_id: string | null; campaign_name: string | null }
type Ad = Funnel & { ad_id: string; ad_name: string | null; adset_name: string | null; campaign_name: string | null }

const N = (v: unknown) => Number(v) || 0
const brl = (n: number) => 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')

// Selo de status (ativo/pausado/reprovado) a partir do effective_status do Meta.
function StatusBadge({ status }: { status?: string }) {
  const s = status || ''
  let txt = 'Pausado', bg = 'rgba(0,0,0,.06)', fg = 'var(--mute)'
  if (s === 'ACTIVE') { txt = 'Ativo'; bg = 'rgba(0,114,38,.12)'; fg = 'var(--g)' }
  else if (s === 'DISAPPROVED') { txt = 'Reprovado'; bg = 'rgba(192,57,43,.1)'; fg = '#c0392b' }
  else if (!s) { txt = '—'; bg = 'transparent' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: bg, color: fg, whiteSpace: 'nowrap' }}>{txt}</span>
}
const isActive = (s?: string) => s === 'ACTIVE'

const thL: React.CSSProperties = { padding: '9px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)', textAlign: 'left', whiteSpace: 'nowrap' }
const thR: React.CSSProperties = { ...thL, textAlign: 'right' }
const tdL: React.CSSProperties = { padding: '8px 10px', fontSize: 13, color: 'var(--ink)', textAlign: 'left', whiteSpace: 'nowrap' }
const tdR: React.CSSProperties = { ...tdL, textAlign: 'right' }

// Cabeçalho de métricas (idêntico ao funil), reusado nas 3 tabelas.
const METRIC_HEAD = ['Investido', 'Impr.', 'CPM', 'Cliques', 'CTR', 'CPC', 'Page views', 'IC', 'Compras', 'CPA', 'ROAS']

// Células de métrica de uma linha (funil completo).
function metricCells(d: Funnel) {
  const spend = N(d.spend), impr = N(d.impressions), clk = N(d.link_clicks), pv = N(d.lp_views), ic = N(d.ic), c = N(d.purchases), val = N(d.purchase_value)
  const roas = spend > 0 ? val / spend : 0
  const roasColor = val <= 0 ? 'var(--mute)' : roas >= 1 ? 'var(--g)' : '#c0392b'
  return (
    <>
      <td style={tdR}>{brl0(spend)}</td>
      <td style={tdR}>{int(impr)}</td>
      <td style={tdR}>{impr > 0 ? brl(spend / impr * 1000) : '—'}</td>
      <td style={tdR}>{int(clk)}</td>
      <td style={tdR}>{pct1(clk, impr)}</td>
      <td style={tdR}>{clk > 0 ? brl(spend / clk) : '—'}</td>
      <td style={tdR}>{int(pv)}</td>
      <td style={tdR}>{int(ic)}</td>
      <td style={{ ...tdR, fontWeight: 800 }}>{int(c)}</td>
      <td style={tdR}>{c > 0 ? brl(spend / c) : '—'}</td>
      <td style={{ ...tdR, fontWeight: 700, color: roasColor }}>{val > 0 ? roas.toFixed(2) + 'x' : '—'}</td>
    </>
  )
}

function Table({ title, note, leadCols, children }: { title: string; note?: string; leadCols: string[]; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>{title}</h2>
      {note && <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 10 }}>{note}</p>}
      <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', marginTop: note ? 0 : 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
            {leadCols.map((c, i) => <th key={i} style={thL}>{c}</th>)}
            {METRIC_HEAD.map((c, i) => <th key={i} style={thR}>{c}</th>)}
          </tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
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

  // Campanhas = soma os conjuntos por campanha (e fica "ativa" se algum conjunto estiver).
  const campMap = new Map<string, { name: string; active: boolean } & Funnel>()
  for (const c of conjuntos) {
    if (N(c.spend) <= 0) continue
    const key = c.campaign_id || c.adset_id
    const e = campMap.get(key) || { name: c.campaign_name || '(sem campanha)', active: false, spend: 0, impressions: 0, link_clicks: 0, lp_views: 0, ic: 0, purchases: 0, purchase_value: 0 }
    e.spend += N(c.spend); e.impressions += N(c.impressions); e.link_clicks += N(c.link_clicks); e.lp_views += N(c.lp_views); e.ic += N(c.ic); e.purchases += N(c.purchases); e.purchase_value += N(c.purchase_value)
    if (isActive(statusOf.get(c.adset_id))) e.active = true
    campMap.set(key, e)
  }
  const campanhas = [...campMap.values()].sort((a, b) => b.spend - a.spend)
  const conj = conjuntos.filter((c) => N(c.spend) > 0).sort((a, b) => N(b.spend) - N(a.spend))
  const adsTop = ads.filter((a) => N(a.spend) > 0).sort((a, b) => N(b.purchases) - N(a.purchases)).slice(0, 40)

  return (
    <DashboardShell active="anuncios">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Anúncios</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Funil completo por campanha, conjunto e anúncio. Conversão = compras (pixel do Meta).</p>
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <Table title="Campanhas" note="Ordenadas por investimento" leadCols={['Campanha', 'Status']}>
        {campanhas.length === 0 && <tr><td colSpan={13} style={{ ...tdL, textAlign: 'center', color: 'var(--mute)', padding: 20 }}>Sem dados no período.</td></tr>}
        {campanhas.map((c, i) => (
          <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
            <td style={{ ...tdL, fontWeight: 600, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</td>
            <td style={tdL}><StatusBadge status={c.active ? 'ACTIVE' : 'PAUSED'} /></td>
            {metricCells(c)}
          </tr>
        ))}
      </Table>

      <Table title="Conjuntos" note="Ordenados por investimento" leadCols={['Conjunto', 'Campanha', 'Status']}>
        {conj.length === 0 && <tr><td colSpan={14} style={{ ...tdL, textAlign: 'center', color: 'var(--mute)', padding: 20 }}>Sem dados no período.</td></tr>}
        {conj.map((c) => (
          <tr key={c.adset_id} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
            <td style={{ ...tdL, fontWeight: 600 }}>{c.adset_name || c.adset_id}</td>
            <td style={{ ...tdL, color: 'var(--sub)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.campaign_name || '—'}</td>
            <td style={tdL}><StatusBadge status={statusOf.get(c.adset_id)} /></td>
            {metricCells(c)}
          </tr>
        ))}
      </Table>

      <Table title="Melhores anúncios" note="Top 40 por compras (pixel)" leadCols={['#', 'Anúncio', 'Conjunto', 'Status']}>
        {adsTop.length === 0 && <tr><td colSpan={15} style={{ ...tdL, textAlign: 'center', color: 'var(--mute)', padding: 20 }}>Sem dados no período.</td></tr>}
        {adsTop.map((a, i) => (
          <tr key={a.ad_id} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
            <td style={{ ...tdL, color: 'var(--mute)', fontWeight: 700 }}>{i + 1}</td>
            <td style={{ ...tdL, fontWeight: 600 }}>{a.ad_name || a.ad_id}</td>
            <td style={{ ...tdL, color: 'var(--sub)', fontSize: 12 }}>{a.adset_name || '—'}</td>
            <td style={tdL}><StatusBadge status={statusOf.get(a.ad_id)} /></td>
            {metricCells(a)}
          </tr>
        ))}
      </Table>
    </DashboardShell>
  )
}
