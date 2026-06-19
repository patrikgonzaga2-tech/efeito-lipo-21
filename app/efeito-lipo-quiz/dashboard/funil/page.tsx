import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Funil — Efeito Lipo', robots: { index: false, follow: false } }

type Resumo = {
  spend: number; impressions: number; link_clicks: number; lp_views: number; ic: number
  purchases_meta: number; value_meta: number; vendas_real: number; receita_real: number
}

const brl = (n: number) => 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')
const div = (n: number, d: number) => (d > 0 ? n / d : 0)

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: accent || 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default async function FunilPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="funil"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  const [r] = await sbRpc<Resumo>('funil_resumo', { p_since: since, p_until: until })
  const d: Resumo = r ?? { spend: 0, impressions: 0, link_clicks: 0, lp_views: 0, ic: 0, purchases_meta: 0, value_meta: 0, vendas_real: 0, receita_real: 0 }
  const n = (v: unknown) => Number(v) || 0
  const spend = n(d.spend), impr = n(d.impressions), clk = n(d.link_clicks), pv = n(d.lp_views)
  const ic = n(d.ic), comprasMeta = n(d.purchases_meta), vendas = n(d.vendas_real), receita = n(d.receita_real)

  const roas = div(receita, spend)
  const lucro = receita - spend
  const cac = div(spend, vendas)
  const ticket = div(receita, vendas)

  // Funil: cada etapa tem valor, taxa de conversão da etapa acima, e custo.
  const etapas: { nome: string; valor: string; taxa: string; custo: string }[] = [
    { nome: 'Impressões', valor: int(impr), taxa: '—', custo: 'CPM ' + brl(div(spend, impr) * 1000) },
    { nome: 'Cliques no link', valor: int(clk), taxa: 'CTR ' + pct1(clk, impr), custo: 'CPC ' + brl(div(spend, clk)) },
    { nome: 'Page views', valor: int(pv), taxa: pct1(pv, clk), custo: brl(div(spend, pv)) },
    { nome: 'Initiate checkout', valor: int(ic), taxa: pct1(ic, pv), custo: brl(div(spend, ic)) },
    { nome: 'Compras (pixel Meta)', valor: int(comprasMeta), taxa: pct1(comprasMeta, ic), custo: 'CPA ' + brl(div(spend, comprasMeta)) },
    { nome: 'Vendas reais (Hotmart)', valor: int(vendas), taxa: comprasMeta > 0 ? pct1(vendas, comprasMeta) + ' do pixel' : '—', custo: 'CAC ' + brl(cac) },
  ]

  const td: React.CSSProperties = { padding: '12px 14px', fontSize: 14, color: 'var(--ink)' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }

  return (
    <DashboardShell active="funil">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Funil</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Métricas do Meta + vendas da Hotmart, do clique à compra.</p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      {/* Macro */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        <Card label="Investido" value={brl0(spend)} sub="Meta Ads" />
        <Card label="Faturamento" value={brl0(receita)} sub={`${vendas} vendas · ticket ${vendas ? brl(ticket) : '—'}`} accent="var(--g)" />
        <Card label="Lucro" value={brl0(lucro)} sub="faturamento − investido" accent={lucro >= 0 ? 'var(--g)' : '#c0392b'} />
        <Card label="ROAS" value={receita > 0 ? roas.toFixed(2) + 'x' : '—'} sub="retorno por R$ investido" accent={receita > 0 ? (roas >= 1 ? 'var(--g)' : '#c0392b') : 'var(--mute)'} />
        <Card label="CAC" value={vendas > 0 ? brl(cac) : '—'} sub="custo por venda" accent="var(--o)" />
      </div>

      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
        💡 <strong>Gasto e funil do Meta</strong> são completos no período. As <strong>vendas reais da Hotmart</strong> são capturadas desde <strong>19/06</strong> — então faturamento/ROAS/lucro de períodos anteriores ficam parciais. Daqui pra frente, completos.
      </div>

      {/* Funil com taxas */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Do clique à compra</h2>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <th style={{ ...td, textAlign: 'left', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mute)' }}>Etapa</th>
                <th style={{ ...tdR, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mute)' }}>Valor</th>
                <th style={{ ...tdR, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mute)' }}>Conversão</th>
                <th style={{ ...tdR, fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mute)' }}>Custo</th>
              </tr>
            </thead>
            <tbody>
              {etapas.map((e, i) => (
                <tr key={e.nome} style={{ borderTop: i ? '1px solid rgba(0,0,0,.05)' : 'none', background: i === etapas.length - 1 ? 'rgba(0,114,38,.05)' : '#fff' }}>
                  <td style={{ ...td, fontWeight: 700 }}>{e.nome}</td>
                  <td style={{ ...tdR, fontWeight: 800, fontSize: 16 }} className="font-display">{e.valor}</td>
                  <td style={{ ...tdR, color: 'var(--sub)' }}>{e.taxa}</td>
                  <td style={{ ...tdR, color: 'var(--sub)' }}>{e.custo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8 }}>Conversão = % que passou da etapa anterior. Custo = investimento ÷ eventos da etapa.</p>
      </section>
    </DashboardShell>
  )
}
