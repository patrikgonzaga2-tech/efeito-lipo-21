import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../../efeito-lipo-quiz/dashboard/_login'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../../efeito-lipo-quiz/dashboard/_period'
import { PainelShell } from '../_shell'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Cross-sell — Painel da Marca', robots: { index: false, follow: false } }

type Resumo = {
  clientes: number; multi_familia: number; clientes_el: number; clientes_com: number; el_e_com: number
  ltv_medio: number; receita_total: number; dias_el_para_com: number | null
}
type Cell = { familia_a: string; familia_b: string; clientes_a: number; clientes_ambos: number }
type Cliente = { nome: string; email: string; n_familias: number; familias: string; pedidos: number; ltv: number; liquido: number; primeira: string; ultima: string }

const N = (v: unknown) => Number(v) || 0
const brl = (n: number) => 'R$ ' + (Math.round(n * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const int = (n: number) => Math.round(n).toLocaleString('pt-BR')
const pct1 = (n: number, d: number) => (d > 0 ? (Math.round((n / d) * 1000) / 10).toLocaleString('pt-BR') + '%' : '—')
const dt = (s: string) => (s ? new Date(s).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—')
const mask = (e: string) => { if (!e) return '—'; const [u, d] = e.split('@'); return (u?.length > 2 ? u.slice(0, 2) + '•••' : u) + '@' + (d || '') }

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: accent || 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export default async function CrossSellPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <PainelShell active="marca-cross"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></PainelShell>

  const sp = await searchParams
  // Cross-sell é conceito de vida do cliente: o padrão desta tela é "Tudo".
  const spDef: SearchParams = { range: sp.range || 'all', from: sp.from, to: sp.to }
  const { since, until, range, periodLabel } = resolvePeriod(spDef)

  const [[r], matriz, clientes] = await Promise.all([
    sbRpc<Resumo>('cross_sell_resumo', { p_since: since, p_until: until }),
    sbRpc<Cell>('cross_sell_matriz', { p_since: since, p_until: until }),
    sbRpc<Cliente>('clientes_top', { p_since: since, p_until: until, p_limit: 50 }),
  ])
  const d: Resumo = r ?? { clientes: 0, multi_familia: 0, clientes_el: 0, clientes_com: 0, el_e_com: 0, ltv_medio: 0, receita_total: 0, dias_el_para_com: null }

  const elParaCom = pct1(N(d.el_e_com), N(d.clientes_el))
  const comParaEl = pct1(N(d.el_e_com), N(d.clientes_com))
  // Abaixo de 10 clientes cruzados, uma "taxa de conversão" é ruído — mas na tela
  // ela parecia medida (mostrava 0,1% em cima de 2 clientes). Sem amostra, o card
  // fica vazio e diz por quê, em vez de exibir um número que não significa nada.
  const AMOSTRA_MINIMA = 10
  const amostraOk = N(d.el_e_com) >= AMOSTRA_MINIMA

  // famílias presentes (eixos da matriz) + lookup das células
  const fams = [...new Set(matriz.map((c) => c.familia_a))]
  const cell = new Map(matriz.map((c) => [`${c.familia_a}|${c.familia_b}`, c]))
  const FAM_COR: Record<string, string> = { 'Efeito Lipo': 'var(--o)', 'Comunidade': 'var(--g)' }

  const td: React.CSSProperties = { padding: '11px 14px', fontSize: 14, color: 'var(--ink)' }
  const tdR: React.CSSProperties = { ...td, textAlign: 'right' }
  const thR: React.CSSProperties = { ...tdR, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)' }

  return (
    <PainelShell active="marca-cross">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Cross-sell &amp; LTV</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Quem compra um produto também compra outro? E quanto vale um cliente ao longo do tempo. Cruzamento por <strong>e-mail</strong>, atravessando Hotmart e Greenn.</p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} presets={[['all', 'Tudo'], ['30d', '30 dias'], ['mes', 'Mês atual']]} note=" · coorte pela data da 1ª compra do cliente" />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <Card label="Clientes únicos" value={int(N(d.clientes))} sub="com compra no período" accent="var(--g)" />
        <Card label="Compram +de 1 família" value={int(N(d.multi_familia))} sub={`${pct1(N(d.multi_familia), N(d.clientes))} dos clientes`} accent={N(d.multi_familia) > 0 ? 'var(--g)' : 'var(--mute)'} />
        <Card label="Efeito Lipo → Comunidade" value={amostraOk ? elParaCom : '—'} sub={amostraOk ? `${int(N(d.el_e_com))} de ${int(N(d.clientes_el))} compradores do EL` : `só ${int(N(d.el_e_com))} clientes cruzados — amostra insuficiente`} accent={amostraOk ? 'var(--g)' : 'var(--mute)'} />
        <Card label="Receita média / cliente" value={brl(N(d.ltv_medio))} sub="desde 19/06 — ainda não é LTV" accent="var(--g)" />
        <Card label="Tempo até a Comunidade" value={amostraOk && d.dias_el_para_com != null ? `${N(d.dias_el_para_com).toLocaleString('pt-BR')} dias` : '—'} sub={amostraOk ? 'do EL até virar assinante' : 'amostra insuficiente'} />
      </div>

      {/* Destaque/insight */}
      <div className="rounded-xl p-4 mt-5" style={{ fontSize: 13.5, background: 'rgba(245,113,0,.09)', color: 'var(--sub)', lineHeight: 1.6, border: '1px solid rgba(245,113,0,.25)' }}>
        {amostraOk ? (
          <><strong>{elParaCom}</strong> dos compradores do Efeito Lipo também entraram na Comunidade ({int(N(d.el_e_com))} clientes). Inversamente, {comParaEl} dos assinantes vieram do Efeito Lipo.</>
        ) : (
          <>💡 <strong>Oportunidade — e um aviso de leitura.</strong> Só <strong>{int(N(d.el_e_com))}</strong> {N(d.el_e_com) === 1 ? 'cliente comprou' : 'clientes compraram'} o Efeito Lipo <em>e</em> entraram na Comunidade. Com uma amostra dessa, qualquer porcentagem é ruído — por isso os cards acima aparecem vazios em vez de mostrar um número que parece medido. O que o dado diz de fato: a Comunidade é vendida para uma <strong>base que não passou pelo funil do Efeito Lipo</strong>. Converter os {int(N(d.clientes_el))} compradores do EL para a recorrência segue sendo a alavanca de LTV mais barata que existe — eles já são seus clientes.</>
        )}
      </div>

      {/* Matriz de cruzamento */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Matriz de cruzamento</h2>
        <p style={{ fontSize: 12.5, color: 'var(--sub)', marginBottom: 12 }}>Leia por linha: <em>de quem comprou [linha], quantos % também compraram [coluna]</em>.</p>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              <th style={{ ...thR, textAlign: 'left' }}>Comprou ↓ · também comprou →</th>
              {fams.map((f) => <th key={f} style={thR}>{f}</th>)}
            </tr></thead>
            <tbody>
              {fams.map((fa) => {
                const base = N(cell.get(`${fa}|${fa}`)?.clientes_a)
                return (
                  <tr key={fa} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                    <td style={{ ...td, fontWeight: 700 }}><span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, color: '#fff', background: FAM_COR[fa] || 'var(--mute)' }}>{fa}</span> <span style={{ color: 'var(--mute)', fontSize: 12.5 }}>({int(base)})</span></td>
                    {fams.map((fb) => {
                      const ambos = N(cell.get(`${fa}|${fb}`)?.clientes_ambos)
                      const self = fa === fb
                      return (
                        <td key={fb} style={{ ...tdR, fontWeight: self ? 700 : 600, color: self ? 'var(--mute)' : (ambos > 0 ? 'var(--g)' : 'var(--ink)'), background: self ? 'rgba(0,0,0,.02)' : '#fff' }}>
                          {self ? '—' : <>{pct1(ambos, base)}<span style={{ fontSize: 11.5, color: 'var(--mute)' }}> ({int(ambos)})</span></>}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top clientes por LTV */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Maiores clientes (LTV)</h2>
        <p style={{ fontSize: 12.5, color: 'var(--sub)', marginBottom: 12 }}>Quem mais gastou na marca somando todos os produtos e gateways.</p>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              <th style={{ ...thR, textAlign: 'left' }}>Cliente</th>
              <th style={{ ...thR, textAlign: 'left' }}>Famílias</th>
              <th style={thR}>Pedidos</th>
              <th style={thR}>LTV</th>
              <th style={thR}>Líquido</th>
              <th style={thR}>1ª compra</th>
            </tr></thead>
            <tbody>
              {clientes.map((c, i) => (
                <tr key={c.email + i} style={{ borderTop: i ? '1px solid rgba(0,0,0,.05)' : 'none' }}>
                  <td style={td}><div style={{ fontWeight: 700 }}>{c.nome || '—'}</div><div style={{ fontSize: 11.5, color: 'var(--mute)' }}>{mask(c.email)}</div></td>
                  <td style={{ ...td, fontSize: 12.5 }}>{N(c.n_familias) > 1 ? <strong style={{ color: 'var(--g)' }}>{c.familias}</strong> : c.familias}</td>
                  <td style={tdR}>{int(N(c.pedidos))}</td>
                  <td style={{ ...tdR, fontWeight: 800 }} className="font-display">{brl0(N(c.ltv))}</td>
                  <td style={{ ...tdR, color: 'var(--g)' }}>{brl0(N(c.liquido))}</td>
                  <td style={{ ...tdR, color: 'var(--sub)' }}>{dt(c.primeira)}</td>
                </tr>
              ))}
              {clientes.length === 0 && <tr><td colSpan={6} style={{ ...td, color: 'var(--mute)', textAlign: 'center' }}>Sem clientes no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </PainelShell>
  )
}
