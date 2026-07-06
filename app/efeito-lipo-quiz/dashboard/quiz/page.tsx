import { cookies } from 'next/headers'
import { sbRpc, sbSelectAll, supabaseConfigured } from '@/lib/supabase'
import { STEPS } from '../../_data'
import type { Step } from '../../_data'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = { title: 'Dashboard — Efeito Lipo Quiz', robots: { index: false, follow: false } }

type SessionRow = {
  id: string
  created_at: string
  status: string
  reached_index: number
  variante?: string | null
  intro_ab?: string | null
  utm_source?: string | null
  altura?: number | null
  peso?: number | null
  meta_peso?: number | null
  answers?: Record<string, string | string[]>
  completed_at?: string | null
  checkout_clicked?: boolean | null
  checkout_at?: string | null
  checkout_ab?: string | null
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 14 }}>{title}</h2>
      {children}
    </section>
  )
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  const authed = Boolean(pw) && jar.get('qd_auth')?.value === pw
  if (!authed) return <Login configured={Boolean(pw)} />

  if (!supabaseConfigured()) {
    return <DashboardShell active="quiz"><p style={{ color: 'var(--sub)' }}>Supabase não configurado no servidor (defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).</p></DashboardShell>
  }

  // ── Filtro de período ─────────────────────────────────────────────
  // Mesmo filtro padrão das outras abas (Hoje/7d/30d/Mês atual/Tudo + datas),
  // via resolvePeriod. O quiz só adiciona o "Tudo" e o piso de reinício abaixo.
  const sp = await searchParams
  const { since, until, range, periodLabel: basePeriodLabel } = resolvePeriod({ ...sp, range: sp.range || 'all' })
  let sinceIso = since
  const untilIso = until
  let periodLabel = basePeriodLabel

  // ── Reinício da medição ───────────────────────────────────────────
  // A contagem da 1ª tela foi corrigida (dwell alinhado ao Meta). Os dados
  // ANTES deste marco foram coletados com a lógica antiga/inflada — ficam
  // GUARDADOS no banco, mas o dashboard parte daqui pra refletir só a
  // contagem nova e limpa. Nada é apagado: pra rever o histórico, basta
  // recuar (ou remover) este marco. Piso aplicado a todos os períodos.
  const MEASURE_SINCE = '2026-06-12T16:00:00Z' // 12/06 13h (Brasília)
  if (new Date(sinceIso) < new Date(MEASURE_SINCE)) {
    sinceIso = MEASURE_SINCE
    if (range === 'all') periodLabel = 'desde o reinício · 12/06 13h'
  }

  // Busca paginada (sbSelectAll): o PostgREST corta cada resposta em 1000
  // linhas, então sem paginar o dashboard travaria em 1000 e subcontaria tudo.
  let query = 'select=*&order=created_at.desc'
  if (sinceIso) query += `&created_at=gte.${encodeURIComponent(sinceIso)}`
  if (untilIso) query += `&created_at=lte.${encodeURIComponent(untilIso)}`
  const sessions = await sbSelectAll<SessionRow>('quiz_sessions', query)

  // Números REAIS do Meta + vendas, pro mesmo período (pra comparar com o
  // rastreio próprio do quiz). funil_resumo soma o funil do Meta e as vendas.
  // Vendas do Efeito Lipo nos dois gateways: Hotmart inteira + Greenn só do
  // funil do quiz (p_greenn_sck) — isola da Comunidade recorrente, que também
  // cai na Greenn. Mesmo recorte das abas Geral/Funil.
  type Resumo = { spend: number; lp_views: number; ic: number; purchases_meta: number; vendas_real: number }
  const untilForRpc = untilIso ?? new Date().toISOString()
  const [resumo] = await sbRpc<Resumo>('funil_resumo', { p_since: sinceIso, p_until: untilForRpc, p_greenn_sck: 'efeito-lipo-quiz' })
  const realPV = Number(resumo?.lp_views) || 0
  const realIC = Number(resumo?.ic) || 0
  const realCompras = Number(resumo?.purchases_meta) || 0
  const realVendas = Number(resumo?.vendas_real) || 0
  const realSpend = Number(resumo?.spend) || 0

  // ── Teste A/B de checkout: Hotmart × Greenn ───────────────────────
  // Vendas/receita por gateway, SÓ do funil do quiz (tracking_sck=efeito-lipo-
  // quiz), via RPC quiz_checkout_ab. O denominador (quantos entraram em cada
  // checkout) vem das próprias sessões: checkout_ab é gravado no clique de compra.
  type CheckoutRow = { gateway: string; vendas: number; itens: number; receita: number; liquido: number; reembolsos: number; reembolsos_valor: number }
  let checkoutRows: CheckoutRow[] = []
  try { checkoutRows = await sbRpc<CheckoutRow>('quiz_checkout_ab', { p_since: sinceIso, p_until: untilForRpc }) } catch { checkoutRows = [] }
  const checkoutAb = (['hotmart', 'greenn'] as const).map((g) => {
    const cliques = sessions.filter((s) => s.checkout_ab === g).length
    const row = checkoutRows.find((r) => r.gateway === g)
    const vendas = Number(row?.vendas) || 0
    const receita = Number(row?.receita) || 0
    const liquido = Number(row?.liquido) || 0
    // Gasto rateado pela fatia de cliques do braço (o Meta não separa por
    // checkout — o mesmo tráfego é dividido, então o rateio é proporcional).
    const totalCliques = sessions.filter((s) => s.checkout_ab === 'hotmart' || s.checkout_ab === 'greenn').length
    const spendArm = totalCliques > 0 ? realSpend * (cliques / totalCliques) : 0
    return {
      g,
      label: g === 'hotmart' ? 'Hotmart (A)' : 'Greenn (B)',
      cliques,
      vendas,
      receita,
      liquido,
      taxa: pct(vendas, cliques),
      rps: cliques > 0 ? receita / cliques : 0, // receita por clique de checkout
      roas: spendArm > 0 ? receita / spendArm : 0,
    }
  })
  const abCkLeader = checkoutAb[0].cliques && checkoutAb[1].cliques
    ? (checkoutAb[0].taxa === checkoutAb[1].taxa ? null : checkoutAb[1].taxa > checkoutAb[0].taxa ? 'greenn' : 'hotmart')
    : null
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  // Pageviews = TODAS as linhas (toda sessão nasce na 1ª tela, com status
  // 'pageview'). Inícios = quem clicou em "Iniciar" (status deixa de ser
  // 'pageview' e vira 'started'/'completed'). 'total' = pageviews: é o
  // denominador do topo do funil.
  const total = sessions.length
  const starts = sessions.filter((s) => s.status !== 'pageview').length

  // ── Teste A/B da 1ª tela ──────────────────────────────────────────
  // A = versão original (controle, a que estava no ar) · B = versão nova.
  // "Taxa de início" = inícios ÷ visualizações: a conversão da 1ª tela.
  // Sessões sem intro_ab (anteriores ao teste) ficam de fora da comparação.
  const abStats = (['A', 'B'] as const).map((v) => {
    const rows = sessions.filter((s) => s.intro_ab === v)
    const startsV = rows.filter((s) => s.status !== 'pageview').length
    // Page view REAL (Meta) estimado pra versão: total do Meta repartido pela
    // fatia de sessões da versão (o sorteio é 50/50, então é proporcional).
    const views = total > 0 ? Math.round(realPV * (rows.length / total)) : 0
    return { v, views, starts: startsV, rate: pct(startsV, views), label: v === 'A' ? 'original (controle)' : 'nova' }
  })
  const abLeader = abStats[0].views && abStats[1].views
    ? (abStats[1].rate === abStats[0].rate ? null : abStats[1].rate > abStats[0].rate ? 'B' : 'A')
    : null

  // Funil por etapa (quantas sessões alcançaram cada tela)
  // Tela 0 (início) = visualizações reais do Meta (page view). As demais telas
  // vêm do rastreio do quiz (quem avançou). Denominador do funil = page view real.
  const funnelSteps = STEPS.map((s, i) => ({ i, label: `${i}. ${stepLabel(s)}`, count: i === 0 ? realPV : sessions.filter((x) => x.reached_index >= i).length }))
    .filter((f) => f.i <= 24)
  const funnelTotal = realPV || total

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
  // timeZone fixo (Brasília): o dashboard renderiza no servidor (UTC na Vercel);
  // sem isso o horário sairia 3h adiantado.
  const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—')

  return (
    <DashboardShell active="quiz">
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} presets={[['hoje', 'Hoje'], ['7d', '7 dias'], ['30d', '30 dias'], ['mes', 'Mês atual'], ['all', 'Tudo']]} note={` · ${total} ${total === 1 ? 'sessão' : 'sessões'}`} />
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(168px,1fr))' }}>
        <Card label="Visualizações" value={String(realPV)} sub="page views reais (Meta)" />
        <Card label="Inícios" value={String(starts)} sub={`${pct(starts, realPV)}% das visualizações`} accent="var(--gd)" />
        <Card label="Initiate checkout" value={String(realIC)} sub={`${pct(realIC, realPV)}% das visualizações`} accent="var(--gd)" />
        <Card label="Compras" value={String(realCompras)} sub={`${pct(realCompras, realIC)}% dos checkouts · pixel`} accent="var(--o)" />
        <Card label="Vendas" value={String(realVendas)} sub="reais · Hotmart + Greenn (funil)" accent="var(--g)" />
      </div>

      <Section title="Teste A/B — 1ª tela">
        <div className="grid gap-4 md:grid-cols-2">
          {abStats.map(({ v, views, starts: st, rate, label }) => {
            const win = abLeader === v
            return (
              <div key={v} className="rounded-2xl p-5" style={{ background: '#fff', border: win ? '2px solid var(--g)' : '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                  <span className="font-display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Versão {v}</span>
                  <span style={{ fontSize: 12.5, color: 'var(--mute)' }}>· {label}</span>
                  {win && <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 800, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '.04em' }}>na frente ▲</span>}
                </div>
                <div className="font-display" style={{ fontSize: 40, fontWeight: 800, color: v === 'A' ? 'var(--gd)' : 'var(--o)', lineHeight: 1.1, marginTop: 6 }}>{rate}%</div>
                <div style={{ fontSize: 12.5, color: 'var(--sub)' }}>taxa de início (clicaram em começar)</div>
                <div style={{ fontSize: 13, color: 'var(--sub)', marginTop: 12 }}>
                  ~<strong style={{ color: 'var(--ink)' }}>{views}</strong> page views (Meta) · <strong style={{ color: 'var(--ink)' }}>{st}</strong> inícios
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 10 }}>
          A = 1ª tela original (controle) · B = 1ª tela nova. Sorteio 50/50 por sessão. A taxa usa o <strong>page view real do Meta</strong> repartido entre A e B na proporção das sessões (o Meta não separa A/B nativamente — é estimativa proporcional). Sessões anteriores ao teste ficam fora.
        </div>
      </Section>

      <Section title="Teste A/B — checkout (Hotmart × Greenn)">
        <div className="grid gap-4 md:grid-cols-2">
          {checkoutAb.map((c) => {
            const win = abCkLeader === c.g
            return (
              <div key={c.g} className="rounded-2xl p-5" style={{ background: '#fff', border: win ? '2px solid var(--g)' : '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
                <div className="flex items-center gap-2" style={{ marginBottom: 2 }}>
                  <span className="font-display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{c.label}</span>
                  {win && <span style={{ marginLeft: 'auto', fontSize: 11.5, fontWeight: 800, color: 'var(--g)', textTransform: 'uppercase', letterSpacing: '.04em' }}>na frente ▲</span>}
                </div>
                <div className="font-display" style={{ fontSize: 40, fontWeight: 800, color: c.g === 'hotmart' ? 'var(--gd)' : 'var(--o)', lineHeight: 1.1, marginTop: 6 }}>{c.taxa}%</div>
                <div style={{ fontSize: 12.5, color: 'var(--sub)' }}>taxa de conversão (vendas ÷ quem entrou no checkout)</div>
                <div className="grid grid-cols-2 gap-3" style={{ marginTop: 14 }}>
                  <div><div style={{ fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Entraram</div><div className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{c.cliques}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Vendas</div><div className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--g)' }}>{c.vendas}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Receita</div><div className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{brl(c.receita)}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Receita / entrada</div><div className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--o)' }}>{brl(c.rps)}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>ROAS (estim.)</div><div className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{c.roas ? `${c.roas.toFixed(2)}x` : '—'}</div></div>
                  <div><div style={{ fontSize: 11, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '.05em' }}>Líquido</div><div className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{brl(c.liquido)}</div></div>
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 10 }}>
          Sorteio 50/50 por sessão. <strong>Entraram</strong> = clicaram em comprar e foram para aquele checkout. <strong>Vendas/Receita</strong> vêm da tabela real de vendas, filtradas pelo funil do quiz (só este funil, mesmo que a Greenn tenha outros produtos). O <strong>ROAS é estimado</strong>: o Meta não separa gasto por checkout, então o gasto é rateado pela fatia de entradas de cada braço — a métrica mais limpa para decidir o vencedor é <strong>Receita / entrada</strong>. Vendas por boleto podem cair dias depois do clique.
        </div>
      </Section>

      <Section title="Funil — abandono por tela">
        <div className="rounded-2xl p-5 space-y-2" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          {funnelSteps.map((f) => <Bar key={f.i} label={f.label} value={f.count} total={funnelTotal} color={f.i >= 24 ? 'var(--g)' : 'var(--o)'} />)}
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
                {['Quando', 'Status', 'Tela', '1ª tela', 'Variante', 'Origem', 'Peso→Meta', 'Checkout'].map((h) => <th key={h} style={{ padding: '10px 12px', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(0,0,0,.05)' }}>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{fmt(s.created_at)}</td>
                  <td style={{ padding: '9px 12px' }}><span style={{ fontWeight: 700, color: s.status === 'completed' ? 'var(--g)' : s.status === 'pageview' ? 'var(--mute)' : 'var(--ink)' }}>{s.status === 'completed' ? 'Concluiu' : s.status === 'pageview' ? 'Só viu a 1ª tela' : 'Em andamento'}</span></td>
                  <td style={{ padding: '9px 12px' }}>{s.reached_index}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 700 }}>{s.intro_ab || '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{s.variante || '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{s.utm_source || '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{s.peso ? `${s.peso}→${s.meta_peso ?? '?'}kg` : '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{s.checkout_clicked ? (s.checkout_ab === 'greenn' ? '✅ Greenn' : s.checkout_ab === 'hotmart' ? '✅ Hotmart' : '✅') : '—'}</td>
                </tr>
              ))}
              {!recent.length && <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--mute)' }}>Nenhuma sessão ainda. Faça o quiz para gerar dados.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </DashboardShell>
  )
}
