import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'
import { categorize, PRODUTOS, type Cat } from '../_catalogo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Gateways — Efeito Lipo', robots: { index: false, follow: false } }

type Row = { gateway: string; product_name: string; vendas: number; receita: number; liquido: number; reembolsos: number; reembolsos_valor: number }
type Gw = 'hotmart' | 'greenn'

const N = (v: unknown) => Number(v) || 0
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')

type Bucket = { vendas: number; receita: number; liquido: number; reemb: number }
const zero = (): Bucket => ({ vendas: 0, receita: 0, liquido: 0, reemb: 0 })
const emptyAgg = (): Record<Cat, Bucket> => ({ main: zero(), cinturinha: zero(), livro: zero(), vitalicio: zero(), dieta: zero(), outro: zero() })

const GW_META: Record<Gw, { label: string; color: string }> = {
  hotmart: { label: 'Hotmart', color: 'var(--gd)' },
  greenn: { label: 'Greenn', color: 'var(--o)' },
}

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 32, fontWeight: 800, color: accent || 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default async function GatewaysPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="gateways"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  const rows = await sbRpc<Row>('quiz_produto_gateway', { p_since: since, p_until: until })

  // Agrega por gateway e por categoria de produto.
  const agg: Record<Gw, Record<Cat, Bucket>> = { hotmart: emptyAgg(), greenn: emptyAgg() }
  for (const r of rows) {
    const g = (r.gateway === 'greenn' ? 'greenn' : 'hotmart') as Gw
    const c = categorize(r.product_name)
    agg[g][c].vendas += N(r.vendas)
    agg[g][c].receita += N(r.receita)
    agg[g][c].liquido += N(r.liquido)
    agg[g][c].reemb += N(r.reembolsos)
  }

  const gateways: Gw[] = ['hotmart', 'greenn']
  const liquidoTotal = (g: Gw) => (Object.keys(agg[g]) as Cat[]).reduce((a, c) => a + agg[g][c].liquido, 0)
  const receitaTotal = (g: Gw) => (Object.keys(agg[g]) as Cat[]).reduce((a, c) => a + agg[g][c].receita, 0)
  const grandLiquido = gateways.reduce((a, g) => a + liquidoTotal(g), 0)

  const produtos = PRODUTOS
  const bumps = produtos.filter((p) => p.cat !== 'main')

  const td: React.CSSProperties = { padding: '11px 14px', fontSize: 14, color: 'var(--ink)' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
  const thR: React.CSSProperties = { ...tdR, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)' }

  return (
    <DashboardShell active="gateways">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Gateways</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Hotmart × Greenn no funil do quiz: líquido, cada produto lado a lado e a conversão de cada order bump por gateway.</p>
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      {/* Bloco 1 — líquido total por gateway */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {gateways.map((g) => (
          <Card
            key={g}
            label={`Líquido — ${GW_META[g].label}`}
            value={brl0(liquidoTotal(g))}
            sub={`${brl0(receitaTotal(g))} bruto · ${pct1(liquidoTotal(g), grandLiquido)} do total`}
            accent={GW_META[g].color}
          />
        ))}
        <Card label="Líquido total" value={brl0(grandLiquido)} sub="Hotmart + Greenn no funil do quiz" accent="var(--g)" />
      </div>

      {/* Bloco 2 — cada produto lado a lado */}
      <section className="mt-8">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Cada produto por gateway</h2>
        <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 12 }}>Vendas e líquido de cada produto, separados por gateway.</p>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <th style={{ ...thR, textAlign: 'left' }}>Produto</th>
                <th style={{ ...thR, color: GW_META.hotmart.color }}>Hotmart · vendas</th>
                <th style={{ ...thR, color: GW_META.hotmart.color }}>Hotmart · líquido</th>
                <th style={{ ...thR, color: GW_META.greenn.color }}>Greenn · vendas</th>
                <th style={{ ...thR, color: GW_META.greenn.color }}>Greenn · líquido</th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p) => (
                <tr key={p.cat} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{p.nome}</td>
                  <td style={tdR}>{agg.hotmart[p.cat].vendas || '—'}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: 'var(--g)' }}>{agg.hotmart[p.cat].vendas ? brl0(agg.hotmart[p.cat].liquido) : '—'}</td>
                  <td style={tdR}>{agg.greenn[p.cat].vendas || '—'}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: 'var(--g)' }}>{agg.greenn[p.cat].vendas ? brl0(agg.greenn[p.cat].liquido) : '—'}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid rgba(0,0,0,.12)', background: 'rgba(0,114,38,.05)' }}>
                <td style={{ ...td, fontWeight: 800 }}>Total</td>
                <td style={{ ...tdR, fontWeight: 800 }}>{(Object.keys(agg.hotmart) as Cat[]).reduce((a, c) => a + agg.hotmart[c].vendas, 0)}</td>
                <td style={{ ...tdR, fontWeight: 800, color: 'var(--g)' }}>{brl0(liquidoTotal('hotmart'))}</td>
                <td style={{ ...tdR, fontWeight: 800 }}>{(Object.keys(agg.greenn) as Cat[]).reduce((a, c) => a + agg.greenn[c].vendas, 0)}</td>
                <td style={{ ...tdR, fontWeight: 800, color: 'var(--g)' }}>{brl0(liquidoTotal('greenn'))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Bloco 3 — conversão de cada order bump por gateway */}
      <section className="mt-8">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Conversão dos order bumps por gateway</h2>
        <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 12 }}>
          De quem comprou o Efeito Lipo em cada gateway, quantos % levaram cada bump.
          Base: Hotmart {agg.hotmart.main.vendas} · Greenn {agg.greenn.main.vendas} vendas do principal.
        </p>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <th style={{ ...thR, textAlign: 'left' }}>Order bump</th>
                <th style={{ ...thR, color: GW_META.hotmart.color }}>Hotmart · taxa</th>
                <th style={{ ...thR, color: GW_META.hotmart.color }}>Hotmart · vendas</th>
                <th style={{ ...thR, color: GW_META.greenn.color }}>Greenn · taxa</th>
                <th style={{ ...thR, color: GW_META.greenn.color }}>Greenn · vendas</th>
              </tr>
            </thead>
            <tbody>
              {bumps.map((b) => {
                const hTaxa = pct1(agg.hotmart[b.cat].vendas, agg.hotmart.main.vendas)
                const gTaxa = pct1(agg.greenn[b.cat].vendas, agg.greenn.main.vendas)
                return (
                  <tr key={b.cat} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                    <td style={{ ...td, fontWeight: 600 }}>{b.nome}</td>
                    <td style={{ ...tdR, fontWeight: 700, color: GW_META.hotmart.color }}>{hTaxa}</td>
                    <td style={tdR}>{agg.hotmart[b.cat].vendas || '—'}</td>
                    <td style={{ ...tdR, fontWeight: 700, color: GW_META.greenn.color }}>{gTaxa}</td>
                    <td style={tdR}>{agg.greenn[b.cat].vendas || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 16, lineHeight: 1.5 }}>
        Só conta vendas do funil do quiz (marcador <code>efeito-lipo-quiz</code>). Os order bumps da Greenn só aparecem
        a partir de quando o webhook foi ligado neles — vendas anteriores não têm esse dado. Se algum bump da Greenn não
        aparecer, provavelmente o nome do produto não bateu com a classificação (verificar com 1 venda-teste).
      </p>
    </DashboardShell>
  )
}
