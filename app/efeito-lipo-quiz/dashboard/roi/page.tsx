import { Fragment } from 'react'
import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'ROI — Efeito Lipo', robots: { index: false, follow: false } }

// Uma linha por conjunto (adset), vinda da função roi_conjuntos do banco.
type RoiRow = {
  adset_id: string
  adset_name: string | null
  campaign_id: string | null
  campaign_name: string | null
  spend: number
  sessions: number
  checkouts: number
  vendas: number
  receita: number
}

// ── formatação ──────────────────────────────────────────────────────
const brl = (n: number) =>
  'R$ ' + Math.round(n).toLocaleString('pt-BR')
const roasOf = (receita: number, spend: number) => (spend > 0 ? receita / spend : 0)
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

// Cor do ROAS: verde ≥ 1 (lucro), vermelho < 1 com receita (prejuízo),
// cinza quando ainda não há receita atribuída.
function roasStyle(receita: number, spend: number): { txt: string; color: string } {
  if (receita <= 0) return { txt: '—', color: 'var(--mute)' }
  const r = roasOf(receita, spend)
  return { txt: r.toFixed(2) + 'x', color: r >= 1 ? 'var(--g)' : '#c0392b' }
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

function PeriodFilter({ range, from, to, periodLabel }: { range: string; from?: string; to?: string; periodLabel: string }) {
  const presets: [string, string][] = [['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Mês atual']]
  const pill = (active: boolean): React.CSSProperties => ({
    padding: '8px 14px', borderRadius: 99, fontSize: 13.5, fontWeight: 700, textDecoration: 'none',
    border: active ? '1px solid var(--o)' : '1px solid rgba(0,0,0,.12)',
    background: active ? 'var(--o)' : '#fff', color: active ? '#fff' : 'var(--ink)',
    whiteSpace: 'nowrap', display: 'inline-block',
  })
  const inp: React.CSSProperties = { padding: '7px 10px', borderRadius: 10, border: '1px solid rgba(0,0,0,.14)', fontSize: 13.5, background: '#fff', color: 'var(--ink)' }
  return (
    <div className="rounded-2xl p-4 mb-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
      <div className="flex flex-wrap items-center gap-2">
        {presets.map(([k, label]) => <a key={k} href={`?range=${k}`} style={pill(range === k)}>{label}</a>)}
        <form method="get" className="flex flex-wrap items-center gap-2" style={{ marginLeft: 'auto' }}>
          <input type="hidden" name="range" value="custom" />
          <input type="date" name="from" defaultValue={from} aria-label="De" style={inp} />
          <span style={{ color: 'var(--mute)', fontSize: 13 }}>até</span>
          <input type="date" name="to" defaultValue={to} aria-label="Até" style={inp} />
          <button type="submit" style={{ ...pill(range === 'custom'), cursor: 'pointer', border: range === 'custom' ? '1px solid var(--g)' : '1px solid rgba(0,0,0,.12)', background: range === 'custom' ? 'var(--g)' : 'var(--ink)', color: '#fff' }}>Aplicar</button>
        </form>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 10 }}>
        Mostrando <strong style={{ color: 'var(--ink)' }}>{periodLabel}</strong>
      </div>
    </div>
  )
}

type SearchParams = { range?: string; from?: string; to?: string }

