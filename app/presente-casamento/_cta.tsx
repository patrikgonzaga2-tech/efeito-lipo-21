'use client'

// CTAs da página do casamento. São client por causa do rastreio (push no
// dataLayer do GTM) e do clique que abre o convite do grupo.

import { useEffect } from 'react'

// ⚠️ ÚNICO PONTO A TROCAR quando o grupo existir: cole aqui o convite
// (https://chat.whatsapp.com/XXXX ou um wa.link). Os três botões da página
// — topo, final e a barra fixa do celular — leem essa constante.
const GRUPO_HREF = 'https://chat.whatsapp.com/COLE_AQUI_O_CONVITE'

function track(event: string, extra: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ event, ...extra })
}

// Dispara a visualização da página no GTM, uma única vez.
export function CasamentoPageview() {
  useEffect(() => { track('casamento_pageview') }, [])
  return null
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.15-1.8-.9-2.07-1-.28-.1-.48-.15-.68.15-.2.3-.78 1-.96 1.2-.18.2-.35.22-.65.07-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.78-1.68-2.08-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.68-1.65-.94-2.26-.25-.6-.5-.5-.68-.5l-.58-.02c-.2 0-.53.08-.8.38-.28.3-1.05 1.03-1.05 2.5s1.08 2.9 1.23 3.1c.15.2 2.1 3.22 5.1 4.52.7.3 1.27.48 1.7.62.72.23 1.37.2 1.88.12.57-.08 1.8-.73 2.05-1.44.25-.7.25-1.32.18-1.44-.07-.13-.27-.2-.57-.35z" />
      <path d="M12 2C6.48 2 2 6.48 2 12c0 1.77.46 3.44 1.27 4.88L2 22l5.25-1.38A9.94 9.94 0 0 0 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18.2c-1.53 0-3-.4-4.28-1.16l-.3-.18-3.12.82.83-3.04-.2-.31A8.16 8.16 0 0 1 3.8 12c0-4.52 3.68-8.2 8.2-8.2s8.2 3.68 8.2 8.2-3.68 8.2-8.2 8.2z" />
    </svg>
  )
}

export function WaCta({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <a
      className="cta"
      href={GRUPO_HREF}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('casamento_cta_click', { local: label })}
      data-cta={label}
      aria-label="Entrar no grupo de convidadas do casamento no WhatsApp"
    >
      <WhatsAppIcon />
      {children}
    </a>
  )
}
