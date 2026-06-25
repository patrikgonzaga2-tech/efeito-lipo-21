import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../../efeito-lipo-quiz/dashboard/_login'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../../efeito-lipo-quiz/dashboard/_period'
import { PainelShell } from '../_shell'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Canais — Painel da Marca', robots: { index: false, follow: false } }

type Canal = { canal: string; vendas: number; itens: number; receita: number; liquido: number }
type Resumo = { spend: number }

const N = (v: unknown) => Number(v) || 0
const brl = (n: number) => 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')
const div = (n: number, d: number) => (d > 0 ? n / d : 0)

const CANAL: Record<string, { label: string; cor: string; pago: boolean }> = {
  ads: { label: 'Anúncios', cor: 'var(--o)', pago: true },
  comercial: { label: 'Comercial / WhatsApp', cor: 'var(--g)', pago: false },
  organico: { label: 'Orgânico', cor: 'var(--g)', pago: false },
  direto: { label: 'Direto / sem rastreio', cor: 'var(--mute)', pago: false },
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: accent || 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default async function CanaisPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <PainelShell active="marca-canais"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></PainelShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)

  const [canais, resumo] = await Promise.all([
    sbRpc<Canal>('marca_por_canal', { p_since: since, p_until: until }),
    sbRpc<Resumo>('funil_resumo', { p_since: since, p_until: until }), // spend total Meta (= custo do canal ads)
  ])
  const spend = N(resumo?.[0]?.spend)
  const receitaTotal = canais.reduce((a, c) => a + N(c.receita), 0)
  const adsRow = canais.find((c) => c.canal === 'ads')
  const receitaAds = N(adsRow?.receita), vendasAds = N(adsRow?.vendas)
  const roasAds = div(receitaAds, spend), cacAds = div(spend, vendasAds)
  const receitaLivre = canais.filter((c) => c.canal !== 'ads').reduce((a, c) => a + N(c.receita), 0)

  const td: React.CSSProperties = { padding: '11px 14px', fontSize: 14, color: 'var(--ink)' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
  const thR: React.CSSProperties = { ...tdR, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)' }

  return (
    <PainelShell active="marca-canais">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Canais</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>De onde vem o faturamento — e quanto custa cada canal. O <strong>investimento do Meta entra só no canal Anúncios</strong>, então o ROAS aqui é honesto (não diluído por venda orgânica).</p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Card label="Faturamento total" value={brl0(receitaTotal)} sub="todos os canais" accent="var(--g)" />
        <Card label="Investido (Meta)" value={brl0(spend)} sub="custo do canal Anúncios" />
        <Card label="ROAS de anúncios" value={spend > 0 ? roasAds.toFixed(2) + 'x' : '—'} sub="faturamento ads ÷ investido" accent={spend > 0 ? (roasAds >= 1 ? 'var(--g)' : '#c0392b') : 'var(--mute)'} />
        <Card label="CAC de anúncios" value={vendasAds > 0 ? brl(cacAds) : '—'} sub="investido ÷ vendas de ads" accent="var(--o)" />
        <Card label="Faturamento sem mídia" value={brl0(receitaLivre)} sub={`${pct1(receitaLivre, receitaTotal)} sem custo de anúncio`} accent="var(--g)" />
      </div>

      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Resultado por canal</h2>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              <th style={{ ...thR, textAlign: 'left' }}>Canal</th>
              <th style={thR}>Vendas</th>
              <th style={thR}>Faturamento</th>
              <th style={thR}>Líquido</th>
              <th style={thR}>Ticket</th>
              <th style={thR}>Investido</th>
              <th style={thR}>ROAS</th>
              <th style={thR}>CAC</th>
              <th style={thR}>% fat.</th>
            </tr></thead>
            <tbody>
              {canais.map((c, i) => {
                const meta = CANAL[c.canal] || { label: c.canal, cor: 'var(--mute)', pago: false }
                const vend = N(c.vendas), rec = N(c.receita)
                return (
                  <tr key={c.canal} style={{ borderTop: i ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                    <td style={td}><span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: '#fff', background: meta.cor }}>{meta.label}</span></td>
                    <td style={tdR}>{int(vend)}</td>
                    <td style={tdR}>{brl0(rec)}</td>
                    <td style={{ ...tdR, color: 'var(--g)', fontWeight: 700 }}>{brl0(N(c.liquido))}</td>
                    <td style={tdR}>{vend > 0 ? brl(div(rec, vend)) : '—'}</td>
                    <td style={tdR}>{meta.pago ? brl0(spend) : <span style={{ color: 'var(--mute)' }}>sem mídia</span>}</td>
                    <td style={{ ...tdR, fontWeight: 700, color: meta.pago ? (roasAds >= 1 ? 'var(--g)' : '#c0392b') : 'var(--g)' }}>{meta.pago ? (spend > 0 ? roasAds.toFixed(2) + 'x' : '—') : '∞'}</td>
                    <td style={tdR}>{meta.pago ? (vend > 0 ? brl(div(spend, vend)) : '—') : <span style={{ color: 'var(--mute)' }}>R$ 0</span>}</td>
                    <td style={tdR}>{pct1(rec, receitaTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8 }}>Canais sem mídia (orgânico, comercial/WhatsApp, direto) não têm custo de anúncio — por isso ROAS &quot;∞&quot; e CAC R$ 0. O investido do Meta é atribuído ao canal Anúncios. A classificação de canal é uma 1ª versão e vai refinar conforme a Greenn traz mais origens.</p>
      </section>
    </PainelShell>
  )
}
