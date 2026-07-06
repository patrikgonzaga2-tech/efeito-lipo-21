import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../efeito-lipo-quiz/dashboard/_login'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../efeito-lipo-quiz/dashboard/_period'
import { PainelShell } from './_shell'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Painel da Marca — Corpo Feliz', robots: { index: false, follow: false } }

type Gateway = { gateway: string; vendas: number; itens: number; receita: number; liquido: number; reembolsos: number; reembolsos_valor: number }
type Canal = { canal: string; vendas: number; itens: number; receita: number; liquido: number }
type Prod = { produto: string; familia: string; tipo: string; gateway: string; vendas: number; receita: number; liquido: number; reembolsos: number }
type Resumo = { spend: number }

const N = (v: unknown) => Number(v) || 0
const brl = (n: number) => 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')
const div = (n: number, d: number) => (d > 0 ? n / d : 0)

const GW_LABEL: Record<string, string> = { hotmart: 'Hotmart', greenn: 'Greenn' }
const CANAL_LABEL: Record<string, string> = { ads: 'Anúncios', comercial: 'Comercial / WhatsApp', organico: 'Orgânico', direto: 'Direto / sem rastreio' }
const FAM_COR: Record<string, string> = { 'Efeito Lipo': 'var(--o)', 'Comunidade': 'var(--g)' }

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: accent || 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default async function PainelGeralPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <PainelShell active="marca-geral"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></PainelShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)

  const [gateways, canais, produtos, resumo] = await Promise.all([
    sbRpc<Gateway>('marca_resumo', { p_since: since, p_until: until }),
    sbRpc<Canal>('marca_por_canal', { p_since: since, p_until: until }),
    sbRpc<Prod>('marca_por_produto', { p_since: since, p_until: until }),
    sbRpc<Resumo>('funil_resumo', { p_since: since, p_until: until }), // spend (independe de gateway)
  ])

  // Totais da marca (todos os gateways)
  const vendas = gateways.reduce((a, g) => a + N(g.vendas), 0)
  const receita = gateways.reduce((a, g) => a + N(g.receita), 0)
  const liquido = gateways.reduce((a, g) => a + N(g.liquido), 0)
  const reembolsos = gateways.reduce((a, g) => a + N(g.reembolsos), 0)
  const reembValor = gateways.reduce((a, g) => a + N(g.reembolsos_valor), 0)
  const spend = N(resumo?.[0]?.spend)
  const lucro = liquido - spend
  const ticket = div(receita, vendas)

  // ROAS de ANÚNCIOS: receita do canal ads ÷ investimento (não blended, pra não
  // dividir o gasto do Meta por venda orgânica/comercial e mentir o número).
  const receitaAds = N(canais.find((c) => c.canal === 'ads')?.receita)
  const roasAds = div(receitaAds, spend)

  // ROAS TOTAL (blended): faturamento total da marca (todos os gateways, todas
  // as origens) ÷ investimento total. Mede o retorno do negócio inteiro sobre o
  // que foi investido — não só a fatia que veio de anúncio.
  const roasTotal = div(receita, spend)

  // Famílias (junta gateways): agrega por familia
  const famMap = new Map<string, { vendas: number; receita: number; liquido: number }>()
  for (const p of produtos) {
    const f = famMap.get(p.familia) ?? { vendas: 0, receita: 0, liquido: 0 }
    f.vendas += N(p.vendas); f.receita += N(p.receita); f.liquido += N(p.liquido)
    famMap.set(p.familia, f)
  }
  const familias = [...famMap.entries()].sort((a, b) => b[1].receita - a[1].receita)

  const td: React.CSSProperties = { padding: '11px 14px', fontSize: 14, color: 'var(--ink)' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
  const thR: React.CSSProperties = { ...tdR, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)' }

  return (
    <PainelShell active="marca-geral">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Visão Geral da Marca</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Resultado de <strong>toda a marca</strong> — Hotmart + Greenn, todos os produtos e canais. É a verdade do caixa do negócio inteiro.</p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      {/* Macro da marca */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        <Card label="Faturamento" value={brl0(receita)} sub="bruto · todos os gateways" accent="var(--g)" />
        <Card label="Líquido" value={brl0(liquido)} sub="após taxas dos gateways" accent="var(--g)" />
        <Card label="Vendas" value={int(vendas)} sub="pedidos (clientes)" accent="var(--g)" />
        <Card label="Ticket médio" value={vendas > 0 ? brl(ticket) : '—'} sub="faturamento ÷ vendas" />
        <Card label="Investido" value={brl0(spend)} sub="Meta Ads" />
        <Card label="Lucro" value={brl0(lucro)} sub="líquido − investido" accent={lucro >= 0 ? 'var(--g)' : '#c0392b'} />
        <Card label="ROAS de anúncios" value={spend > 0 ? roasAds.toFixed(2) + 'x' : '—'} sub="faturamento de ads ÷ investido" accent={spend > 0 ? (roasAds >= 1 ? 'var(--g)' : '#c0392b') : 'var(--mute)'} />
        <Card label="ROAS total" value={spend > 0 ? roasTotal.toFixed(2) + 'x' : '—'} sub="faturamento total ÷ investido (blended)" accent={spend > 0 ? (roasTotal >= 1 ? 'var(--g)' : '#c0392b') : 'var(--mute)'} />
        <Card label="Reembolsos" value={int(reembolsos)} sub={`${reembValor > 0 ? brl0(reembValor) + ' · ' : ''}${pct1(reembolsos, vendas + reembolsos)} das vendas`} accent="#c0392b" />
      </div>

      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
        💡 Dois olhares sobre o retorno: o <strong>ROAS de anúncios</strong> usa só o faturamento que veio de anúncio ÷ investido — mede a eficiência pura do tráfego pago. O <strong>ROAS total</strong> (blended) usa o faturamento total da marca ÷ investido — inclui orgânico, comercial e WhatsApp, mostrando o retorno do negócio inteiro sobre o que foi investido (costuma ser bem maior). Greenn capturada desde <strong>25/06</strong>; Hotmart desde 19/06.
      </div>

      {/* Por gateway */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Por gateway</h2>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {gateways.sort((a, b) => N(b.receita) - N(a.receita)).map((g) => (
            <div key={g.gateway} className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
              <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{GW_LABEL[g.gateway] || g.gateway}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--g)', marginTop: 6 }} className="font-display">{brl0(N(g.receita))}</div>
              <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{int(N(g.vendas))} vendas · {brl0(N(g.liquido))} líquido</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 6 }}>{pct1(N(g.receita), receita)} do faturamento da marca</div>
            </div>
          ))}
        </div>
      </section>

      {/* Por canal */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Por canal</h2>
        <p style={{ fontSize: 12.5, color: 'var(--sub)', marginBottom: 12 }}>De onde veio cada venda. Conforme a Greenn cresce (orgânico, comercial, WhatsApp), este recorte fica mais rico.</p>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              <th style={{ ...thR, textAlign: 'left' }}>Canal</th>
              <th style={thR}>Vendas</th>
              <th style={thR}>Faturamento</th>
              <th style={thR}>Líquido</th>
              <th style={thR}>% do faturamento</th>
            </tr></thead>
            <tbody>
              {canais.map((c, i) => (
                <tr key={c.canal} style={{ borderTop: i ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                  <td style={{ ...td, fontWeight: 700 }}>{CANAL_LABEL[c.canal] || c.canal}</td>
                  <td style={tdR}>{int(N(c.vendas))}</td>
                  <td style={tdR}>{brl0(N(c.receita))}</td>
                  <td style={{ ...tdR, color: 'var(--g)', fontWeight: 700 }}>{brl0(N(c.liquido))}</td>
                  <td style={tdR}>{pct1(N(c.receita), receita)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Por produto / família */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Por produto</h2>
        <p style={{ fontSize: 12.5, color: 'var(--sub)', marginBottom: 12 }}>Catálogo unificado: o mesmo produto vendido em gateways diferentes aparece com nome único. Famílias destacadas.</p>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              <th style={{ ...thR, textAlign: 'left' }}>Produto</th>
              <th style={{ ...thR, textAlign: 'left' }}>Família</th>
              <th style={{ ...thR, textAlign: 'left' }}>Tipo</th>
              <th style={{ ...thR, textAlign: 'left' }}>Gateway</th>
              <th style={thR}>Vendas</th>
              <th style={thR}>Faturamento</th>
              <th style={thR}>Líquido</th>
            </tr></thead>
            <tbody>
              {produtos.map((p, i) => (
                <tr key={`${p.produto}-${p.gateway}-${i}`} style={{ borderTop: i ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                  <td style={{ ...td, fontWeight: 700 }}>{p.produto}</td>
                  <td style={td}><span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: '#fff', background: FAM_COR[p.familia] || 'var(--mute)' }}>{p.familia}</span></td>
                  <td style={{ ...td, color: 'var(--sub)', textTransform: 'capitalize' }}>{p.tipo}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{GW_LABEL[p.gateway] || p.gateway}</td>
                  <td style={tdR}>{int(N(p.vendas))}</td>
                  <td style={tdR}>{brl0(N(p.receita))}</td>
                  <td style={{ ...tdR, color: 'var(--g)', fontWeight: 700 }}>{brl0(N(p.liquido))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {familias.length > 1 && (
          <p style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 10 }}>
            Por família: {familias.map(([f, v]) => `${f} ${brl0(v.receita)} (${int(v.vendas)} vendas)`).join(' · ')}.
          </p>
        )}
      </section>
    </PainelShell>
  )
}
