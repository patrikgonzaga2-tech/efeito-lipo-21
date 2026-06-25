// Shell do PAINEL DA MARCA (nível acima do dashboard do Efeito Lipo).
// Menu com grupos que crescem por fase. Hoje: Marca (Visão Geral) + atalhos para
// a seção Efeito Lipo (que segue no endereço antigo). Cross-sell, Canais e
// Recorrência entram como abas novas nas próximas fases.
import type { ReactNode } from 'react'

const PAINEL = '/painel'
const EL = '/efeito-lipo-quiz/dashboard'

const GROUPS: { label: string; tabs: { key: string; label: string; href: string; soon?: boolean }[] }[] = [
  {
    label: 'Marca',
    tabs: [
      { key: 'marca-geral', label: 'Visão Geral', href: `${PAINEL}` },
      { key: 'marca-canais', label: 'Canais', href: `${PAINEL}/canais` },
      { key: 'marca-cross', label: 'Cross-sell', href: `${PAINEL}/cross-sell` },
      { key: 'marca-mrr', label: 'Recorrência', href: `${PAINEL}/recorrencia` },
    ],
  },
  {
    label: 'Efeito Lipo',
    tabs: [
      { key: 'el-geral', label: 'Geral', href: `${EL}/geral` },
      { key: 'el-funil', label: 'Funil', href: `${EL}/funil` },
      { key: 'el-quiz', label: 'Quiz', href: `${EL}/quiz` },
      { key: 'el-anuncios', label: 'Anúncios', href: `${EL}/anuncios` },
      { key: 'el-utm', label: 'Origem (UTM)', href: `${EL}/utm` },
      { key: 'el-produtos', label: 'Produtos', href: `${EL}/produtos` },
    ],
  },
]

export function PainelShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] md:flex" style={{ background: 'var(--pale)' }}>
      <aside className="md:w-56 md:shrink-0 md:min-h-[100dvh] md:sticky md:top-0 z-20" style={{ background: 'var(--gd)', color: '#fff' }}>
        <div className="px-5 py-4 font-display" style={{ fontWeight: 800, fontSize: 18 }}>
          Painel <span style={{ color: 'var(--o)' }}>da Marca</span>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.5)', marginTop: 2 }}>Corpo Feliz</div>
        </div>
        <nav className="px-3 pb-3">
          {GROUPS.map((g) => (
            <div key={g.label} className="mb-2">
              <div className="hidden md:block px-2 pt-2 pb-1" style={{ fontSize: 10.5, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 700, color: 'rgba(255,255,255,.45)' }}>{g.label}</div>
              <div className="flex md:block gap-2 overflow-x-auto">
                {g.tabs.map((t) => {
                  const on = active === t.key
                  return (
                    <a
                      key={t.key}
                      href={t.soon ? undefined : t.href}
                      aria-disabled={t.soon}
                      className="block rounded-lg px-3 py-2 whitespace-nowrap transition-colors"
                      style={{ fontSize: 14, fontWeight: 700, color: on ? '#000' : 'rgba(255,255,255,.82)', background: on ? 'var(--o)' : 'transparent', opacity: t.soon ? 0.4 : 1, cursor: t.soon ? 'default' : 'pointer' }}
                    >
                      {t.label}{t.soon && <span style={{ fontSize: 9.5, fontWeight: 700, marginLeft: 6, padding: '1px 5px', borderRadius: 6, background: 'rgba(255,255,255,.15)', verticalAlign: 'middle' }}>em breve</span>}
                    </a>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>
      <main className="flex-1 min-w-0 px-5 md:px-8 py-6">
        <div className="mx-auto" style={{ maxWidth: 1180 }}>{children}</div>
      </main>
    </div>
  )
}