export default async function RoiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  const authed = Boolean(pw) && jar.get('qd_auth')?.value === pw
  if (!authed) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) {
    return <Shell><p style={{ color: 'var(--sub)' }}>Supabase não configurado no servidor.</p></Shell>
  }

  // ── Período (fuso de Brasília -03:00). Padrão: mês atual. ───────────
  const sp = await searchParams
  const range = sp.range || 'mes'
  const spToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD
  const nowIso = new Date().toISOString()
  let since: string
  let until = nowIso
  let periodLabel: string
  if (range === 'custom' && (sp.from || sp.to)) {
    since = `${sp.from || spToday}T00:00:00-03:00`
    until = `${sp.to || spToday}T23:59:59-03:00`
    periodLabel = `${sp.from || '…'} até ${sp.to || '…'}`
  } else if (range === 'hoje') {
    since = `${spToday}T00:00:00-03:00`; periodLabel = 'hoje'
  } else if (range === '7d') {
    since = new Date(Date.now() - 7 * 86_400_000).toISOString(); periodLabel = 'últimos 7 dias'
  } else if (range === '30d') {
    since = new Date(Date.now() - 30 * 86_400_000).toISOString(); periodLabel = 'últimos 30 dias'
  } else {
    since = `${spToday.slice(0, 7)}-01T00:00:00-03:00`; periodLabel = 'mês atual'
  }

  const rows = await sbRpc<RoiRow>('roi_conjuntos', { p_since: since, p_until: until })

  // ── Totais ─────────────────────────────────────────────────────────
  const tot = rows.reduce(
    (a, r) => ({
      spend: a.spend + Number(r.spend), receita: a.receita + Number(r.receita),
      vendas: a.vendas + Number(r.vendas), sessions: a.sessions + Number(r.sessions),
      checkouts: a.checkouts + Number(r.checkouts),
    }),
    { spend: 0, receita: 0, vendas: 0, sessions: 0, checkouts: 0 },
  )
  const roasTot = roasOf(tot.receita, tot.spend)
  const cpa = tot.vendas > 0 ? tot.spend / tot.vendas : 0

  // ── Agrupa por campanha (2 níveis) ─────────────────────────────────
  const byCamp = new Map<string, { name: string; rows: RoiRow[] }>()
  for (const r of rows) {
    if (Number(r.spend) <= 0 && Number(r.vendas) <= 0) continue // ignora ruído sem gasto nem venda
    const key = r.campaign_id || r.adset_id
    const name = r.campaign_name || '(sem campanha)'
    if (!byCamp.has(key)) byCamp.set(key, { name, rows: [] })
    byCamp.get(key)!.rows.push(r)
  }
  const camps = [...byCamp.values()]
    .map((c) => {
      const s = c.rows.reduce(
        (a, r) => ({
          spend: a.spend + Number(r.spend), receita: a.receita + Number(r.receita),
          vendas: a.vendas + Number(r.vendas), sessions: a.sessions + Number(r.sessions),
          checkouts: a.checkouts + Number(r.checkouts),
        }),
        { spend: 0, receita: 0, vendas: 0, sessions: 0, checkouts: 0 },
      )
      return { ...c, ...s, rows: c.rows.slice().sort((x, y) => Number(y.spend) - Number(x.spend)) }
    })
    .sort((a, b) => b.spend - a.spend)

  const th: React.CSSProperties = { padding: '10px 12px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--mute)', textAlign: 'right' }
  const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13.5, textAlign: 'right', color: 'var(--ink)' }

  return (
    <Shell>
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Investimento × Retorno</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Gasto do Meta cruzado com as vendas da Hotmart, por conjunto de anúncio.</p>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      {/* KPIs */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Card label="Investido" value={brl(tot.spend)} sub="Meta Ads" />
        <Card label="Receita" value={brl(tot.receita)} sub="Hotmart (vendas atribuídas)" accent="var(--g)" />
        <Card label="ROAS" value={tot.receita > 0 ? roasTot.toFixed(2) + 'x' : '—'} sub="retorno por R$ investido" accent={tot.receita > 0 ? (roasTot >= 1 ? 'var(--g)' : '#c0392b') : 'var(--mute)'} />
        <Card label="Vendas" value={String(tot.vendas)} sub={tot.vendas > 0 ? `CPA ${brl(cpa)}` : 'aguardando atribuição'} accent="var(--o)" />
      </div>

      {/* Aviso sobre a receita em construção */}
      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
        💡 A <strong>receita por conjunto</strong> começou a ser rastreada hoje (cada venda nova já chega com o id do conjunto). Vendas antigas aparecem como <em>não atribuídas</em>. O gasto e o funil (sessões/checkouts) já são completos.
      </div>

      {/* Tabela 2 níveis: campanha › conjunto */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>Desempenho por campanha e conjunto</h2>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                <th style={{ ...th, textAlign: 'left' }}>Campanha › Conjunto</th>
                <th style={th}>Investido</th>
                <th style={th}>Sessões</th>
                <th style={th}>Checkouts</th>
                <th style={th}>Vendas</th>
                <th style={th}>Receita</th>
                <th style={th}>ROAS</th>
              </tr>
            </thead>
            <tbody>
              {camps.length === 0 && (
                <tr><td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--mute)', padding: 24 }}>Sem dados no período.</td></tr>
              )}
              {camps.map((c) => {
                const rs = roasStyle(c.receita, c.spend)
                return (
                  <Fragment key={c.name}>
                    {/* Linha da campanha (subtotal) */}
                    <tr style={{ background: 'rgba(0,0,0,.025)', borderTop: '1px solid rgba(0,0,0,.08)' }}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>{c.name}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{brl(c.spend)}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{c.sessions.toLocaleString('pt-BR')}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{c.checkouts.toLocaleString('pt-BR')}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{c.vendas}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{brl(c.receita)}</td>
                      <td style={{ ...td, fontWeight: 800, color: rs.color }}>{rs.txt}</td>
                    </tr>
                    {/* Conjuntos da campanha */}
                    {c.rows.map((r) => {
                      const r2 = roasStyle(Number(r.receita), Number(r.spend))
                      return (
                        <tr key={r.adset_id} style={{ borderTop: '1px solid rgba(0,0,0,.04)' }}>
                          <td style={{ ...td, textAlign: 'left', color: 'var(--sub)', paddingLeft: 28 }}>↳ {r.adset_name || r.adset_id}</td>
                          <td style={td}>{brl(Number(r.spend))}</td>
                          <td style={td}>{Number(r.sessions).toLocaleString('pt-BR')}</td>
                          <td style={td}>{Number(r.checkouts).toLocaleString('pt-BR')} <span style={{ color: 'var(--mute)', fontSize: 11.5 }}>· {pct(Number(r.checkouts), Number(r.sessions))}%</span></td>
                          <td style={td}>{Number(r.vendas)}</td>
                          <td style={td}>{brl(Number(r.receita))}</td>
                          <td style={{ ...td, fontWeight: 700, color: r2.color }}>{r2.txt}</td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--pale)' }}>
      <header className="sticky top-0 z-20" style={{ background: 'var(--gd)', color: '#fff' }}>
        <div className="mx-auto flex items-center justify-between px-6 py-4" style={{ maxWidth: 1100 }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: 18 }}>ROI <span style={{ color: 'var(--o)' }}>Meta Ads</span></div>
          <a href="/efeito-lipo-quiz/dashboard" style={{ fontSize: 12.5, color: 'rgba(255,255,255,.75)', textDecoration: 'underline' }}>← Dashboard do quiz</a>
        </div>
      </header>
      <main className="mx-auto px-6 py-7" style={{ maxWidth: 1100 }}>{children}</main>
    </div>
  )
}
