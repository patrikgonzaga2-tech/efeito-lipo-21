import { cookies } from 'next/headers'
import Login from '../_login'
import { DashboardShell } from '../_shell'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Anúncios — Efeito Lipo', robots: { index: false, follow: false } }

export default async function AnunciosPage() {
  const jar = await cookies()
  const pw = process.env.QUIZ_DASHBOARD_PASSWORD
  if (!(Boolean(pw) && jar.get('qd_auth')?.value === pw)) return <Login configured={Boolean(pw)} />

  return (
    <DashboardShell active="anuncios">
      <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>Anúncios</h1>
      <p style={{ fontSize: 13.5, color: 'var(--sub)', marginBottom: 18 }}>Campanhas, conjuntos e anúncios — ranking dos melhores.</p>
      <div className="rounded-2xl p-8 text-center" style={{ background: '#fff', border: '1px dashed rgba(0,0,0,.15)' }}>
        <div style={{ fontSize: 32 }}>🏗️</div>
        <p className="font-display" style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginTop: 8 }}>Em construção</p>
        <p style={{ fontSize: 13.5, color: 'var(--sub)', marginTop: 4 }}>Próxima etapa: ranking de campanhas, conjuntos e anúncios pelas métricas do Meta.</p>
      </div>
    </DashboardShell>
  )
}
