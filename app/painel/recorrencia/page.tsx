import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../../efeito-lipo-quiz/dashboard/_login'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../../efeito-lipo-quiz/dashboard/_period'
import { PainelShell } from '../_shell'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Recorrência — Painel da Marca', robots: { index: false, follow: false } }

type Resumo = { assinantes: number; cobrancas: number; receita_coletada: number; mrr_estimado: number; arr_estimado: number; cancelados: number; pagantes_total: number; expirados: number }
type Assinante = { nome: string; email: string; sub: string; cobrancas: number; total_pago: number; primeira: string; ultima: string; status: string; plano: string; mrr: number; vence_em: string }

const N = (v: unknown) => Number(v) || 0
const brl = (n: number) => 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const dt = (s: string) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—')
const mask = (e: string) => { if (!e) return '—'; const [u, d] = e.split('@'); return (u?.length > 2 ? u.slice(0, 2) + '•••' : u) + '@' + (d || '') }

// Status vem de assinantes_norm, já derivado do estado REAL: ativo | cancelado
// | expirado. Antes vinha cru da Greenn e o 'ended' — que ela dispara na CRIAÇÃO
// do contrato — pintava 84 dos 124 pagantes de vermelho, como se a Comunidade
// estivesse morrendo.
const STATUS_COR: Record<string, string> = { ativo: 'var(--g)', expirado: 'var(--mute)', cancelado: '#c0392b' }
// Plano longo (ex.: "Comunidade Corpo Feliz ✩ - Anual 12x S;Juros") → "Anual".
const planoCurto = (p: string) => {
  const n = (p || '').toLowerCase()
  if (n.includes('anual') || n.includes('12x')) return 'Anual'
  if (n.includes('semestral') || n.includes('6 meses')) return 'Semestral'
  if (n.includes('trimestral') || n.includes('3 meses')) return 'Trimestral'
  if (n.includes('mensal') || n.includes('1 mês')) return 'Mensal'
  return '—'
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

export default async function RecorrenciaPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <PainelShell active="marca-mrr"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></PainelShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)

  const [[r], lista] = await Promise.all([
    sbRpc<Resumo>('recorrencia_resumo', { p_since: since, p_until: until }),
    sbRpc<Assinante>('recorrencia_lista', { p_limit: 100 }),
  ])
  const d: Resumo = r ?? { assinantes: 0, cobrancas: 0, receita_coletada: 0, mrr_estimado: 0, arr_estimado: 0, cancelados: 0, pagantes_total: 0, expirados: 0 }

  const td: React.CSSProperties = { padding: '11px 14px', fontSize: 14, color: 'var(--ink)' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
  const thR: React.CSSProperties = { ...tdR, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)' }

  return (
    <PainelShell active="marca-mrr">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Recorrência</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>A <strong>Comunidade Corpo Feliz</strong> como assinatura: receita recorrente (MRR), assinantes e cancelamentos. Receita de venda avulsa fica nas outras telas.</p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} note=" · assinantes e MRR são a foto atual; cobranças e cancelados, do período" />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Card label="Assinantes ativos" value={int(N(d.assinantes))} sub={`dentro do plano pago · ${int(N(d.pagantes_total))} já pagaram algum dia`} accent="var(--g)" />
        <Card label="MRR" value={brl(N(d.mrr_estimado))} sub="receita recorrente / mês" accent="var(--g)" />
        <Card label="ARR" value={brl0(N(d.arr_estimado))} sub="MRR × 12" accent="var(--g)" />
        <Card label="Receita coletada" value={brl0(N(d.receita_coletada))} sub={`${int(N(d.cobrancas))} cobranças no período`} accent="var(--g)" />
        <Card label="Cancelamentos" value={int(N(d.cancelados))} sub="quem pagava e cancelou, no período" accent={N(d.cancelados) > 0 ? '#c0392b' : 'var(--mute)'} />
      </div>

      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
        💡 O <strong>MRR normaliza cada plano pela sua duração</strong>: um anual de R$ 479 entra como R$ 39,92/mês, um mensal de R$ 87 entra como R$ 87. (Antes tudo era dividido por 6, como se todo mundo fosse semestral — o anual contava em dobro e o mensal por um sexto.) <strong>Cancelamento</strong> = quem <em>pagava</em> e cancelou; assinatura iniciada e nunca paga não é churn. Nenhum plano completou um ciclo ainda, então a <strong>primeira renovação</strong> é o teste real — por volta de 25/07.
      </div>

      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>Assinantes</h2>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              <th style={{ ...thR, textAlign: 'left' }}>Assinante</th>
              <th style={{ ...thR, textAlign: 'left' }}>Status</th>
              <th style={{ ...thR, textAlign: 'left' }}>Plano</th>
              <th style={thR}>MRR</th>
              <th style={thR}>Total pago</th>
              <th style={thR}>Renova em</th>
            </tr></thead>
            <tbody>
              {lista.map((a, i) => (
                <tr key={a.sub + i} style={{ borderTop: i ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                  <td style={td}><div style={{ fontWeight: 700 }}>{a.nome || '—'}</div><div style={{ fontSize: 11.5, color: 'var(--mute)' }}>{mask(a.email)}</div></td>
                  <td style={td}><span style={{ fontSize: 12, fontWeight: 700, textTransform: 'capitalize', padding: '2px 8px', borderRadius: 6, color: '#fff', background: STATUS_COR[a.status] || 'var(--mute)' }}>{a.status}</span></td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{planoCurto(a.plano)}</td>
                  <td style={tdR}>{brl(N(a.mrr))}</td>
                  <td style={{ ...tdR, fontWeight: 800 }} className="font-display">{brl0(N(a.total_pago))}</td>
                  <td style={{ ...tdR, color: 'var(--sub)' }}>{dt(a.vence_em)}</td>
                </tr>
              ))}
              {lista.length === 0 && <tr><td colSpan={6} style={{ ...td, color: 'var(--mute)', textAlign: 'center' }}>Nenhum assinante ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </PainelShell>
  )
}
