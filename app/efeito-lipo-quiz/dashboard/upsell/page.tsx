import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Upsell — Efeito Lipo', robots: { index: false, follow: false } }

// ── Identificadores do upsell (one-click Greenn na /acompanhamento-up) ───────
// Isolado pelas OFERTAS (o produto trimestral tem outras, da recorrência avulsa).
// São DUAS porque a oferta mudou em 14/07/2026 e o histórico não pode sumir da
// tela: O8j7nc (atual · R$97 a cada 3 meses) e 8QUFs9 (antiga · R$147 uma vez).
// Oferta nova = mais um item aqui. MAIN = o principal de quem vê o upsell.
const UPSELL_OFFERS = ['O8j7nc', '8QUFs9']
const MAIN_PRODUCT = '181143'          // Efeito Lipo 21D (Greenn) — base da conversão
const UPSELL_SLUG = 'acompanhamento-up' // upsell_views.slug (visualizações da página)

type Resumo = {
  vendas: number; receita: number; liquido: number
  reembolsos: number; reembolsos_valor: number; base: number; views: number; views_desde: string | null
}
type Canal = { canal: string; msg: string; vendas: number; receita: number; liquido: number; views: number }

// Como a cliente chegou até a oferta. 'pagina' = redirect pós-compra da Greenn
// (é onde o 1 clique cobra); 'wa' = link do WhatsApp; 'link' = link aberto sem
// canal marcado (alguém salvou/compartilhou a página).
const CANAL_NOME: Record<string, string> = {
  pagina: 'Página (pós-compra · 1 clique)',
  wa: 'WhatsApp',
  link: 'Link avulso (sem marcação)',
}
const canalNome = (c: string) => CANAL_NOME[c] ?? c

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
  const args = {
    p_since: since, p_until: until, p_upsell_offers: UPSELL_OFFERS, p_main_product: MAIN_PRODUCT, p_slug: UPSELL_SLUG,
  }
  const [[r], canais] = await Promise.all([
    sbRpc<Resumo>('upsell_resumo', args),
    sbRpc<Canal>('upsell_canais', args),
  ])
  const d: Resumo = r ?? { vendas: 0, receita: 0, liquido: 0, reembolsos: 0, reembolsos_valor: 0, base: 0, views: 0, views_desde: null }
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
        O upsell da <strong>/acompanhamento-up</strong> (Comunidade Corpo Feliz — Trimestral), oferecido a quem acabou de comprar o{' '}
        <strong>Efeito Lipo</strong> na Greenn. Desde <strong>14/07/2026</strong> a oferta é <strong>R$97 a cada 3 meses</strong> (assinatura);
        antes era R$147 em cobrança única. A conversão é <strong>vendas do upsell ÷ compras do principal</strong>.
      </p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Card label="Taxa de conversão" value={base > 0 ? pct1(vendas, base) : '—'} sub={base > 0 ? `${int(vendas)} de ${int(base)} compradores` : 'sem base ainda'} accent={base > 0 ? (conv >= 0.1 ? 'var(--g)' : 'var(--o)') : 'var(--mute)'} />
        <Card label="Visualizações" value={int(views)} sub={d.views_desde ? `medidas desde ${new Date(d.views_desde).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}` : 'foram pra página do upsell'} accent="var(--ink)" />
        <Card label="Vendas do upsell" value={int(vendas)} sub="líquidas · já sem reembolso e teste" accent="var(--g)" />
        <Card label="Receita" value={brl0(receita)} sub="retida (sem devolução)" accent="var(--g)" />
        <Card label="Líquido" value={brl0(liquido)} sub="após taxas da Greenn" accent="var(--g)" />
        <Card label="Ticket médio" value={vendas > 0 ? brl(ticket) : '—'} sub="receita ÷ vendas" accent="var(--g)" />
        <Card label="Compras do principal" value={int(base)} sub="Efeito Lipo (Greenn) · base da conversão" accent="var(--ink)" />
        <Card label="Reembolsos" value={int(refQtd)} sub={refValor > 0 ? `${brl0(refValor)} devolvidos` : 'nenhum'} accent={refQtd > 0 ? '#c0392b' : 'var(--mute)'} />
      </div>

      {/* ── Por canal e por mensagem ─────────────────────────────────────────
          De onde veio cada venda: do redirect pós-compra (1 clique) ou de um
          link do WhatsApp — e, no WhatsApp, de qual mensagem do roteiro. A
          conversão aqui é sobre QUEM VIU a página por aquele caminho. */}
      <section className="mt-6">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>Por canal e mensagem</h2>
        <p style={{ fontSize: 13, color: 'var(--sub)', marginBottom: 12 }}>
          Quem viu, quem comprou e quanto entrou — separado por caminho até a oferta. A coluna <strong>mensagem</strong> só existe no WhatsApp: é o código que você põe no link (<code>?c=wa&m=<em>codigo</em></code>).
        </p>

        {canais.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--mute)' }}>Nenhuma visita nem venda no período.</p>
        ) : (
          <div className="rounded-2xl" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 620 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--mute)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Canal</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Mensagem</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Viram</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Vendas</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Conversão</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Receita</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Líquido</th>
                </tr>
              </thead>
              <tbody>
                {canais.map((c, i) => {
                  const v = n(c.vendas), w = n(c.views)
                  return (
                    <tr key={`${c.canal}-${c.msg}-${i}`} style={{ borderTop: '1px solid rgba(0,0,0,.06)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--ink)' }}>{canalNome(c.canal)}</td>
                      <td style={{ padding: '12px 16px', color: c.msg === '—' ? 'var(--mute)' : 'var(--ink)' }}>{c.msg}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{int(w)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{int(v)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: w > 0 ? 'var(--ink)' : 'var(--mute)' }}>{pct1(v, w)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>{brl0(n(c.receita))}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--g)', fontWeight: 700 }}>{brl0(n(c.liquido))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Kit de links — o que a Laüra cola no WhatsApp. Os links que ela já
            manda marcam a mensagem no utm_content, e a página respeita essa
            convenção: os links que já estão na mão das clientes continuam
            valendo. Uma mensagem nova = um código novo, e ele aparece sozinho
            aqui na tabela — não precisa mexer em código. */}
        <div className="rounded-xl p-4 mt-4" style={{ fontSize: 12.5, color: 'var(--sub)', lineHeight: 1.7, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.06)' }}>
          <strong style={{ color: 'var(--ink)' }}>Links pro WhatsApp</strong> — continue usando o mesmo formato que você já usa; o código da mensagem é o que vai depois de <code>utm_content=</code>:
          <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'grid', gap: 6 }}>
            {[
              ['d1-oferta-abre', 'abertura da oferta'],
              ['d1-oferta-12h', 'lembrete de 12h'],
              ['d2-oferta-ultimas', 'últimas vagas'],
            ].map(([code, quando]) => (
              <li key={code} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'baseline' }}>
                <code style={{ background: '#fff', border: '1px solid rgba(0,0,0,.08)', borderRadius: 6, padding: '3px 8px', color: 'var(--ink)' }}>
                  https://laurarosapersonal.com/acompanhamento-up?utm_content={code}
                </code>
                <span style={{ color: 'var(--mute)' }}>· {quando}</span>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 10 }}>
            Mensagem nova = código novo no <code>utm_content</code> (sem espaço e sem acento). Ele vira uma linha nova nesta tabela sozinho. Nesses links a compra é pelo <strong>checkout normal</strong> — o 1 clique só cobra no redirect logo após a compra, porque só ali a Greenn reconhece o cartão da cliente. A página detecta e manda pro caminho certo.
          </div>
        </div>
      </section>

      {semVenda && (
        <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
          ⏳ <strong>Ainda sem vendas do upsell no período.</strong> Duas condições precisam estar valendo: (1) a <strong>/acompanhamento-up</strong> setada como página de upsell pós-compra do Efeito Lipo no painel da Greenn; (2) a oferta cobrada ser uma destas: <strong>{UPSELL_OFFERS.join(' · ')}</strong>. Se a Greenn trocar o hash da oferta de novo, some a nova em <strong>UPSELL_OFFERS</strong> (em page.tsx) — mantendo as antigas, senão o histórico desaparece.
        </div>
      )}

      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12, color: 'var(--mute)', lineHeight: 1.55, background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0,0,0,.06)' }}>
        <strong>Como medimos:</strong> venda do upsell = <strong>primeira</strong> compra aprovada de cada cliente nas ofertas <strong>{UPSELL_OFFERS.join(' · ')}</strong> (Comunidade Trimestral), isoladas da recorrência avulsa da mesma comunidade. A oferta atual <strong>renova a cada 3 meses</strong>: a renovação NÃO entra aqui (não é conversão nova da página — ela vive na aba Recorrência, senão o mesmo dinheiro apareceria duas vezes). Base = compras aprovadas do <strong>Efeito Lipo 21D na Greenn</strong> (quem cai na página do upsell). Compra devolvida e compra de teste ficam de fora; reembolso é datado pelo dia da devolução.
      </div>
    </DashboardShell>
  )
}
