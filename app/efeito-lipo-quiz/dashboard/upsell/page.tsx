import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Upsell — Efeito Lipo', robots: { index: false, follow: false } }

// ── Identificadores do upsell (one-click Greenn na /acompanhamento-up) ───────
// Isolado pela OFERTA (o produto trimestral tem outras ofertas). Se a Greenn
// trocar o hash da oferta, muda-se só aqui. MAIN = principal que vê o upsell.
const UPSELL_OFFER = '8QUFs9'          // Comunidade Trimestral · oferta de R$147 do upsell
const MAIN_PRODUCT = '181143'          // Efeito Lipo 21D (Greenn) — base da conversão
const UPSELL_SLUG = 'acompanhamento-up' // upsell_views.slug (visualizações da página)

type Resumo = {
  vendas: number; receita: number; liquido: number
  reembolsos: number; reembolsos_valor: number; base: number; views: number
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

export default async function UpsellPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="upsell"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  const [r] = await sbRpc<Resumo>('upsell_resumo', {
    p_since: since, p_until: until, p_upsell_offer: UPSELL_OFFER, p_main_product: MAIN_PRODUCT, p_slug: UPSELL_SLUG,
  })
  const d: Resumo = r ?? { vendas: 0, receita: 0, liquido: 0, reembolsos: 0, reembolsos_valor: 0, base: 0, views: 0 }
  const n = (v: unknown) => Number(v) || 0
  const vendas = n(d.vendas), receita = n(d.receita), liquido = n(d.liquido)
  const refQtd = n(d.reembolsos), refValor = n(d.reembolsos_valor), base = n(d.base), views = n(d.views)

  const conv = div(vendas, base)               // taxa de conversão do upsell (take rate)
  const ticket = div(receita, vendas)          // faturamento bruto por venda
  const semVenda = vendas === 0

  return (
    <DashboardShell active="upsell">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Upsell</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>
        O upsell de <strong>1 clique</strong> da <strong>/acompanhamento-up</strong> (Comunidade Corpo Feliz — Trimestral, oferta de R$147),
        oferecido a quem acabou de comprar o <strong>Efeito Lipo</strong> na Greenn. A conversão é <strong>vendas do upsell ÷ compras do principal</strong>.
      </p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Card label="Taxa de conversão" value={base > 0 ? pct1(vendas, base) : '—'} sub={base > 0 ? `${int(vendas)} de ${int(base)} compradores` : 'sem base ainda'} accent={base > 0 ? (conv >= 0.1 ? 'var(--g)' : 'var(--o)') : 'var(--mute)'} />
        <Card label="Visualizações" value={int(views)} sub="foram pra página do upsell" accent="var(--ink)" />
        <Card label="Vendas do upsell" value={int(vendas)} sub="pedidos aprovados" accent="var(--g)" />
        <Card label="Receita" value={brl0(receita)} sub="faturamento bruto" accent="var(--g)" />
        <Card label="Líquido" value={brl0(liquido)} sub="após taxas da Greenn" accent="var(--g)" />
        <Card label="Ticket médio" value={vendas > 0 ? brl(ticket) : '—'} sub="receita ÷ vendas" accent="var(--g)" />
        <Card label="Compras do principal" value={int(base)} sub="Efeito Lipo (Greenn) · base da conversão" accent="var(--ink)" />
        <Card label="Reembolsos" value={int(refQtd)} sub={refValor > 0 ? `${brl0(refValor)} devolvidos` : 'nenhum'} accent={refQtd > 0 ? '#c0392b' : 'var(--mute)'} />
      </div>

      {semVenda && (
        <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
          ⏳ <strong>Ainda sem vendas do upsell no período.</strong> Duas condições precisam estar valendo: (1) a <strong>/acompanhamento-up</strong> setada como página de upsell pós-compra do Efeito Lipo no painel da Greenn; (2) a oferta cobrada ser a <strong>{UPSELL_OFFER}</strong>. Assim que sair a 1ª venda, confira aqui — se ela não aparecer, o hash da oferta pode ter mudado (ajuste a constante <strong>UPSELL_OFFER</strong> em page.tsx).
        </div>
      )}

      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.55, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.06)' }}>
        <strong>Como medimos:</strong> vendas do upsell = pedidos aprovados da oferta <strong>{UPSELL_OFFER}</strong> (Comunidade Trimestral R$147), isolada da recorrência avulsa da mesma comunidade (que usa outras ofertas). Base = compras aprovadas do <strong>Efeito Lipo 21D na Greenn</strong> (quem cai na página do upsell). Datas ancoradas na <strong>aprovação</strong>; líquido = valor do produtor após as taxas. Reembolsos ancorados na data de entrada do evento.
      </div>
    </DashboardShell>
  )
}
