// Classificação de produto por nome — compartilhada pelas abas Produtos e
// Gateways (antes era copiada nas duas, e as cópias divergiam).
//
// ARMADILHA que isto resolve: cada gateway cadastra o nome do produto do seu
// jeito. A Greenn escreve "#EFEITO LIPO 21D - Vitálicio" (acento no A) e a
// Hotmart "EFEITO LIPO 21D - Vitalício" (acento no I). Comparar a string crua
// deixava o da Greenn cair no genérico 'efeito lipo' e ser contado como
// PRINCIPAL. Por isso normalizamos: tiramos os acentos antes de comparar.

export type Cat = 'main' | 'cinturinha' | 'livro' | 'vitalicio' | 'dieta' | 'outro'

// "Vitálicio" e "Vitalício" viram "vitalicio" — o acento deixa de importar.
const semAcento = (s: string) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function categorize(name: string): Cat {
  const n = semAcento(name)
  if (n.includes('vitalic')) return 'vitalicio'   // antes do genérico: o nome contém "efeito lipo"
  if (n.includes('cinturinha')) return 'cinturinha'
  if (n.includes('dieta metab')) return 'dieta'
  if (n.includes('receita') || n.includes('livro')) return 'livro'
  if (n.includes('efeito lipo')) return 'main'
  return 'outro'
}

// Order bumps, na ordem em que aparecem nas tabelas do dashboard.
export const BUMPS: { nome: string; cat: Cat }[] = [
  { nome: 'Efeito Lipo Vitalício', cat: 'vitalicio' },
  { nome: 'Cinturinha Express', cat: 'cinturinha' },
  { nome: 'Livro de Receitas', cat: 'livro' },
  { nome: 'Dieta Metabólica', cat: 'dieta' },
]

// Principal + bumps (usado onde a tabela mostra tudo junto).
export const PRODUTOS: { nome: string; cat: Cat }[] = [
  { nome: 'Efeito Lipo (principal)', cat: 'main' },
  ...BUMPS,
]
