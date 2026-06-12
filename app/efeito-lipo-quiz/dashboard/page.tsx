import { cookies } from 'next/headers'
import { sbSelect, supabaseConfigured } from '@/lib/supabase'
import { STEPS } from '../_data'
import type { Step } from '../_data'
import Login from './_login'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Dashboard — Efeito Lipo Quiz', robots: { index: false, follow: false } }

type SessionRow = {
  id: string
  created_at: string
  status: string
  reached_index: number
  variante?: string | null
  utm_source?: string | null
  altura?: number | null
  peso?: number | null
  meta_peso?: number | null
  answers?: Record<string, string | string[]>
  completed_at?: string | null
  checkout_clicked?: boolean | null
  checkout_at?: string | null
}

// ── helpers de rótulo ───────────────────────────────────────────────
function stepLabel(s: Step): string {
  switch (s.kind) {
    case 'intro': return 'Início'
    case 'laura': return 'Apresentação Laüra'
    case 'prova': return 'Prova social'
    case 'insight': return 'Insight inflamação'
    case 'loading': return 'Carregando'
    case 'input': return s.headline
    case 'result': return 'Resultado'
    case 'sales': return 'Página de vendas'
    default: return s.headline
  }
}
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 34, fontWeight: 800, color: accent || 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Bar({ label, value, total, color = 'var(--o)' }: { label: string; value: number; total: number; color?: string }) {
  const w = total > 0 ? Math.max(2, (value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3" style={{ fontSize: 13 }}>
      <div style={{ width: 200, flexShrink: 0, color: 'var(--sub)' }} className="truncate">{label}</div>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 22, background: 'rgba(0,0,0,.05)' }}>
        <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: 99, transition: 'width .4s' }} />
      </div>
      <div className="font-display" style={{ width: 78, flexShrink: 0, textAlign: 'right', fontWeight: 700, color: 'var(--ink)' }}>
        {value} <span style={{ color: 'var(--mute)', fontWeight: 500 }}>· {pct(value, total)}%</span>
      </div>
    </div>
  )
}

function PeriodFilter({ range, from, to, periodLabel, count }: { range: string; from?: string; to?: string; periodLabel: string; count: number }) {
  const presets: [string, string][] = [['1d', '24h'], ['3d', '3 dias'], ['7d', '7 dias'], ['30d', '30 dias'], ['all', 'Tudo']]
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
        Mostrando <strong style={{ color: 'var(--ink)' }}>{periodLabel}</strong> · {count} {count === 1 ? 'sessão' : 'sessões'}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>{title}</h2>
      {children}
    </section>
  )
}

