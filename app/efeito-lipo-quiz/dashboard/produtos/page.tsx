import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Produtos — Efeito Lipo', robots: { index: false, follow: false } }

type Prod = { product_name: string; vendas: number; receita: number; liquido: number; reembolsos: number; reembolsos_valor: number }
type Cat = 'main' | 'cinturinha' | 'livro' | 'vitalicio' | 'outro'

const N = (v: unknown) => Number(v) || 0
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')

function categorize(name: string): Cat {
  const n = (name || '').toLowerCase()
  if (n.includes('vitalíc') || n.includes('vitalic')) return 'vitalicio'
  if (n.includes('cinturinha')) return 'cinturinha'
  if (n.includes('receita') || n.includes('livro')) return 'livro'
  if (n.includes('efeito lipo')) return 'main'
  return 'outro'
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

export default async function ProdutosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="produtos"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  // Seção Efeito Lipo: travado em 'hotmart'. O catálogo da marca toda fica no /painel.
  const produtos = await sbRpc<Prod>('vendas_por_produto', { p_since: since, p_until: until, p_gateway: 'hotmart' })

  const totals: Record<Cat, { vendas: number; receita: number; liquido: number; reemb: number }> = {
    main: { vendas: 0, receita: 0, liquido: 0, reemb: 0 }, cinturinha: { vendas: 0, receita: 0, liquido: 0, reemb: 0 }, livro: { vendas: 0, receita: 0, liquido: 0, reemb: 0 }, vitalicio: { vendas: 0, receita: 0, liquido: 0, reemb: 0 }, outro: { vendas: 0, receita: 0, liquido: 0, reemb: 0 },
  }
  for (const p of produtos) {
    const c = categorize(p.product_name)
    totals[c].vendas += N(p.vendas); totals[c].receita += N(p.receita); totals[c].liquido += N(p.liquido); totals[c].reemb += N(p.reembolsos)
  }
  const totalVendas = produtos.reduce((a, p) => a + N(p.vendas), 0)
  const totalReceita = produtos.reduce((a, p) => a + N(p.receita), 0)
  const totalLiquido = produtos.reduce((a, p) => a + N(p.liquido), 0)
  const totalReemb = produtos.reduce((a, p) => a + N(p.reembolsos), 0)
  const main = totals.main.vendas
  // % de reembolso = devolvidas ÷ total de compras pagas (líquidas + devolvidas).
  const refRate = (vendas: number, reemb: number) => pct1(reemb, vendas + reemb)

  const bumps: { nome: string; cat: Cat }[] = [
    { nome: 'Cinturinha Express', cat: 'cinturinha' },
    { nome: 'Livro de Receitas', cat: 'livro' },
    { nome: 'Efeito Lipo Vitalício', cat: 'vitalicio' },
  ]
  const bumpVendas = bumps.reduce((a, b) => a + totals[b.cat].vendas, 0)
  const bumpReceita = bumps.reduce((a, b) => a + totals[b.cat].receita, 0)

  const td: React.CSSProperties = { padding: '11px 14px', fontSize: 14, color: 'var(--ink)' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
  const thR: React.CSSProperties = { ...tdR, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)' }

  return (
    <DashboardShell active="produtos">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Produtos</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Vendas por produto e a taxa de adesão dos order bumps em relação ao Efeito Lipo.</p>
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Card label="Total de vendas" value={String(totalVendas)} sub={`${brl0(totalReceita)} bruto · ${brl0(totalLiquido)} líquido`} />
        <Card label="Efeito Lipo" value={String(main)} sub={`principal · ${brl0(totals.main.liquido)} líquido · ${refRate(main, totals.main.reemb)} reemb.`} accent="var(--o)" />
        <Card label="Order bumps" value={String(bumpVendas)} sub={`${brl0(bumpReceita)} bruto · ${pct1(bumpVendas, main)} do Efeito Lipo`} accent="var(--g)" />
        <Card label="Reembolsos" value={String(totalReemb)} sub={`${refRate(totalVendas, totalReemb)} das vendas · todos os produtos`} accent="#c0392b" />
      </div>

      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Order bumps</h2>
        <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 12 }}>Taxa de conversão = vendas do bump ÷ vendas do Efeito Lipo ({main}).</p>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              <th style={{ ...thR, textAlign: 'left' }}>Produto</th>
              <th style={thR}>Vendas</th>
              <th style={thR}>Receita (bruto)</th>
              <th style={thR}>Líquido</th>
              <th style={thR}>Reembolso</th>
              <th style={thR}>Taxa vs Efeito Lipo</th>
            </tr></thead>
            <tbody>
              {bumps.map((b) => (
                <tr key={b.cat} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                  <td style={{ ...td, fontWeight: 600 }}>{b.nome}</td>
                  <td style={tdR}>{totals[b.cat].vendas}</td>
                  <td style={tdR}>{brl0(totals[b.cat].receita)}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: 'var(--g)' }}>{brl0(totals[b.cat].liquido)}</td>
                  <td style={{ ...tdR, color: totals[b.cat].reemb > 0 ? '#c0392b' : 'var(--mute)' }}>{totals[b.cat].reemb > 0 ? `${totals[b.cat].reemb} · ${refRate(totals[b.cat].vendas, totals[b.cat].reemb)}` : '—'}</td>
                  <td style={{ ...tdR, fontWeight: 700, color: 'var(--g)' }}>{pct1(totals[b.cat].vendas, main)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: '2px solid rgba(0,0,0,.12)', background: 'rgba(0,114,38,.05)' }}>
                <td style={{ ...td, fontWeight: 800 }}>Total order bumps</td>
                <td style={{ ...tdR, fontWeight: 800 }}>{bumpVendas}</td>
                <td style={{ ...tdR, fontWeight: 800 }}>{brl0(bumpReceita)}</td>
                <td style={{ ...tdR, fontWeight: 800, color: 'var(--g)' }}>{brl0(bumps.reduce((a, b) => a + totals[b.cat].liquido, 0))}</td>
                <td style={{ ...tdR, fontWeight: 800, color: '#c0392b' }}>{bumps.reduce((a, b) => a + totals[b.cat].reemb, 0) || '—'}</td>
                <td style={{ ...tdR, fontWeight: 800, color: 'var(--g)' }}>{pct1(bumpVendas, main)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8 }}>A linha &quot;Total order bumps&quot; é a somatória da taxa de adesão (ex: {pct1(bumpVendas, main)} dos compradores do Efeito Lipo levaram algum bump, somando todos).</p>
      </section>

      {totals.outro.vendas > 0 && (
        <p style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 14 }}>Outros produtos no período: {totals.outro.vendas} vendas ({brl0(totals.outro.receita)}).</p>
      )}
    </DashboardShell>
  )
}
