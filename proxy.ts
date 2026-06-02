import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ────────────────────────────────────────────────────────────────────
// Teste A/B do Efeito Lipo
//
// Quem acessa /efeito-lipo é redirecionado aleatoriamente (50/50) para
// /efeito-lipo-a ou /efeito-lipo-b. A escolha fica "grudada" em um cookie
// por 30 dias, então o mesmo visitante sempre vê a mesma versão — isso
// mantém o teste limpo (a pessoa não fica alternando entre A e B).
//
// Em ambos os casos adicionamos ?variante=<slug> na URL e preservamos
// qualquer UTM que já tenha vindo do anúncio.
// ────────────────────────────────────────────────────────────────────

const VARIANTES = ['efeito-lipo-a', 'efeito-lipo-b'] as const
const COOKIE = 'el_variante'

export function proxy(request: NextRequest) {
  // Versão já sorteada antes? Reaproveita. Senão, sorteia 50/50.
  const salva = request.cookies.get(COOKIE)?.value
  const variante =
    salva && (VARIANTES as readonly string[]).includes(salva)
      ? salva
      : VARIANTES[Math.floor(Math.random() * VARIANTES.length)]

  // Mantém os parâmetros que já vieram (utm_source, utm_campaign, etc.)
  // e acrescenta o nosso variante=<slug>.
  const url = request.nextUrl.clone()
  url.pathname = `/${variante}`
  url.searchParams.set('variante', variante)

  const res = NextResponse.redirect(url)
  res.cookies.set(COOKIE, variante, {
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
  })
  return res
}

export const config = {
  matcher: '/efeito-lipo',
}
