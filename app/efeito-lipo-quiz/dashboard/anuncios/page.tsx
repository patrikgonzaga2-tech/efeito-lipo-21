import { cookies } from 'next/headers'
import { sbRpc, sbSelect, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'
import { SortableTable, type Metrics, type Row } from '../_sortable'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Anúncios — Efeito Lipo', robots: { index: false, follow: false } }

type Funnel = { spend: number; impressions: number; link_clicks: number; lp_views: number; ic: number; purchases: number; purchase_value: number }
type Conj = Funnel & { adset_id: string; adset_name: string | null; campaign_id: string | null; campaign_name: string | null }
type Ad = Funnel & { ad_id: string; ad_name: string | null; adset_name: string | null; campaign_name: string | null }

const N = (v: unknown) => Number(v) || 0
// Normaliza os números crus (o PostgREST devolve numeric como string).
const mOf = (x: Funnel): Metrics => ({
  spend: N(x.spend), impressions: N(x.impressions), link_clicks: N(x.link_clicks),
  lp_views: N(x.lp_views), ic: N(x.ic), purchases: N(x.purchases), purchase_value: N(x.purchase_value),
})
// Soma duas Metrics (inclui as vendas reais) — usado pra agregar campanhas.
const addM = (a: Metrics, b: Metrics): Metrics => ({
  spend: a.spend + b.spend, impressions: a.impressions + b.impressions, link_clicks: a.link_clicks + b.link_clicks,
  lp_views: a.lp_views + b.lp_views, ic: a.ic + b.ic, purchases: a.purchases + b.purchases, purchase_value: a.purchase_value + b.purchase_value,
  vendas_real: (a.vendas_real ?? 0) + (b.vendas_real ?? 0), receita_real: (a.receita_real ?? 0) + (b.receita_real ?? 0),
})
const ZERO: Metrics = { spend: 0, impressions: 0, link_clicks: 0, lp_views: 0, ic: 0, purchases: 0, purchase_value: 0 }
const ZERO_REAL: Metrics = { ...ZERO, vendas_real: 0, receita_real: 0 }
type Real = { adset_id: string; vendas: number; receita: number; liquido: number }
type RealAd = { anuncio: string; adset_id: string; vendas: number; itens: number; receita: number; liquido: number }

const brl0 = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
const intBR = (n: number) => Math.round(n).toLocaleString('pt-BR')
// Decodifica/normaliza nome (utm_content vem url-encoded com +) p/ casar com o ad_name do Meta.
const dec = (s: string | null) => { if (!s) return ''; try { return decodeURIComponent(s.replace(/\+/g, ' ')) } catch { return s.replace(/\+/g, ' ') } }
const norm = (s: string | null) => dec(s).toLowerCase().replace(/\s+/g, ' ').trim()

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>{title}</h2>
      {note && <p style={{ fontSize: 12, color: 'var(--mute)', marginBottom: 10 }}>{note}</p>}
      <div style={{ marginTop: note ? 0 : 10 }}>{children}</div>
    </section>
  )
}

