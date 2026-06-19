// Estrutura do dashboard: menu lateral com grupos + abas. Server component
// (a aba ativa vem por prop). Pensado pra crescer: novos grupos entram no
// array GROUPS.
import type { ReactNode } from 'react'

const BASE = '/efeito-lipo-quiz/dashboard'

const GROUPS: { label: string; tabs: { key: string; label: string; href: string }[] }[] = [
  {
    label: 'Quiz',
    tabs: [
      { key: 'funil', label: 'Funil', href: `${BASE}/funil` },
      { key: 'quiz', label: 'Quiz', href: `${BASE}/quiz` },
      { key: 'anuncios', label: 'Anúncios', href: `${BASE}/anuncios` },
    ],
  },
]

export function DashboardShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] md:flex" style={{ background: 'var(--pale)' }}>
      <aside className="md:w-56 md:shrink-0 md:min-h-[100dvh] md:sticky md:top-0 z-20" style={{ background: 'var(--gd)', color: '#fff' }}>
        <div className="px-5 py-4 font-display" style={{ fontWeight: 800, fontSize: 18 }}>
          Dashboard <span style={{ color: 'var(--o)' }}>Efeito Lipo</span>
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
                      href={t.href}
                      className="block rounded-lg px-3 py-2 whitespace-nowrap transition-colors"
                      style={{ fontSize: 14, fontWeight: 700, color: on ? '#000' : 'rgba(255,255,255,.82)', background: on ? 'var(--o)' : 'transparent' }}
                    >
                      {t.label}
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
