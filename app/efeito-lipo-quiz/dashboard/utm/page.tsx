import { cookies } from 'next/headers'
import { sbRpcAll, supabaseConfigured } from '@/lib/supabase'
import Login from '../_login'
import { DashboardShell } from '../_shell'
import { PeriodFilter, resolvePeriod, type SearchParams } from '../_period'
import UtmExplorer, { type VUtm } from './_explorer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Origem das vendas (UTM) — Efeito Lipo', robots: { index: false, follow: false } }

export default async function UtmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />
  if (!supabaseConfigured()) return <DashboardShell active="utm"><p style={{ color: 'var(--sub)' }}>Supabase não configurado.</p></DashboardShell>

  const sp = await searchParams
  const { since, until, range, periodLabel } = resolvePeriod(sp)
  // sbRpcAll (e não sbRpc): a RPC devolve uma linha por venda e o PostgREST corta
  // em 1.000 — julho tem 1.350, e a aba escondia R$ 20.503 (27% da receita) sem
  // avisar. Como a ordem é da mais recente pra mais antiga, o corte comia os
  // primeiros dias do mês, e "todo o período" repetia os números do mês atual.
  const vendas = await sbRpcAll<VUtm>('vendas_utm', { p_since: since, p_until: until, p_sck: 'efeito-lipo-quiz' })

  return (
    <DashboardShell active="utm">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Origem das vendas (UTM)</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Vendas do <strong>funil do quiz</strong> (Hotmart + Greenn) cruzadas com os UTMs do anúncio, pelo id do conjunto. Clique numa origem pra cruzar com as demais. A assinatura da Comunidade fica fora — ela não tem UTM por natureza e aparecia aqui como se fosse rastreio perdido.</p>
      <PeriodFilter range={range} from={sp.from} to={sp.to} periodLabel={periodLabel} />

      <UtmExplorer vendas={vendas} />
    </DashboardShell>
  )
}