export default async function AnunciosPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="anuncios"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  const [conjuntos, ads, statusList, vendasReais, vendasAnuncio] = await Promise.all([
    sbRpc<Conj>('ranking_conjuntos', { p_since: since, p_until: until }),
    sbRpc<Ad>('ranking_anuncios', { p_since: since, p_until: until }),
    sbSelect<{ id: string; status: string }>('meta_status', 'select=id,status'),
    sbRpc<Real>('vendas_por_conjunto', { p_since: since, p_until: until }),
    sbRpc<RealAd>('vendas_por_anuncio', { p_since: since, p_until: until }),
  ])
  const statusOf = new Map(statusList.map((s) => [s.id, s.status]))
  // Nome do conjunto por id (pra mostrar na tabela de anúncios reais).
  const adsetNameOf = new Map(conjuntos.map((c) => [c.adset_id, c.adset_name]))
  // Investido por nome de anúncio (normalizado) — pro ROAS real por anúncio,
  // quando o nome do criativo casar com o ad_name do Meta.
  const spendByAdName = new Map<string, number>()
  for (const a of ads) { const k = norm(a.ad_name); if (k) spendByAdName.set(k, (spendByAdName.get(k) || 0) + N(a.spend)) }
  const anuncioRows = vendasAnuncio.map((a) => {
    const spend = spendByAdName.get(norm(a.anuncio)) || 0
    return {
      ...a, nome: dec(a.anuncio) || a.anuncio, conjunto: adsetNameOf.get(a.adset_id) || a.adset_id, spend,
      roas: spend > 0 ? N(a.receita) / spend : null,
      cpa: spend > 0 && N(a.vendas) > 0 ? spend / N(a.vendas) : null,
    }
  })
  // Vendas reais da Hotmart por conjunto (id do conjunto = tracking_src).
  const realOf = new Map(vendasReais.map((r) => [r.adset_id, r]))
  // Métrica do conjunto = pixel (Meta) + vendas reais (0 se o conjunto não vendeu).
  const conjM = (c: Conj): Metrics => {
    const r = realOf.get(c.adset_id)
    return { ...mOf(c), vendas_real: N(r?.vendas), receita_real: N(r?.receita) }
  }

  // Campanhas = soma os conjuntos por campanha (ativa se algum conjunto ativo).
  const campMap = new Map<string, { name: string; active: boolean; m: Metrics }>()
  for (const c of conjuntos) {
    if (N(c.spend) <= 0) continue
    const key = c.campaign_id || c.adset_id
    const e = campMap.get(key) || { name: c.campaign_name || '(sem campanha)', active: false, m: { ...ZERO_REAL } }
    e.m = addM(e.m, conjM(c))
    if (statusOf.get(c.adset_id) === 'ACTIVE') e.active = true
    campMap.set(key, e)
  }
  const campRows: Row[] = [...campMap.entries()]
    .map(([id, e]) => ({ id, lead: [e.name], status: e.active ? 'ACTIVE' : 'PAUSED', m: e.m }))
  const conjRows: Row[] = conjuntos.filter((c) => N(c.spend) > 0)
    .map((c) => ({ id: c.adset_id, lead: [c.adset_name, c.campaign_name], status: statusOf.get(c.adset_id), m: conjM(c) }))
  const adRows: Row[] = ads.filter((a) => N(a.spend) > 0)
    .map((a) => ({ id: a.ad_id, lead: [a.ad_name, a.adset_name], status: statusOf.get(a.ad_id), m: mOf(a) }))

  return (
    <DashboardShell active="anuncios">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Anúncios</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 14 }}>Funil completo por campanha, conjunto e anúncio. Clique em qualquer métrica (ou Status) para ordenar.</p>

      <div className="rounded-xl p-3 mb-4" style={{ fontSize: 12.5, background: 'rgba(245,113,0,.07)', color: 'var(--sub)', lineHeight: 1.55, border: '1px solid rgba(245,113,0,.18)' }}>
        💡 <strong>Compras / ROAS pixel</strong> = o que o pixel do Meta registrou (estimado, atualiza de hora em hora). <strong>Vendas✓ / Receita✓ / ROAS real</strong> = vendas reais da Hotmart, atribuídas ao conjunto pelo id rastreado — é a verdade do caixa. O <strong>ROAS real</strong> só existe em <strong>campanha e conjunto</strong>; no nível de <strong>anúncio</strong> fica "—", porque o rastreio chega só até o conjunto.
      </div>

      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <Section title="Campanhas" note="Ordenado por ROAS real · clique numa coluna para reordenar">
        <SortableTable leadHead={['Campanha']} rows={campRows} hasStatus defaultSort="roas_real" />
      </Section>
      <Section title="Conjuntos" note="Ordenado por ROAS real · clique numa coluna para reordenar">
        <SortableTable leadHead={['Conjunto', 'Campanha']} rows={conjRows} hasStatus defaultSort="roas_real" />
      </Section>
      <Section title="Anúncios (pixel)" note="Métricas do pixel do Meta por anúncio · padrão: compras do pixel">
        <SortableTable leadHead={['Anúncio', 'Conjunto']} rows={adRows} showRank hasStatus defaultSort="purchases" />
      </Section>

      <Section title="Vendas reais por anúncio" note="Vendas da Hotmart ligadas ao anúncio pelo xcod (nome do criativo). Só vale pra vendas após a ponte entrar no ar; o investido/ROAS real só aparece quando o nome do criativo casa com o do Meta.">
        <div className="rounded-2xl overflow-x-auto" style={{ background: '#fff', border: '1px solid rgba(0,0,0,.07)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(0,0,0,.08)' }}>
              {['Anúncio', 'Conjunto', 'Vendas', 'Produtos', 'Receita', 'Investido', 'CPA real', 'ROAS real'].map((h, i) => (
                <th key={h} style={{ padding: '9px 10px', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--mute)', textAlign: i < 2 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {anuncioRows.length === 0 && <tr><td colSpan={8} style={{ padding: 20, textAlign: 'center', color: 'var(--mute)', fontSize: 13 }}>Sem vendas reais atribuídas a anúncio no período (a ponte vale a partir do deploy).</td></tr>}
              {anuncioRows.map((r, i) => (
                <tr key={i} style={{ borderTop: '1px solid rgba(0,0,0,.05)' }}>
                  <td style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nome}</td>
                  <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.conjunto}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right' }}>{intBR(N(r.vendas))}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', color: 'var(--sub)' }}>{intBR(N(r.itens))}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', fontWeight: 700 }}>{brl0(N(r.receita))}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', color: 'var(--sub)' }}>{r.spend > 0 ? brl0(r.spend) : '—'}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', color: 'var(--sub)' }}>{r.cpa == null ? '—' : brl0(r.cpa)}</td>
                  <td style={{ padding: '8px 10px', fontSize: 13, textAlign: 'right', fontWeight: 800, color: r.roas == null ? 'var(--mute)' : r.roas >= 1 ? 'var(--g)' : '#c0392b' }}>{r.roas == null ? '—' : r.roas.toFixed(2) + 'x'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </DashboardShell>
  )
}
