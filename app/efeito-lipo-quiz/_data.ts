// ════════════════════════════════════════════════════════════════════
// FUNIL DE QUIZ — EFEITO LIPO 21
// Fonte única de copy + configuração das 26 telas.
// Para editar textos do quiz, é aqui. (As telas especiais — Laura,
// prova social, resultado e vendas — têm a copy mais abaixo.)
// ════════════════════════════════════════════════════════════════════

const enc = (file: string) => `/images/${encodeURIComponent(file)}`

export const IMG = {
  laura:       enc('Laura-Arrumada-hero.jpg'),
  heroResult:  enc('Foto-Laura-Barriga-hero.png'),
  antesDepois: enc('Antes e Depois Laura.jpeg'),
  intro:       enc('Antes e Depois Laura 3.jpeg'),
  camila:      enc('Depoimento Camila 30 anos, mãe de 2 e confeitera.jpeg'),
  suhene:      enc('Depoimento Suhene 43 anos mãe.jpeg'),
  gabriela34:  enc('Depoimento Gabriela 34 anos mãe e trabalha fora de casa.jpeg'),
  gabriela27:  enc('Depoimento Gabriela 27 anos com filho autista.jpeg'),
  suelen:      enc('Depoimento Suelen 35 anos mãe e enfermeira noturna.jpg'),
  priscila:    enc('Depoimento Priscila Resultado em 7 dias.jpg'),
  thais:       enc('Depoimento Thais 34 anos.jpg'),
  gilmara:     enc('Depoimento Gilmara mãe de 3 e vó com neto de 5 anos.jpg'),
  celia:       enc('Depoimento Célia 30 anos.jpg'),
  evelyn:      enc('Depoimento 2 Evelyn Mãe.jpg'),
  isabela:     enc('Depoimento Isabela - Mãe.jpg'),
  pamela:      enc('Depoimento Pamela Mãe.jpg'),
} as const

export type ImgKey = keyof typeof IMG

// Checkout Hotmart — o sck fixo (efeito-lipo-quiz) identifica o FUNIL no banco.
export const CHECKOUT_HREF =
  'https://pay.hotmart.com/J105938667T?checkoutMode=10&variante=efeito-lipo-quiz&sck=efeito-lipo-quiz'

// Monta o link de checkout colando dois rastreios que a Hotmart devolve em
// purchase.origin → tabela vendas:
//  • src  = ID do anúncio do Meta (chega na URL como utm_term) → tracking_src
//  • xcod = id de deduplicação que o GTM gerou e guardou em user_id_purchase
//           (o MESMO id enviado ao Meta) → tracking_xcod. Como o botão do quiz
//           nasce tarde (depois das telas), o GTM não o alcança; por isso lemos
//           o xcod da "gaveta" do navegador e colamos aqui na mão.
// Cada parâmetro só entra se existir — nunca suja o link com valor vazio.
export function checkoutHref(adId?: string | null, xcod?: string | null): string {
  const extra: string[] = []
  if (adId) extra.push(`src=${encodeURIComponent(adId)}`)
  if (xcod) extra.push(`xcod=${encodeURIComponent(xcod)}`)
  return extra.length ? `${CHECKOUT_HREF}&${extra.join('&')}` : CHECKOUT_HREF
}

// Chave da "gaveta" do navegador onde guardamos o id do anúncio (utm_term) já
// na ENTRADA do quiz. Lê-la no clique é mais confiável que reler a URL ao vivo:
// em navegador in-app (IG/Android) e recargas a URL pode chegar sem os
// parâmetros, mas a sessão já guardou o valor. Fallback: a própria URL.
export const AD_ID_KEY = 'el_utm_term'
export function readAdId(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fromStore = sessionStorage.getItem(AD_ID_KEY)
    if (fromStore) return fromStore
    const fromUrl = new URLSearchParams(window.location.search).get('utm_term')
    if (fromUrl) { try { sessionStorage.setItem(AD_ID_KEY, fromUrl) } catch {} }
    return fromUrl
  } catch {
    return null
  }
}