type SearchParams = { range?: string; from?: string; to?: string }

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  const authed = Boolean(pw) && jar.get('qd_auth')?.value === pw
  if (!authed) return <Login configured={Boolean(pw)} />

  if (!supabaseConfigured()) {
    return <Shell><p style={{ color: 'var(--sub)' }}>Supabase não configurado no servidor (defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).</p></Shell>
  }

  // ── Filtro de período ─────────────────────────────────────────────
  // Presets = janelas móveis (últimas N×24h). Personalizado = datas no
  // fuso de Brasília (-03:00) pra alinhar ao dia certo do usuário.
  const sp = await searchParams
  const range = sp.range || 'all'
  const DAY = 86_400_000
  const PRESET_DAYS: Record<string, number> = { '1d': 1, '3d': 3, '7d': 7, '30d': 30 }
  let sinceIso: string | null = null
  let untilIso: string | null = null
  let periodLabel = 'todo o período'
  if (range === 'custom' && (sp.from || sp.to)) {
    if (sp.from) sinceIso = `${sp.from}T00:00:00-03:00`
    if (sp.to) untilIso = `${sp.to}T23:59:59-03:00`
    periodLabel = `${sp.from || '…'} até ${sp.to || '…'}`
  } else if (PRESET_DAYS[range]) {
    const d = PRESET_DAYS[range]
    sinceIso = new Date(Date.now() - d * DAY).toISOString()
    periodLabel = d === 1 ? 'últimas 24 horas' : `últimos ${d} dias`
  }

  let query = 'select=*&order=created_at.desc&limit=5000'
  if (sinceIso) query += `&created_at=gte.${encodeURIComponent(sinceIso)}`
  if (untilIso) query += `&created_at=lte.${encodeURIComponent(untilIso)}`
  const sessions = await sbSelect<SessionRow>('quiz_sessions', query)

  // Pageviews = TODAS as linhas (toda sessão nasce na 1ª tela, com status
  // 'pageview'). Inícios = quem clicou em "Iniciar" (status deixa de ser
  // 'pageview' e vira 'started'/'completed'). 'total' = pageviews: é o
  // denominador do topo do funil.
  const total = sessions.length
  const pageviews = total
  const starts = sessions.filter((s) => s.status !== 'pageview').length
  const completed = sessions.filter((s) => s.status === 'completed').length
  const checkout = sessions.filter((s) => s.checkout_clicked).length
  const reachedSales = sessions.filter((s) => s.reached_index >= 24).length

  // Funil por etapa (quantas sessões alcançaram cada tela)
  const funnelSteps = STEPS.map((s, i) => ({ i, label: `${i}. ${stepLabel(s)}`, count: sessions.filter((x) => x.reached_index >= i).length }))
    .filter((f) => f.i <= 24)

  // Distribuição de respostas (perguntas single/multi)
  const questions = STEPS.filter((s): s is Extract<Step, { kind: 'single' | 'multi' }> => s.kind === 'single' || s.kind === 'multi')
  const distributions = questions.map((q) => {
    const tally: Record<string, number> = {}
    let answered = 0
    for (const sess of sessions) {
      const a = sess.answers?.[q.id]
      if (a == null) continue
      const vals = Array.isArray(a) ? a : [a]
      if (vals.length) answered++
      for (const v of vals) tally[v] = (tally[v] || 0) + 1
    }
    return { q, answered, rows: q.options.map((o) => ({ label: o.label, count: tally[o.id] || 0 })).sort((x, y) => y.count - x.count) }
  })

  // Perfil físico
  const pesos = sessions.map((s) => s.peso).filter((n): n is number => typeof n === 'number' && n > 0)
  const alturas = sessions.map((s) => s.altura).filter((n): n is number => typeof n === 'number' && n > 0)
  const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)

  // Origem (variante + utm_source)
  const byKey = (key: 'variante' | 'utm_source') => {
    const m: Record<string, number> = {}
    for (const s of sessions) { const k = (s[key] || '—') as string; m[k] = (m[k] || 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }

  const recent = sessions.slice(0, 30)
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

  return (
    <Shell>
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} count={total} />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        <Card label="Visualizações" value={String(pageviews)} sub="entraram na 1ª tela" />
        <Card label="Inícios" value={String(starts)} sub={`${pct(starts, pageviews)}% clicaram em iniciar`} accent="var(--gd)" />
        <Card label="Conclusões" value={String(completed)} sub={`${pct(completed, starts)}% de quem iniciou`} accent="var(--g)" />
        <Card label="Chegaram à venda" value={String(reachedSales)} sub={`${pct(reachedSales, pageviews)}% das views`} />
        <Card label="Cliques no checkout" value={String(checkout)} sub={`${pct(checkout, pageviews)}% das views`} accent="var(--o)" />
      </div>

      <Section title="Funil — abandono por tela">
        <div className="rounded-2xl p-5 space-y-2" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          {funnelSteps.map((f) => <Bar key={f.i} label={f.label} value={f.count} total={total} color={f.i >= 24 ? 'var(--g)' : 'var(--o)'} />)}
        </div>
      </Section>

      <Section title="Perfil físico (quem informou)">
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
          <Card label="Peso médio" value={pesos.length ? `${avg(pesos)} kg` : '—'} sub={`${pesos.length} respostas`} />
          <Card label="Altura média" value={alturas.length ? `${avg(alturas)} cm` : '—'} sub={`${alturas.length} respostas`} />
          <Card label="Meta média" value={pesos.length ? `${avg(sessions.map((s) => s.meta_peso).filter((n): n is number => typeof n === 'number' && n > 0))} kg` : '—'} sub="projeção em 21 dias" accent="var(--g)" />
        </div>
      </Section>

      <Section title="Origem do tráfego">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl p-5 space-y-2" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Variante</div>
            {byKey('variante').map(([k, v]) => <Bar key={k} label={k} value={v} total={total} />)}
          </div>
          <div className="rounded-2xl p-5 space-y-2" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>utm_source</div>
            {byKey('utm_source').map(([k, v]) => <Bar key={k} label={k} value={v} total={total} color="var(--g)" />)}
          </div>
        </div>
      </Section>

      <Section title="Distribuição das respostas">
        <div className="grid gap-4 md:grid-cols-2">
          {distributions.map(({ q, answered, rows }) => (
            <div key={q.id} className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
              <div className="font-display" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>{q.headline}</div>
              <div style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 12 }}>{answered} respostas{q.kind === 'multi' ? ' · múltipla' : ''}</div>
              <div className="space-y-2">
                {rows.map((r, i) => <Bar key={i} label={r.label} value={r.count} total={answered} />)}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Sessões recentes">
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--mute)', borderBottom: '1px solid rgba(0,0,0,.08)' }}>
                {['Quando', 'Status', 'Tela', 'Variante', 'Origem', 'Peso→Meta', 'Checkout'].map((h) => <th key={h} style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{fmt(s.created_at)}</td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontWeight: 700, color: s.status === 'completed' ? 'var(--g)' : s.status === 'pageview' ? 'var(--mute)' : 'var(--ink)' }}>{s.status === 'completed' ? 'Concluiu' : s.status === 'pageview' ? 'Só viu a 1ª tela' : 'Em andamento'}</span></td>
                  <td style={{ padding: '9px 12px' }}>{s.reached_index}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{s.variante || '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{s.utm_source || '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{s.peso ? `${s.peso}→${s.meta_peso ?? '?'}kg` : '—'}</td>
                  <td style={{ padding: '9px 12px' }}>{s.checkout_clicked ? '✅' : '—'}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: 'var(--mute)' }}>Nenhuma sessão ainda. Faça o quiz para gerar dados.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh]" style={{ background: 'var(--pale)' }}>
      <header className="sticky top-0 z-20" style={{ background: 'var(--gd)', color: '#fff' }}>
        <div className="mx-auto flex items-center justify-between px-6 py-4" style={{ maxWidth: 1100 }}>
          <div className="font-display" style={{ fontWeight: 800, fontSize: 18 }}>Dashboard <span style={{ color: 'var(--o)' }}>Efeito Lipo</span></div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>Quiz · atualizado a cada carregamento</div>
        </div>
      </header>
      <main className="mx-auto px-6 py-7" style={{ maxWidth: 1100 }}>{children}</main>
    </div>
  )
}
