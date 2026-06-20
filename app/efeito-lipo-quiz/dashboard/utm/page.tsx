import { cookies } from 'next/headers'
import { sbRpc, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Origem das vendas (UTM) — Efeito Lipo', robots: { index: false, follow: false } }

type VUtm = {
  received_at: string; product_name: string | null; price: number; sck: string | null; src: string | null
  utm_source: string | null; utm_campaign: string | null; utm_medium: string | null; utm_content: string | null
}

const N = (v: unknown) => Number(v) || 0
const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)
// Decodifica UTM (vem url-encoded, com + no lugar de espaço).
const dec = (s: string | null): string => {
  if (!s) return ''
  try { return decodeURIComponent(s.replace(/\+/g, ' ')) } catch { return s.replace(/\+/g, ' ') }
}
// timeZone fixo: o dashboard renderiza no servidor (UTC na Vercel); sem isso o
// horário sairia 3h adiantado. America/Sao_Paulo = fuso de Brasília.
const fmtDate = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Card({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)', boxShadow: '0 4px 16px rgba(0,0,0,.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--mute)' }}>{label}</div>
      <div className="font-display" style={{ fontSize: 30, fontWeight: 800, color: accent || 'var(--ink)', lineHeight: 1.1, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: 'var(--sub)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

// Agrupa vendas por uma dimensão e renderiza tabela (vendas, receita, %).
function Breakdown({ title, rows, keyOf, totalReceita, empty }: { title: string; rows: VUtm[]; keyOf: (v: VUtm) => string; totalReceita: number; empty: string }) {
  const map = new Map<string, { vendas: number; receita: number }>()
  for (const v of rows) {
    const k = keyOf(v) || empty
    const e = map.get(k) || { vendas: 0, receita: 0 }
    e.vendas += 1; e.receita += N(v.price)
    map.set(k, e)
  }
  const items = [...map.entries()].map(([k, e]) => ({ k, ...e })).sort((a, b) => b.receita - a.receita)
  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 13, color: 'var(--ink)' }
  return (
    <section className="mt-7">
      <h2 className="font-display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>{title}</h2>
      <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
            <th style={{ ...td, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)', fontWeight: 700 }}>{title}</th>
            <th style={{ ...td, textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>Vendas</th>
            <th style={{ ...td, textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>Receita</th>
            <th style={{ ...td, textAlign: 'right', fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>% receita</th>
          </tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--mute)', padding: 18 }}>Sem vendas no período.</td></tr>}
            {items.map((it) => (
              <tr key={it.k} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                <td style={{ ...td, fontWeight: 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.k}</td>
                <td style={{ ...td, textAlign: 'right' }}>{it.vendas}</td>
                <td style={{ ...td, textAlign: 'right' }}>{brl0(it.receita)}</td>
                <td style={{ ...td, textAlign: 'right', color: 'var(--sub)' }}>{pct(it.receita, totalReceita)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default async function UtmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="utm"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  const vendas = await sbRpc<VUtm>('vendas_utm', { p_since: since, p_until: until })

  const totalVendas = vendas.length
  const totalReceita = vendas.reduce((a, v) => a + N(v.price), 0)
  const comUtm = vendas.filter((v) => v.utm_source || v.utm_campaign).length

  const td: React.CSSProperties = { padding: '8px 12px', fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'nowrap' }

  return (
    <DashboardShell active="utm">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Origem das vendas (UTM)</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Vendas reais da Hotmart cruzadas com os UTMs do anúncio (pelo id do conjunto). Mostra exatamente de onde veio cada venda.</p>
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <Card label="Vendas" value={String(totalVendas)} sub="reais (Hotmart)" />
        <Card label="Receita" value={brl0(totalReceita)} sub="no período" accent="var(--g)" />
        <Card label="Com UTM" value={`${pct(comUtm, totalVendas)}%`} sub={`${comUtm} de ${totalVendas} com origem identificada`} accent="var(--o)" />
      </div>

      <div className="rounded-xl p-3 mt-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
        💡 O UTM completo (origem/campanha/conjunto) só existe nas vendas que passaram pelo funil com o rastreio novo (desde 19/06). Vendas anteriores ou orgânicas aparecem como <em>sem rastreio</em>. O funil (sck) está em todas.
      </div>

      <Breakdown title="Funil (sck)" rows={vendas} keyOf={(v) => v.sck || ''} totalReceita={totalReceita} empty="(sem sck)" />
      <Breakdown title="Origem (utm_source)" rows={vendas} keyOf={(v) => dec(v.utm_source)} totalReceita={totalReceita} empty="(sem rastreio / orgânico)" />
      <Breakdown title="Campanha (utm_campaign)" rows={vendas} keyOf={(v) => dec(v.utm_campaign)} totalReceita={totalReceita} empty="(sem rastreio)" />
      <Breakdown title="Conjunto (utm_medium)" rows={vendas} keyOf={(v) => dec(v.utm_medium)} totalReceita={totalReceita} empty="(sem rastreio)" />

      {/* Detalhe: cada venda com a cadeia completa de UTM */}
      <section className="mt-7">
        <h2 className="font-display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 10 }}>Detalhe das vendas</h2>
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              {['Quando', 'Produto', 'Valor', 'Funil', 'Origem', 'Campanha', 'Conjunto', 'Anúncio'].map((h) => <th key={h} style={{ ...td, textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: 'var(--mute)', fontWeight: 700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {vendas.length === 0 && <tr><td colSpan={8} style={{ ...td, textAlign: 'center', color: 'var(--mute)', padding: 18 }}>Sem vendas no período.</td></tr>}
              {vendas.slice(0, 80).map((v, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                  <td style={td}>{fmtDate(v.received_at)}</td>
                  <td style={{ ...td, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.product_name || '—'}</td>
                  <td style={{ ...td, fontWeight: 700 }}>{brl0(N(v.price))}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{v.sck || '—'}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{dec(v.utm_source) || '—'}</td>
                  <td style={{ ...td, color: 'var(--sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{dec(v.utm_campaign) || '—'}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{dec(v.utm_medium) || '—'}</td>
                  <td style={{ ...td, color: 'var(--sub)' }}>{dec(v.utm_content) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </DashboardShell>
  )
}