// Lê o xcod (id de dedup do Meta). O GTM o injeta na URL da página como `xcod`
// — fonte mais confiável; por isso lemos da URL primeiro. Fallback: a "gaveta"
// do navegador (localStorage/cookie user_id_purchase), caso a URL não o tenha.
export function readXcod(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('xcod')
    if (fromUrl) return fromUrl
    const ls = window.localStorage.getItem('user_id_purchase')
    if (ls) return ls
    const m = document.cookie.match(/(?:^|;\s*)user_id_purchase=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}

// ── Teste A/B de checkout: Hotmart (A) × Greenn (B) ───────────────────
// TODO o controle do teste mora aqui. Para ENCERRAR: ponha enabled:false
// (tudo volta pra Hotmart, comportamento antigo). Para mudar a divisão: ajuste
// greennShare (0.5 = 50/50, 0.2 = 20% Greenn, etc.). Uma linha, sem tocar na
// lógica. O braço é sorteado UMA vez por sessão e guardado na "gaveta" do
// navegador — recargas e cliques repetidos caem sempre no mesmo checkout.
export const CHECKOUT_AB = {
  enabled: true,
  greennShare: 1,
}
export const CHECKOUT_AB_KEY = 'el_checkout_ab'
export type CheckoutArm = 'hotmart' | 'greenn'

// Checkout Greenn (variante B). Oferta com order bumps (b_id/b_offer). O
// checkout da Greenn lê os UTMs da URL e grava em saleMetas — que o greenn-
// webhook já lê. Mantemos os params próprios da oferta (ch_id/bumps) e colamos
// o rastreio, espelhando o mapeamento da Hotmart:
//   utm_source=efeito-lipo-quiz → tracking_sck  (marca o funil do quiz)
//   utm_term=<id do anúncio>    → tracking_src  (o mesmo que vai no src Hotmart)
//   utm_content=<xcod>          → tracking_xcod (ponte de dedup com o Meta)
export const CHECKOUT_HREF_GREENN =
  'https://payfast.greenn.com.br/nbr5yfk/offer/QN7gci?ch_id=140597&b_id_1=123059&b_offer_1=riJmPB&b_id_2=2d2j25c&b_offer_2=TkxWcG&b_id_3=6ahzaqp&b_offer_3=EtpQXF&utm_source=efeito-lipo-quiz'

// Sorteia (ou relê da gaveta) o braço do teste para ESTA sessão. Client-only:
// roda só no navegador, então não há divergência de hidratação — o link inicial
// no servidor é sempre o da Hotmart (CHECKOUT_HREF) e o braço é aplicado depois.
export function pickCheckoutArm(): CheckoutArm {
  if (typeof window === 'undefined') return 'hotmart'
  try {
    const saved = sessionStorage.getItem(CHECKOUT_AB_KEY)
    if (saved === 'hotmart' || saved === 'greenn') return saved
    const arm: CheckoutArm =
      CHECKOUT_AB.enabled && Math.random() < CHECKOUT_AB.greennShare ? 'greenn' : 'hotmart'
    try { sessionStorage.setItem(CHECKOUT_AB_KEY, arm) } catch { /* ignore */ }
    return arm
  } catch {
    return 'hotmart'
  }
}

// Monta o link do checkout do braço, colando o rastreio fresco. Greenn usa os
// nomes UTM; Hotmart usa src/xcod — os dois caem no lugar certo no webhook.
export function checkoutHrefFor(arm: CheckoutArm, adId?: string | null, xcod?: string | null): string {
  if (arm === 'greenn') {
    const extra: string[] = []
    if (adId) extra.push(`utm_term=${encodeURIComponent(adId)}`)
    if (xcod) extra.push(`utm_content=${encodeURIComponent(xcod)}`)
    return extra.length ? `${CHECKOUT_HREF_GREENN}&${extra.join('&')}` : CHECKOUT_HREF_GREENN
  }
  return checkoutHref(adId, xcod)
}

export type BodyVariant = 'lean' | 'bloated' | 'soft' | 'over' | 'much'
export type RegionKey = 'belly' | 'arms' | 'waist' | 'hips' | 'full' | 'none'

// Avatares 3D (mesma mulher, vários corpos) — usados nas telas de corpo e região.
// 'lean' = seca e definida (abdômen marcado) · 'bloated' = magra mas inchada e sem definição.
export const AVATARS: Record<BodyVariant, string> = {
  lean: enc('avatar-lean.png'),
  bloated: enc('avatar-bloated.png'),
  soft: enc('avatar-soft.png'),
  over: enc('avatar-over.png'),
  much: enc('avatar-much.png'),
}

// Mesma mulher com a região marcada (anel + brilho laranja) — tela "qual região
// do seu corpo te incomoda mais". Cada card mostra sua parte sempre destacada.
export const REGION_AVATARS: Record<RegionKey, string> = {
  belly: enc('avatar-region-belly.png'),
  arms:  enc('avatar-region-arms.png'),
  waist: enc('avatar-region-waist.png'),
  hips:  enc('avatar-region-hips.png'),
  full:  enc('avatar-region-full.png'),
  none:  enc('avatar-region-none.png'),
}

export type Opt = {
  id: string
  label: string
  sub?: string
  emoji?: string
  tint?: string
  body?: BodyVariant
  region?: RegionKey
}

export type Step =
  | { kind: 'intro'; id: 'intro' }
  | { kind: 'single'; id: string; progress: number; headline: string; sub?: string; layout: 'plain' | 'chips' | 'body'; cols?: 1 | 2; options: Opt[] }
  | { kind: 'multi'; id: string; progress: number; headline: string; sub?: string; layout: 'plain' | 'region'; options: Opt[] }
  | { kind: 'laura'; id: 'laura'; progress: number }
  | { kind: 'prova'; id: 'prova'; progress: number }
  | { kind: 'insight'; id: 'insight'; progress: number }
  | { kind: 'loading'; id: string; progress: number; title: string; body: string; ticks: string[]; bg: ImgKey; carousel?: { caption: string; images: ImgKey[] } }
  | { kind: 'input'; id: 'altura' | 'peso'; progress: number; headline: string; sub: string; placeholder: string; unit: string; min: number; max: number }
  | { kind: 'result'; id: 'result'; progress: number }
  | { kind: 'sales'; id: 'sales'; progress: number }

export const STEPS: Step[] = [
  { kind: 'intro', id: 'intro' },

  // T2
  {
    kind: 'single', id: 'idade', progress: 5, layout: 'chips', cols: 2,
    headline: 'Qual a sua faixa etária?',
    sub: 'Cada fase da vida tem um metabolismo diferente. Sua resposta define o protocolo ideal para o seu corpo.',
    options: [
      { id: '-29', label: 'Menos de 29 anos', emoji: '🌸', tint: '#F57100' },
      { id: '29-39', label: 'Entre 29 e 39 anos', emoji: '✨', tint: '#1C873C' },
      { id: '40-49', label: 'Entre 40 e 49 anos', emoji: '🌿', tint: '#C54E00' },
      { id: '50+', label: '50 anos ou mais', emoji: '👑', tint: '#004811' },
    ],
  },

  // T3
  { kind: 'laura', id: 'laura', progress: 10 },

  // T4
  {
    kind: 'single', id: 'objetivo', progress: 15, layout: 'plain', cols: 1,
    headline: 'Qual é o seu principal objetivo agora?',
    sub: 'Essa resposta é a que mais impacta o protocolo para o qual você será direcionada.',
    options: [
      { id: 'barriga', emoji: '🪡', label: 'Secar a barriga de vez', sub: 'Acabar com aquele inchaço que não sai nem com reza brava' },
      { id: 'roupa', emoji: '👗', label: 'Caber naquela roupa especial', sub: 'Voltar a usar as peças que você ama e escondeu no fundo do guarda-roupa' },
      { id: 'bracos', emoji: '💪', label: 'Afinar os braços', sub: 'Parar de esconder os braços em toda foto' },
      { id: 'autoestima', emoji: '❤️', label: 'Recuperar minha autoestima', sub: 'Me olhar no espelho e me reconhecer de novo' },
      { id: 'tudo', emoji: '🎯', label: 'Tudo acima', sub: 'Quero a transformação completa' },
    ],
  },

  // T5
  {
    kind: 'single', id: 'tempo-tentando', progress: 20, layout: 'plain', cols: 1,
    headline: 'Há quanto tempo você está tentando emagrecer?',
    sub: 'Seja sincera. Essa resposta é fundamental para entendermos onde o seu metabolismo está travado.',
    options: [
      { id: 'recente', emoji: '⏰', label: 'Comecei a tentar recentemente', sub: 'Menos de 6 meses' },
      { id: 'algum', emoji: '📅', label: 'Faz algum tempo', sub: 'Entre 6 meses e 2 anos' },
      { id: 'muito', emoji: '⏳', label: 'Faz muito tempo', sub: 'Mais de 3 anos tentando' },
      { id: 'tudo', emoji: '🔄', label: 'Já tentei absolutamente tudo', sub: 'E nada funcionou de verdade' },
    ],
  },

  // T6
  {
    kind: 'single', id: 'rotina', progress: 25, layout: 'plain', cols: 1,
    headline: 'Como é a sua rotina hoje?',
    sub: 'O Efeito Lipo foi criado para funcionar na rotina real, não na ideal. 80% das mulheres fizeram o protocolo com rotina corrida, filhos, trabalho e casa.',
    options: [
      { id: 'corrida', emoji: '🏃‍♀️', label: 'Super corrida, mal tenho tempo pra mim', sub: 'Trabalho, filho, casa… o dia acaba antes de eu perceber' },
      { id: 'equilibrada', emoji: '⚖️', label: 'Equilibrada mas sem sobra', sub: 'Consigo me organizar mas não tenho tempo livre' },
      { id: 'casa', emoji: '🏠', label: 'Fico em casa mas nunca sobra tempo', sub: 'Cuido dos filhos e da casa e me perco na rotina' },
      { id: 'tempo', emoji: '🧘', label: 'Tenho tempo para me dedicar', sub: 'Posso investir tempo em mim mesma' },
    ],
  },

  // T7
  {
    kind: 'single', id: 'canetinha', progress: 30, layout: 'plain', cols: 1,
    headline: 'Você já pensou em usar Ozempic, Mounjaro ou alguma canetinha emagrecedora?',
    sub: 'Não existe resposta certa ou errada. Só queremos entender o que você já considerou antes de chegar aqui.',
    options: [
      { id: 'usei', emoji: '💉', label: 'Sim, já usei', sub: 'Tive resultado mas parei e voltou tudo' },
      { id: 'usando', emoji: '💉', label: 'Sim, estou usando', sub: 'Tenho medo de voltar a engordar tudo de novo' },
      { id: 'considerando', emoji: '🤔', label: 'Sim, estou considerando', sub: 'Ainda não decidi mas está na minha cabeça' },
      { id: 'nao-usar', emoji: '❌', label: 'Pensei mas decidi não usar', sub: 'Tenho medo dos efeitos colaterais' },
      { id: 'nunca', emoji: '🙅‍♀️', label: 'Nunca considerei', sub: 'Quero emagrecer de forma natural' },
    ],
  },

  // T8
  {
    kind: 'single', id: 'fisico', progress: 35, layout: 'body', cols: 2,
    headline: 'Como você descreveria seu corpo hoje?',
    sub: 'Escolha uma opção para avançar',
    options: [
      { id: 'inchada', body: 'bloated', label: 'Bem de peso, mas inchada e sem definição', sub: 'As roupas não caem como antes' },
      { id: 'leve-acima', body: 'soft', label: 'Levemente acima do peso' },
      { id: 'acima', body: 'over', label: 'Acima do peso' },
      { id: 'muito-acima', body: 'much', label: 'Muito acima do peso' },
    ],
  },

  // T9
  { kind: 'prova', id: 'prova', progress: 40 },

  // T10
  {
    kind: 'single', id: 'corpo-sonhos', progress: 45, layout: 'body', cols: 2,
    headline: 'Qual é o corpo que você quer ter?',
    sub: 'Visualizar o resultado que deseja aumenta em até 3x as chances de você chegar lá. Escolha com honestidade.',
    options: [
      { id: 'seca', body: 'lean', label: 'Seca e definida' },
      { id: 'lisa', body: 'lean', label: 'Barriga lisa e braços finos' },
      { id: 'curvas', body: 'soft', label: 'Com curvas e sem inchaço' },
      { id: 'leve', body: 'soft', label: 'Leve — me sentir bem no meu corpo' },
    ],
  },

  // T11
  {
    kind: 'single', id: 'alimentacao', progress: 50, layout: 'plain', cols: 1,
    headline: 'Como você descreveria a sua alimentação hoje?',
    sub: 'Seja sincera. Não existe resposta errada — preciso de informações pra montar o seu protocolo com mais precisão.',
    options: [
      { id: 'exagero', emoji: '🍔', label: 'Tento comer bem, mas acabo exagerando', sub: 'Começo bem e perco o controle' },
      { id: 'dieta', emoji: '🥗', label: 'Faço dieta, mas não vejo resultado', sub: 'Como certinho mas não emagreço' },
      { id: 'sem-controle', emoji: '🍕', label: 'Como de tudo sem muito controle', sub: 'Ainda não criei hábito nenhum' },
      { id: 'desorganizada', emoji: '😩', label: 'Completamente desorganizada', sub: 'Não tenho rotina alimentar nenhuma' },
    ],
  },

  // T12
  {
    kind: 'single', id: 'sabotador', progress: 55, layout: 'plain', cols: 1,
    headline: 'Qual é o seu maior sabotador?',
    sub: 'Todo mundo tem um. Identificar o seu é o primeiro passo para parar de lutar contra ele e começar a trabalhar com o seu corpo.',
    options: [
      { id: 'doce', emoji: '🍫', label: 'Doce e chocolate', sub: '“Não consigo resistir a um docinho…”' },
      { id: 'carbo', emoji: '🍞', label: 'Pão, massa e carboidrato', sub: '“Amo pão, não consigo cortar”' },
      { id: 'ansiedade', emoji: '😰', label: 'Ansiedade e estresse', sub: '“Quando estresso, vou direto pra geladeira”' },
      { id: 'noite', emoji: '🌙', label: 'Belisco à noite', sub: '“Depois do jantar não paro mais”' },
      { id: 'delivery', emoji: '🛵', label: 'Delivery e fast food', sub: '“Praticidade é tudo na minha rotina”' },
    ],
  },

  // T13
  {
    kind: 'single', id: 'periodo', progress: 60, layout: 'plain', cols: 1,
    headline: 'Em qual período do dia você mais perde o controle?',
    sub: 'Saber quando você cede ajuda a criar estratégias preventivas. O Efeito Lipo tem abordagem específica para cada momento crítico.',
    options: [
      { id: 'manha', emoji: '☀️', label: 'Manhã', sub: 'Pulo o café ou como demais no lanche' },
      { id: 'tarde', emoji: '🌤️', label: 'Tarde', sub: 'Entre o almoço e o jantar é onde eu desando' },
      { id: 'noite', emoji: '🌙', label: 'Noite', sub: 'Depois do jantar não paro de beliscar' },
      { id: 'dia-todo', emoji: '🎡', label: 'O dia inteiro', sub: 'Belisco sem parar em todos os períodos' },
    ],
  },

  // T14
  {
    kind: 'single', id: 'sono', progress: 65, layout: 'plain', cols: 1,
    headline: 'Como anda seu sono e seu inchaço?',
    sub: 'Dormir mal aumenta o cortisol, o hormônio do estresse, que faz o corpo reter gordura na barriga mesmo quando você come certo.',
    options: [
      { id: 'mal', emoji: '😴', label: 'Durmo mal e acordo cansada', sub: 'Sempre sonolenta durante o dia' },
      { id: 'inchada', emoji: '💤', label: 'Durmo ok, mas acordo inchada', sub: 'O sono é razoável mas retenho muito líquido' },
      { id: 'sem-energia', emoji: '⚡', label: 'Durmo bem, mas sem energia', sub: 'Acordo cansada mesmo dormindo a noite toda' },
      { id: 'bom', emoji: '✨', label: 'Sono bom e energia ok', sub: 'Mas o corpo ainda não responde como eu quero' },
    ],
  },

  // T15
  { kind: 'insight', id: 'insight', progress: 68 },

  // T16
  {
    kind: 'loading', id: 'loading-1', progress: 70, bg: 'priscila',
    title: 'Analisando suas respostas…',
    body: 'Aguarde enquanto o sistema cruza seus dados com o banco de mais de 5.000 transformações reais para montar o seu Protocolo Efeito Lipo personalizado.',
    ticks: ['Verificando seu perfil metabólico…', 'Identificando seus pontos de travamento…', 'Calculando seu potencial de resultado…'],
    carousel: { caption: 'Meu próprio resultado com o Efeito Lipo', images: ['antesDepois', 'heroResult'] },
  },

  // T17
  {
    kind: 'single', id: 'medo', progress: 72, layout: 'plain', cols: 1,
    headline: 'Qual é o seu maior medo em relação a emagrecer?',
    sub: 'Seus medos são válidos. O Efeito Lipo foi criado justamente para eliminar cada um deles.',
    options: [
      { id: 'fracasso', emoji: '😰', label: 'Medo de não conseguir de novo', sub: 'Já fracassei tantas vezes que não acredito mais' },
      { id: 'tempo', emoji: '⏰', label: 'Medo de não ter tempo', sub: 'Minha rotina não deixa espaço pra mais nada' },
      { id: 'dinheiro', emoji: '💰', label: 'Medo de gastar e não ter resultado', sub: 'Já investi em tantas coisas que não funcionaram' },
      { id: 'fome', emoji: '🥗', label: 'Medo de passar fome', sub: 'Não aguento mais dieta restritiva' },
      { id: 'rebote', emoji: '🔄', label: 'Medo do efeito rebote', sub: 'Emagreço e engorda tudo de volta quando paro' },
    ],
  },

  // T18
  {
    kind: 'single', id: 'pensamento', progress: 76, layout: 'plain', cols: 1,
    headline: 'Se você acordasse amanhã no corpo que sempre sonhou, qual seria o seu primeiro pensamento?',
    sub: 'Feche os olhos por 3 segundos e realmente imagine. Visualizar o resultado ativa o cérebro de um jeito que aumenta suas chances de chegar lá.',
    options: [
      { id: 'bonita', emoji: '😍', label: '“Finalmente me sinto bonita de verdade”' },
      { id: 'roupa', emoji: '👗', label: '“Vou usar aquela roupa que ficou guardada por meses”' },
      { id: 'biquini', emoji: '🏖️', label: '“Não vou ter vergonha de colocar biquíni”' },
      { id: 'foto', emoji: '📸', label: '“Vou querer tirar foto em tudo que é lugar”' },
      { id: 'consegui', emoji: '💪', label: '“Consegui. Eu sabia que era capaz”' },
    ],
  },

  // T19
  {
    kind: 'multi', id: 'regiao', progress: 80, layout: 'region',
    headline: 'Qual região do seu corpo te incomoda mais?',
    sub: 'Pode marcar mais de uma',
    options: [
      { id: 'barriga', region: 'belly', label: 'Barriga e inchaço abdominal' },
      { id: 'bracos', region: 'arms', label: 'Braços' },
      { id: 'cintura', region: 'waist', label: 'Cintura e laterais' },
      { id: 'quadril', region: 'hips', label: 'Quadril e coxas' },
      { id: 'inteiro', region: 'full', label: 'Corpo inteiro — tudo me incomoda' },
      { id: 'nenhuma', region: 'none', label: 'Não tenho queixa específica' },
    ],
  },

  // T20
  {
    kind: 'single', id: 'tempo-dia', progress: 83, layout: 'plain', cols: 1,
    headline: 'Quanto tempo você consegue dedicar ao seu corpo por dia?',
    sub: 'O Protocolo do Efeito Lipo foi criado para funcionar em qualquer janela de tempo — inclusive a menor.',
    options: [
      { id: '10-15', emoji: '⚡', label: '10 a 15 minutos', sub: 'Meu tempo é curtíssimo' },
      { id: '15-20', emoji: '🕐', label: '15 a 20 minutos', sub: 'Consigo separar um tempinho' },
      { id: '20-30', emoji: '🕑', label: '20 a 30 minutos', sub: 'Tenho essa janela disponível' },
      { id: '30+', emoji: '🕒', label: 'Mais de 30 minutos', sub: 'Posso me dedicar bem' },
    ],
  },

  // T21
  {
    kind: 'multi', id: 'motivo', progress: 86, layout: 'plain',
    headline: 'O que te fez chegar até aqui hoje?',
    sub: 'Pode marcar mais de uma opção',
    options: [
      { id: 'confianca', emoji: '✨', label: 'Me sentir confiante no próprio corpo' },
      { id: 'roupas', emoji: '👗', label: 'Voltar a usar as roupas que eu amo' },
      { id: 'saude', emoji: '🫀', label: 'Ter mais saúde e energia no dia a dia' },
      { id: 'fotos', emoji: '📸', label: 'Parar de me esconder nas fotos' },
      { id: 'provar', emoji: '🏆', label: 'Provar pra mim mesma que consigo' },
    ],
  },

  // T22
  {
    kind: 'input', id: 'altura', progress: 89, unit: 'cm', min: 120, max: 220,
    headline: 'Qual é a sua altura?',
    sub: 'Digite em centímetros — por exemplo, 162 para 1,62m',
    placeholder: 'Ex: 162',
  },

  // T23
  {
    kind: 'input', id: 'peso', progress: 91, unit: 'kg', min: 35, max: 200,
    headline: 'Qual é o seu peso atual?',
    sub: 'Digite em kg — por exemplo, 74 para 74kg',
    placeholder: 'Ex: 74',
  },

  // T24
  {
    kind: 'loading', id: 'loading-2', progress: 93, bg: 'suhene',
    title: 'Montando o seu Protocolo Efeito Lipo…',
    body: 'Quase lá. Estamos usando suas respostas para personalizar as três fases do protocolo — Limpeza, Ativação Metabólica e Queima Total — de acordo com o seu perfil.',
    ticks: ['Calculando sua fase de limpeza ideal…', 'Ajustando a ativação metabólica pro seu ritmo…', 'Estimando seu potencial de resultado em 21 dias…'],
  },

  // T25
  { kind: 'result', id: 'result', progress: 100 },

  // T26
  { kind: 'sales', id: 'sales', progress: 100 },
]

// ── Copy das telas especiais ────────────────────────────────────────

export const LAURA_PARAGRAFOS = [
  'Sou Laüra Rosa — educadora física e especialista em emagrecimento feminino.',
  'Mas o que me trouxe até aqui não foi só a formação. Com 23 anos eu descobri que tinha SOP (Síndrome dos Ovários Policísticos). Engordei 15 quilos em menos de um ano sem conseguir explicar por quê. Fazia academia todo dia, pesava cada grama de comida, cortava tudo que mandavam cortar.',
  'E quanto mais eu me esforçava, pior eu ficava.',
  'Foi quando eu descobri que o problema era a inflamação travando o meu metabolismo. Quando eu mudei o método, 8 quilos foram embora em 23 dias.',
  'Depois de validar comigo mesma e ajudar mais de 5.000 seguidoras, eu decidi ajudar mais mulheres a terem o mesmo resultado.',
  'Eu chamei isso de Efeito Lipo — quando o seu corpo para de reter e entra em estado de queima de dentro pra fora. E foi por isso que eu criei o protocolo que você está prestes a receber.',
]

export const PROVA_GRID: { img: ImgKey; alt: string }[] = [
  { img: 'camila', alt: 'Camila, 30 anos' },
  { img: 'suhene', alt: 'Suhene, 43 anos' },
  { img: 'gabriela34', alt: 'Gabriela, 34 anos' },
  { img: 'suelen', alt: 'Suelen, 35 anos' },
]

export const INSIGHT = {
  headline:
    'Você sabia que 90% das mulheres que não conseguem emagrecer têm o metabolismo travado pela inflamação — e não por falta de disciplina?',
  intro: 'A maioria das mulheres passa anos fazendo isso:',
  ruins: [
    'Cortando calorias — e o corpo entra em modo de sobrevivência e retém mais',
    'Treinando pesado — sem antes desligar o botão da inflamação',
    'Tomando suplemento — sem tratar a causa raiz',
    'Usando canetinha — perde peso, para de usar, volta tudo em 12 meses',
  ],
  bom: 'O Efeito Lipo funciona diferente: desinchar primeiro. Ativar o metabolismo depois. Queimar no piloto automático por último.',
  fecho: 'Essa ordem muda tudo.',
  options: [
    { id: 'faz-sentido', emoji: '✅', label: 'Faz sentido — nunca tinha pensado assim' },
    { id: 'novidade', emoji: '💡', label: 'É novidade pra mim — quero entender melhor' },
  ],
}

export const RESULT_MARCOS = [
  { dia: 'Dia 01', fase: 'Ponto de partida', txt: 'Corpo inflamado — antes da limpeza', y: 8 },
  { dia: 'Dia 03', fase: 'Primeiros sinais', txt: 'Desinflame iniciando — roupas começam a ficar largas', y: 26 },
  { dia: 'Dia 07', fase: 'Virada', txt: 'Limpeza completa — 2 a 4kg a menos', y: 48 },
  { dia: 'Dia 14', fase: 'Aceleração', txt: 'Ativação metabólica respondendo', y: 74 },
  { dia: 'Dia 21', fase: 'Transformação', txt: 'Queima Total — até 8kg e metabolismo no piloto automático', y: 98 },
]

export const SALES = {
  beforeAfter: [
    ['Barriga inchada que não sai de jeito nenhum', 'Barriga seca e desinchada'],
    ['Treina, se esforça — e a balança não move', 'O mesmo esforço começa a gerar resultado real'],
    ['Acorda cansada e retendo líquido', 'Corpo leve, roupas mais largas desde a 1ª semana'],
    ['Sente que o problema é falta de força de vontade', 'Entende que era a inflamação — e resolve a causa'],
  ],
  gallery: [
    { img: 'priscila', alt: 'Priscila — resultado em 7 dias', tag: '7 dias' },
    { img: 'gabriela34', alt: 'Gabriela, 34 anos' },
    { img: 'camila', alt: 'Camila, 30 anos' },
    { img: 'suhene', alt: 'Suhene, 43 anos' },
    { img: 'suelen', alt: 'Suelen, 35 anos' },
    { img: 'thais', alt: 'Thais, 34 anos' },
  ] as { img: ImgKey; alt: string; tag?: string }[],
  entregaveis: [
    ['Protocolo completo dos 21 dias', 'As três fases passo a passo: Limpeza, Ativação Metabólica e Queima Total'],
    ['Treinos específicos para barriga e braços', 'Feitos para a rotina real. 15 a 30 minutos, em casa, sem equipamento'],
    ['Guia de alimentação anti-inflamatória', 'O que comer, em quais horários e como potencializar cada fase. Sem passar fome, sem contar caloria'],
    ['Protocolo Desincha Express da 1ª semana', 'Para você começar a ver diferença logo nos primeiros dias'],
    ['Acesso ao aplicativo completo', 'Tudo organizado, do dia 1 ao dia 21'],
  ],
  bonus: [
    { nome: 'Bônus 1 — Queima Hormonal', de: 'R$ 197', desc: 'As quatro janelas hormonais do ciclo — como adaptar treino e alimentação a cada semana do mês para queimar gordura no ritmo certo' },
    { nome: 'Bônus 2 — Protocolo Anti-Pelanquinha', de: 'R$ 147', desc: 'Como estimular colágeno e elastina enquanto você perde gordura — para a pele acompanhar o resultado e ficar firme' },
  ],
  stack: [
    ['Protocolo Efeito Lipo 21', 'R$ 297'],
    ['Queima Hormonal', 'R$ 197'],
    ['Protocolo Anti-Pelanquinha', 'R$ 147'],
  ],
}
