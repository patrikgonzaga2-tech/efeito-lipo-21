import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Geral — Efeito Lipo', robots: { index: false, follow: false } }

type Resumo = {
  spend: number; impressions: number; link_clicks: number; lp_views: number; ic: number
  purchases_meta: number; value_meta: number; vendas_real: number; itens_vendidos: number; receita_real: number; liquido_real: number
  reembolsos_qtd: number; reembolsos_valor: number
  aguardando_qtd: number; aguardando_valor: number
  abandono_qtd: number
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

export default async function GeralPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="geral"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  // Geral = TODAS as vendas da HOTMART (sem filtro de funil): anúncios + orgânico
  // + WhatsApp. Travado em 'hotmart' porque esta é a seção Efeito Lipo; a visão da
  // marca toda (Hotmart + Greenn) fica no painel /painel.
  const [r] = await sbRpc<Resumo>('funil_resumo', { p_since: since, p_until: until, p_gateway: 'hotmart' })
  const d: Resumo = r ?? { spend: 0, impressions: 0, link_clicks: 0, lp_views: 0, ic: 0, purchases_meta: 0, value_meta: 0, vendas_real: 0, itens_vendidos: 0, receita_real: 0, liquido_real: 0, reembolsos_qtd: 0, reembolsos_valor: 0, aguardando_qtd: 0, aguardando_valor: 0, abandono_qtd: 0 }
  const n = (v: unknown) => Number(v) || 0
  const spend = n(d.spend), vendas = n(d.vendas_real), itens = n(d.itens_vendidos), receita = n(d.receita_real)
  const liquido = n(d.liquido_real) // o que cai na conta após as taxas da Hotmart (comissão PRODUCER)
  const refQtd = n(d.reembolsos_qtd), refValor = n(d.reembolsos_valor)
  const aguQtd = n(d.aguardando_qtd), aguValor = n(d.aguardando_valor)
  const abaQtd = n(d.abandono_qtd)
  const refPct = pct1(refQtd, vendas + refQtd)
  const taxasPct = pct1(receita - liquido, receita)
  const margem = div(liquido, receita)

  const roas = div(receita, spend) // ROAS blended (todas as vendas ÷ todo o investimento)
  const lucro = liquido - spend
  const cac = div(spend, vendas)
  const ticket = div(receita, vendas)          // faturamento bruto por venda (pedido)
  const lucroPorVenda = div(lucro, vendas)      // lucro líquido (após taxas e ads) por venda

  return (
    <DashboardShell active="geral">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Geral</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Resultado completo: <strong>todas as vendas</strong> da Hotmart (anúncios + orgânico + WhatsApp + qualquer origem) contra o investimento total. É a verdade do caixa.</p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      {/* Macro */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(165px, 1fr))' }}>
        <Card label="Investido" value={brl0(spend)} sub="Meta Ads" />
        <Card label="Vendas" value={int(vendas)} sub="pedidos (clientes)" accent="var(--g)" />
        <Card label="Produtos vendidos" value={int(itens)} sub={itens > vendas ? `inclui +${int(itens - vendas)} em order bumps` : 'sem order bumps'} accent="var(--g)" />
        <Card label="Faturamento" value={brl0(receita)} sub="bruto · todas as origens" accent="var(--g)" />
        <Card label="Ticket médio" value={vendas > 0 ? brl(ticket) : '—'} sub="faturamento ÷ vendas" accent="var(--g)" />
        <Card label="Lucro por venda" value={vendas > 0 ? brl(lucroPorVenda) : '—'} sub="lucro líquido ÷ vendas" accent={lucroPorVenda >= 0 ? 'var(--g)' : '#c0392b'} />
        <Card label="Líquido" value={brl0(liquido)} sub={`após taxas Hotmart${receita > 0 ? ` · −${taxasPct}` : ''}`} accent="var(--g)" />
        <Card label="Margem" value={receita > 0 ? pct1(liquido, receita) : '—'} sub="líquido ÷ bruto (sobra das taxas)" accent={receita > 0 ? (margem >= 0.8 ? 'var(--g)' : 'var(--o)') : 'var(--mute)'} />
        <Card label="Lucro" value={brl0(lucro)} sub="líquido − investido" accent={lucro >= 0 ? 'var(--g)' : '#c0392b'} />
        <Card label="ROAS" value={receita > 0 ? roas.toFixed(2) + 'x' : '—'} sub="blended · bruto ÷ investido" accent={receita > 0 ? (roas >= 1 ? 'var(--g)' : '#c0392b') : 'var(--mute)'} />
        <Card label="CAC" value={vendas > 0 ? brl(cac) : '—'} sub="custo por venda" accent="var(--o)" />
      </div>

      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
        💡 Aqui entram <strong>todas as vendas</strong>, independentemente da origem (é o resultado real do negócio · ROAS blended). Pra ver só o que o funil do quiz converteu, use a aba <strong>Funil</strong>. <strong>Vendas da Hotmart</strong> são capturadas desde <strong>19/06</strong> — antes disso, faturamento/lucro parciais.
      </div>

      {/* Dinheiro na mesa: reembolsos + aguardando pagamento + abandono */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Dinheiro na mesa</h2>
        <p style={{ fontSize: 12.5, color: 'var(--sub)', marginBottom: 14 }}>O que saiu das vendas (reembolso) e o que ainda pode virar venda (pagamento pendente e carrinho abandonado).</p>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
          <Card label="Reembolsos" value={int(refQtd)} sub={`${refValor > 0 ? brl0(refValor) + ' devolvidos · ' : ''}${refPct} das vendas`} accent="#c0392b" />
          <Card label="Aguardando pagamento" value={int(aguQtd)} sub={`${brl0(aguValor)} a receber · boleto/Pix gerado`} accent="var(--o)" />
          <Card label="Abandono de carrinho" value={int(abaQtd)} sub="carrinhos abandonados no checkout" accent="var(--o)" />
        </div>
        <p style={{ fontSize: 12, color: 'var(--mute)', marginTop: 8 }}>
          As <strong>vendas líquidas já descontam os reembolsos</strong> — o número reflete a realidade atual de cada compra. Reembolso = compra paga e devolvida. Aguardando = boleto/Pix gerado e ainda não pago. Abandono não traz valor pela Hotmart, por isso mostramos só a quantidade.
        </p>
      </section>
    </DashboardShell>
  )
}
