import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Anúncios — Efeito Lipo', robots: { index: false, follow: false } }

type Conj = { adset_id: string; adset_name: string | null; campaign_id: string | null; campaign_name: string | null; spend: number; sessions: number; checkouts: number; vendas: number; receita: number }
type Ad = { ad_id: string; ad_name: string | null; adset_name: string | null; campaign_name: string | null; spend: number; impressions: number; link_clicks: number; ic: number; purchases: number; purchase_value: number }

const brl = (n: number) => 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')
const N = (v: unknown) => Number(v) || 0
function roas(receita: number, spend: number): { txt: string; color: string } {
  if (receita <= 0) return { txt: '—', color: 'var(--mute)' }
  const r = receita / spend
  return { txt: r.toFixed(2) + 'x', color: r >= 1 ? 'var(--g)' : '#c0392b' }
}

const thL: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mute)', textAlign: 'left' }
const thR: React.CSSProperties = { ...thL, textAlign: 'right' }
const tdL: React.CSSProperties = { padding: '9px 12px', fontSize: 13.5, color: 'var(--ink)', textAlign: 'left' }
const tdR: React.CSSProperties = { ...tdL, textAlign: 'right' }

function Table({ title, head, children, note }: { title: string; head: { label: string; right?: boolean }[]; children: React.ReactNode; note?: string }) {
  return (
    <section className="mt-7">
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>{title}</h2>
      {note && <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 10 }}>{note}</p>}
      <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', marginTop: note ? 0 : 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>{head.map((h, i) => <th key={i} style={h.right ? thR : thL}>{h.label}</th>)}</tr></thead>
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
  const [conjuntos, ads] = await Promise.all([
    sbRpc<Conj>('roi_conjuntos', { p_since: since, p_until: until }),
    sbRpc<Ad>('ranking_anuncios', { p_since: since, p_until: until }),
  ])

  // Campanhas = agrega conjuntos por campanha.
  const campMap = new Map<string, { name: string; spend: number; vendas: number; receita: number }>()
  for (const c of conjuntos) {
    if (N(c.spend) <= 0 && N(c.vendas) <= 0) continue
    const key = c.campaign_id || c.adset_id
    const e = campMap.get(key) || { name: c.campaign_name || '(sem campanha)', spend: 0, vendas: 0, receita: 0 }
    e.spend += N(c.spend); e.vendas += N(c.vendas); e.receita += N(c.receita)
    campMap.set(key, e)
  }
  const campanhas = [...campMap.values()].sort((a, b) => b.spend - a.spend)
  const conj = conjuntos.filter((c) => N(c.spend) > 0 || N(c.vendas) > 0).sort((a, b) => N(b.spend) - N(a.spend))
  const adsTop = ads.filter((a) => N(a.spend) > 0).sort((a, b) => N(b.purchases) - N(a.purchases)).slice(0, 40)

  return (
    <DashboardShell active="anuncios">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Anúncios</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Ranking por campanha, conjunto e anúncio.</p>
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      {/* CAMPANHAS */}
      <Table title="Campanhas" note="Ordenadas por investimento · vendas e receita são reais (Hotmart)" head={[{ label: 'Campanha' }, { label: 'Investido', right: true }, { label: 'Vendas', right: true }, { label: 'Receita', right: true }, { label: 'ROAS', right: true }, { label: 'CAC', right: true }]}>
        {campanhas.length === 0 && <tr><td colSpan={6} style={{ ...tdL, textAlign: 'center', color: 'var(--mute)', padding: 20 }}>Sem dados no período.</td></tr>}
        {campanhas.map((c, i) => {
          const rs = roas(c.receita, c.spend)
          return (
            <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
              <td style={{ ...tdL, fontWeight: 600 }}>{c.name}</td>
              <td style={tdR}>{brl0(c.spend)}</td>
              <td style={tdR}>{c.vendas}</td>
              <td style={tdR}>{brl0(c.receita)}</td>
              <td style={{ ...tdR, fontWeight: 700, color: rs.color }}>{rs.txt}</td>
              <td style={tdR}>{c.vendas > 0 ? brl(c.spend / c.vendas) : '—'}</td>
            </tr>
          )
        })}
      </Table>

      {/* CONJUNTOS */}
      <Table title="Conjuntos" note="Funil próprio do quiz (sessões/checkouts) + vendas reais" head={[{ label: 'Conjunto' }, { label: 'Campanha' }, { label: 'Investido', right: true }, { label: 'Sessões', right: true }, { label: 'Checkouts', right: true }, { label: 'Vendas', right: true }, { label: 'ROAS', right: true }]}>
        {conj.length === 0 && <tr><td colSpan={7} style={{ ...tdL, textAlign: 'center', color: 'var(--mute)', padding: 20 }}>Sem dados no período.</td></tr>}
        {conj.map((c) => {
          const rs = roas(N(c.receita), N(c.spend))
          return (
            <tr key={c.adset_id} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
              <td style={{ ...tdL, fontWeight: 600 }}>{c.adset_name || c.adset_id}</td>
              <td style={{ ...tdL, color: 'var(--sub)', fontSize: 12.5 }}>{c.campaign_name || '—'}</td>
              <td style={tdR}>{brl0(N(c.spend))}</td>
              <td style={tdR}>{int(N(c.sessions))}</td>
              <td style={tdR}>{int(N(c.checkouts))}</td>
              <td style={tdR}>{N(c.vendas)}</td>
              <td style={{ ...tdR, fontWeight: 700, color: rs.color }}>{rs.txt}</td>
            </tr>
          )
        })}
      </Table>

      {/* ANÚNCIOS */}
      <Table title="Melhores anúncios" note="Top 40 por compras (pixel do Meta) · no nível de anúncio não há venda real, só o pixel" head={[{ label: '#' }, { label: 'Anúncio' }, { label: 'Conjunto' }, { label: 'Investido', right: true }, { label: 'CTR', right: true }, { label: 'Cliques', right: true }, { label: 'IC', right: true }, { label: 'Compras', right: true }, { label: 'CPA', right: true }]}>
        {adsTop.length === 0 && <tr><td colSpan={9} style={{ ...tdL, textAlign: 'center', color: 'var(--mute)', padding: 20 }}>Sem dados no período.</td></tr>}
        {adsTop.map((a, i) => (
          <tr key={a.ad_id} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
            <td style={{ ...tdL, color: 'var(--mute)', fontWeight: 700 }}>{i + 1}</td>
            <td style={{ ...tdL, fontWeight: 600 }}>{a.ad_name || a.ad_id}</td>
            <td style={{ ...tdL, color: 'var(--sub)', fontSize: 12.5 }}>{a.adset_name || '—'}</td>
            <td style={tdR}>{brl0(N(a.spend))}</td>
            <td style={tdR}>{pct1(N(a.link_clicks), N(a.impressions))}</td>
            <td style={tdR}>{int(N(a.link_clicks))}</td>
            <td style={tdR}>{int(N(a.ic))}</td>
            <td style={{ ...tdR, fontWeight: 700 }}>{int(N(a.purchases))}</td>
            <td style={tdR}>{N(a.purchases) > 0 ? brl(N(a.spend) / N(a.purchases)) : '—'}</td>
          </tr>
        ))}
      </Table>
    </DashboardShell>
  )
}
