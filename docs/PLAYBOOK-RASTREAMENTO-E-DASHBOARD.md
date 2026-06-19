# Playbook — Rastreamento de Vendas + Dashboard de Operação

> Documentação completa e reutilizável de como montamos o rastreamento ponta a
> ponta (anúncio → venda) e o dashboard de operação. Serve de receita pra
> replicar em **qualquer projeto**. Construído na operação Laüra Rosa / Corpo
> Feliz (funil Efeito Lipo), jun/2026.

---

## Índice

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Conceitos-chave (leia primeiro)](#2-conceitos-chave-leia-primeiro)
3. [Parte 1 — Coletar vendas (Hotmart → Supabase)](#parte-1--coletar-vendas-hotmart--supabase)
4. [Parte 2 — Atribuição (ligar a venda ao anúncio)](#parte-2--atribuição-ligar-a-venda-ao-anúncio)
5. [Parte 3 — Dados do Meta (o robô)](#parte-3--dados-do-meta-o-robô)
6. [Parte 4 — Banco de dados (tabelas e funções)](#parte-4--banco-de-dados-tabelas-e-funções)
7. [Parte 5 — Dashboard (Next.js)](#parte-5--dashboard-nextjs)
8. [Parte 6 — Passo a passo para replicar](#parte-6--passo-a-passo-para-replicar-num-projeto-novo)
9. [Parte 7 — Credenciais e segredos](#parte-7--credenciais-e-segredos)
10. [Aprendizados e armadilhas (importante)](#parte-8--aprendizados-e-armadilhas)

---

## 1. Visão geral da arquitetura

O objetivo: saber **quanto cada anúncio gastou** e **quanto cada anúncio vendeu**,
cruzando os dois para calcular ROI/CAC/lucro — tudo atualizado sozinho.

```
┌─────────────┐   anúncio c/ UTMs    ┌──────────────────┐
│  Meta Ads   │ ───────────────────► │  Site / Funil    │
└──────┬──────┘                      │  (Next.js)       │
       │ API (gasto, funil)          └────────┬─────────┘
       │                                      │ checkout c/ sck+src+xcod
       ▼                                      ▼
┌─────────────────────┐              ┌──────────────────┐
│ Edge Function       │              │     Hotmart      │
│ meta-insights       │              │   (gateway)      │
│ (de hora em hora)   │              └────────┬─────────┘
└──────┬──────────────┘                       │ webhook
       │                                       ▼
       │                            ┌──────────────────┐
       │  grava                     │ Edge Function    │
       └──────────────────────────► │ hotmart-webhook  │
                                    └────────┬─────────┘
                                             │ grava
                                             ▼
                            ┌─────────────────────────────┐
                            │   SUPABASE (Postgres)        │
                            │  tabelas + funções SQL       │
                            └────────────┬────────────────┘
                                         │ lê (service_role)
                                         ▼
                            ┌─────────────────────────────┐
                            │  DASHBOARD (Next.js)         │
                            │  Funil · Quiz · Anúncios ·   │
                            │  Origem (UTM) · Produtos     │
                            └─────────────────────────────┘
```

**Stack:**
- **Supabase** — banco Postgres + Edge Functions (Deno) + agendamento (pg_cron).
- **Next.js** (App Router) — o site/funil **e** o dashboard (mesma app).
- **Meta Marketing API** (Graph API) — dados de anúncio.
- **Hotmart** — gateway; manda webhook a cada venda.
- **GTM** (web + server/Stape) — rastreio do cliente (já existia).

**Por que Edge Functions do Supabase (e não rotas do site):** o link do webhook e
o robô ficam **independentes do deploy do site**. Se a produção do site depende de
um processo manual (ex: sync de fork), o rastreio não pode depender disso.

---

## 2. Conceitos-chave (leia primeiro)

Esses 4 pontos foram as descobertas que destravaram tudo. Entender isso evita
semanas de cabeça quente.

### 2.1. Os 3 campos de rastreio da Hotmart: `sck`, `src`, `xcod`
A Hotmart aceita 3 parâmetros no link de checkout e os devolve no webhook, dentro
de **`purchase.origin`** (⚠️ NÃO em `purchase.tracking`, como a documentação antiga
sugere):
- **`sck`** — usamos pra identificar o **FUNIL** (ex: `efeito-lipo-quiz`). Valor fixo no link.
- **`src`** — usamos pra identificar o **ANÚNCIO** (o `ad_id`/`adset_id` do Meta). Dinâmico.
- **`xcod`** — id de **deduplicação** (o mesmo `event_id` mandado ao Meta via CAPI). Liga a venda à sessão/usuário.

### 2.2. `utm_term` = ID do CONJUNTO (adset), não do anúncio
Na convenção de UTM usada (configurável no Meta), os parâmetros eram:
| UTM | Conteúdo |
|---|---|
| `utm_source` | placement (Instagram_Feed, Instagram_Stories) |
| `utm_campaign` | **nome** da campanha |
| `utm_medium` | **nome** do conjunto (ex: "ABERTO") |
| `utm_term` | **ID do conjunto** (adset.id — número de 18 dígitos) |
| `utm_content` | **nome** do anúncio (ex: "AD2") |

➡️ Como o `utm_term` é o **adset.id**, o cruzamento numérico venda↔Meta é no nível
de **conjunto**, não de anúncio individual. (O nome do anúncio existe em
`utm_content`, mas sem id numérico próprio — então o join confiável é por conjunto.)

### 2.3. A "pegadinha" do relatório agregado do Meta
`act_<conta>/insights?level=ad` **NÃO retorna** de forma confiável todos os anúncios
(omite vários, mesmo ativos e gastando). **Solução:** consultar o `/insights` de
**cada id rastreado** (1 chamada por conjunto), e para os anúncios usar
`/{adset_id}/insights?level=ad`. Nunca confie no relatório agregado da conta.

### 2.4. Atribuição é só até onde o link passa
O `src`/`xcod` só entra na venda se o link de checkout **passou pelo navegador**
(onde o GTM/JS roda). Vendas fechadas no WhatsApp ou com link fixo enviado fora do
site **não carregam** atribuição. No quiz (SPA), o botão de compra nasce tarde, então
o GTM (que roda 1x no carregamento) não o alcança — por isso o **próprio app** injeta
sck+src+xcod no link (ver Parte 2).

---

## Parte 1 — Coletar vendas (Hotmart → Supabase)

### 1.1. Tabela `vendas`
Log de eventos: **uma linha por aviso** do webhook (uma compra gera vários ao longo
do tempo: aprovada → reembolso, etc.). O status "atual" de cada compra é o evento
mais recente daquela `transaction`.

```sql
create table public.vendas (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  hotmart_event_id text unique,   -- id único do aviso (evita duplicar reenvios)
  event text,                      -- PURCHASE_APPROVED | PURCHASE_REFUNDED | ...
  status text, transaction text,   -- transaction = igual entre eventos da mesma compra
  product_id text, product_name text, offer_code text,
  buyer_email text, buyer_name text, buyer_phone text, buyer_doc text,
  price numeric, full_price numeric, producer_value numeric, currency text,
  payment_method text, installments int,
  tracking_src text, tracking_sck text, tracking_xcod text,  -- a ponte com o Meta
  subscription_status text, plan_name text, subscriber_code text,
  order_date timestamptz, approved_date timestamptz,
  raw jsonb not null default '{}'::jsonb  -- payload bruto COMPLETO (nunca perde nada)
);
alter table public.vendas enable row level security;  -- sem policy pública: só service_role lê/grava
```
**Princípio:** sempre guarde o `raw` (payload inteiro). Quando um campo vier num lugar
inesperado, ele está no `raw` e dá pra reprocessar sem perder dados.

### 1.2. Edge Function `hotmart-webhook`
Recebe o POST da Hotmart, valida o token e grava. Pontos críticos:
- **Lê o rastreio em `purchase.origin`** (sck/src/xcod), com fallback p/ `purchase.tracking`.
- **Idempotência:** upsert com `on_conflict=hotmart_event_id, resolution=ignore-duplicates` (reenvio não duplica).
- **Segurança (hottok):** compara o header `X-HOTMART-HOTTOK` (ou `body.hottok`) com o segredo `HOTMART_HOTTOK`. Sem token → 401.
- **Sempre responde 200** em erro de gravação (a Hotmart desativa o webhook se levar muitos erros; o log fica pra investigar).
- Deploy com `--no-verify-jwt` (a Hotmart não manda JWT).

Esqueleto (Deno):
```ts
Deno.serve(async (req) => {
  const body = await req.json()
  const sent = (req.headers.get('x-hotmart-hottok') ?? body?.hottok ?? '').trim()
  if (sent !== Deno.env.get('HOTMART_HOTTOK')) return new Response('Unauthorized', { status: 401 })
  const p = body?.data?.purchase ?? {}
  const origin = p?.origin ?? {}, tracking = p?.tracking ?? {}
  const row = {
    hotmart_event_id: body?.id, event: body?.event, status: p?.status, transaction: p?.transaction,
    product_name: body?.data?.product?.name, price: Number(p?.price?.value) || null,
    tracking_sck: origin?.sck ?? tracking?.source_sck, tracking_src: origin?.src ?? tracking?.source,
    tracking_xcod: origin?.xcod, raw: body, /* ...demais campos... */
  }
  await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/vendas?on_conflict=hotmart_event_id`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json',
               Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify(row),
  })
  return new Response('ok', { status: 200 })
})
```

### 1.3. Configurar o webhook na Hotmart
1. Hotmart → **Ferramentas → Webhook** → criar.
2. URL = `https://<projeto>.supabase.co/functions/v1/hotmart-webhook`.
3. Marcar **todos os eventos** (compra aprovada/completa/reembolso/chargeback/cancelamento/assinatura...).
4. Salvar → a Hotmart gera o **hottok**. Configurar como segredo:
   `supabase secrets set HOTMART_HOTTOK=<valor> --project-ref <ref>`.
5. Disparar o teste pela Hotmart e conferir as linhas chegando em `vendas`.

---

## Parte 2 — Atribuição (ligar a venda ao anúncio)

A meta: cada venda chega com `src` (id do conjunto) e `xcod` (id de dedup).

### 2.1. Parâmetros de URL no Meta
Nos anúncios, campo **Rastreamento → Parâmetros de URL** (dá pra setar no nível da
conta como template):
```
utm_source=fb&utm_campaign={{campaign.name}}&utm_medium={{adset.name}}&utm_term={{adset.id}}&utm_content={{ad.name}}
```
Os `{{...}}` o Meta preenche por clique. O importante é o **`utm_term={{adset.id}}`** —
é a chave numérica de cruzamento. (Se um dia quiser nível de anúncio, use `{{ad.id}}`.)

### 2.2. A tag XCOD do GTM (provavelmente já existe)
Tag de "HTML personalizado" no contêiner **web**, que dispara no **DOM Ready**. Ela:
- gera/lê um `user_id_purchase` (= event_id do CAPI) e guarda em cookie/localStorage;
- injeta nos links de checkout: `xcod` (o user_id), `sck` e `src` (montados dos UTMs).
- **Limitação:** roda 1x no carregamento; não alcança botões criados depois (SPA).

### 2.3. Injeção no próprio funil (para SPAs / botões tardios)
No código do funil, montar o link de checkout lendo os parâmetros no navegador:
```ts
// utm_term (id do conjunto) → src ; xcod do GTM (user_id_purchase) → xcod
export function checkoutHref(adId?, xcod?) {
  const extra = []
  if (adId) extra.push(`src=${encodeURIComponent(adId)}`)
  if (xcod) extra.push(`xcod=${encodeURIComponent(xcod)}`)
  return extra.length ? `${BASE_CHECKOUT}&${extra.join('&')}` : BASE_CHECKOUT
}
export function readXcod() {            // o GTM injeta o xcod na URL e no storage
  const u = new URLSearchParams(location.search).get('xcod')
  return u || localStorage.getItem('user_id_purchase') ||
         (document.cookie.match(/(?:^|;\s*)user_id_purchase=([^;]+)/)?.[1] ?? null)
}
// No componente: useEffect lê utm_term + xcod e monta o href (evita mismatch de hidratação).
```
**Cuidado (regressão clássica):** se o React reescreve o href DEPOIS do GTM, ele apaga
o que o GTM colocou. Solução: o React recolocar sck+src+xcod ao montar o link.

### 2.4. Resultado
A Hotmart devolve em `purchase.origin`: `sck` (funil), `src` (adset.id), `xcod` (dedup).
O webhook grava em `vendas.tracking_sck/src/xcod`. ✅

---

## Parte 3 — Dados do Meta (o robô)

### 3.1. Tabelas
- **`meta_insights`** — PK `(ad_id, date)`, onde `ad_id` = **adset.id** (= utm_term). Funil por conjunto/dia.
- **`meta_ads`** — PK `(ad_id, date)`, nível **anúncio**. Métricas do Meta por anúncio/dia.
- **`meta_status`** — PK `id`. Status atual (ACTIVE/PAUSED/DISAPPROVED...) de conjuntos e anúncios.
- **`tracked_ad_ids`** (view) — lista distinta dos `utm_term` que apareceram nas sessões/vendas.

Colunas de métrica (ambas as tabelas): `spend, impressions, clicks, link_clicks, lp_views,
ic, purchases, purchase_value, reach, ctr, cpc, cpm` + nomes de campanha/conjunto/anúncio.

### 3.2. Edge Function `meta-insights` (de hora em hora)
Para cada id da view `tracked_ad_ids`, faz **3 chamadas**:
1. `GET /{adset_id}/insights?time_increment=1&fields=...` → nível conjunto → `meta_insights`.
2. `GET /{adset_id}/insights?level=ad&...` → nível anúncio → `meta_ads`.
3. `GET /{adset_id}?fields=effective_status,ads{id,effective_status}` → status → `meta_status`.

Detalhes:
- Funil vem do array **`actions`** do insights: `landing_page_view`, `initiate_checkout`,
  `purchase` (+ `inline_link_clicks` p/ cliques no link, `action_values` p/ valor das compras).
- Janela: re-busca os últimos `?days=N` dias (padrão 4) porque o Meta **ajusta números
  retroativamente**. Backfill inicial com `?days=60`.
- Datas no fuso da conta (ex: `America/Sao_Paulo`).
- API version usada: **v25.0** (`https://graph.facebook.com/v25.0`).

### 3.3. Agendamento (pg_cron)
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('meta-insights-hourly', '17 * * * *', $$
  select net.http_post(
    url := 'https://<projeto>.supabase.co/functions/v1/meta-insights?days=4',
    headers := jsonb_build_object('Authorization','Bearer <ANON_KEY>','Content-Type','application/json')
  ) $$);
```
(Use a anon key no header — a função usa o service_role internamente; mantenha
`verify_jwt` ligado na função para não deixá-la pública.)

### 3.4. Token do Meta (permanente)
Use um **System User** do Business Manager (token **não expira**):
1. business.facebook.com → Configurações do negócio → **Usuários → Usuários do sistema**.
2. Criar/usar um system user → **Atribuir ativos** → a conta de anúncios certa → "Ver desempenho".
3. **Gerar token** → escolher um app onde o system user tem papel → permissão **`ads_read`**.
4. `supabase secrets set META_ACCESS_TOKEN=<EAA...> META_AD_ACCOUNT_ID=act_<id> --project-ref <ref>`.

---

## Parte 4 — Banco de dados (tabelas e funções)

Todo o SQL está versionado no repo, em `supabase/`:
| Arquivo | Conteúdo |
|---|---|
| `vendas-schema.sql` | tabela `vendas` |
| `meta` (criada via API) | `meta_insights`, view `tracked_ad_ids` |
| `funil-functions.sql` | colunas de funil em `meta_insights` + `funil_resumo()` |
| `anuncios-functions.sql` | `meta_ads`, `meta_status`, `ranking_conjuntos()`, `ranking_anuncios()` |
| `roi-function.sql` | `roi_conjuntos()` |
| `utm-functions.sql` | `vendas_utm()` |
| `produtos-functions.sql` | `vendas_por_produto()` |

**Funções SQL (todas recebem `p_since, p_until timestamptz` e cruzam as tabelas):**
- `funil_resumo()` → 1 linha: soma do funil do Meta + vendas reais (aba Funil).
- `roi_conjuntos()` → por conjunto: gasto + sessões/checkouts (quiz) + vendas/receita (Hotmart).
- `ranking_conjuntos()` → funil completo do Meta por conjunto (aba Anúncios).
- `ranking_anuncios()` → funil completo do Meta por anúncio.
- `vendas_utm()` → cada venda real cruzada com os UTMs (pelo `tracking_src = utm_term`), via `mode()`.
- `vendas_por_produto()` → vendas reais agrupadas por produto.

**Padrão das funções:** deduplicar vendas por `transaction` (`distinct on (transaction) ... order by received_at desc`), filtrar `event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')`, converter datas com `(p_since at time zone 'America/Sao_Paulo')::date` para casar com `meta_insights.date`.

**Acesso:** o dashboard chama as funções via PostgREST RPC com a **service_role key** (helper `sbRpc`). RLS ligado em todas as tabelas, sem policy pública → só o servidor lê.

---

## Parte 5 — Dashboard (Next.js)

### 5.1. Estrutura
Tudo em `app/efeito-lipo-quiz/dashboard/`:
```
dashboard/
  _login.tsx     → tela de senha (cookie qd_auth == QUIZ_DASHBOARD_PASSWORD)
  _shell.tsx     → menu lateral (grupos + abas). Cresce: é só add no array GROUPS.
  _period.tsx    → filtro de período compartilhado (Hoje/7d/30d/Mês atual/custom)
  _sortable.tsx  → tabela com ordenação por clique (client component)
  page.tsx       → redireciona p/ /funil
  funil/page.tsx     → macro (ROAS/CAC/lucro) + funil clique→compra com taxas
  quiz/page.tsx      → rastreio tela-a-tela + números reais do Meta
  anuncios/page.tsx  → ranking campanha/conjunto/anúncio + status + ordenação
  utm/page.tsx       → origem das vendas por UTM
  produtos/page.tsx  → vendas por produto + taxa dos order bumps
```

### 5.2. Padrões usados
- **Server Components** que buscam via `sbRpc`/`sbSelect` (service_role, lib `lib/supabase.ts`).
- **Auth por cookie** em cada página: `if (!authed) return <Login/>`.
- **Período no fuso -03:00**; default "mês atual".
- **Interatividade** (ordenação) num único client component genérico (`_sortable.tsx`).
- **Métricas derivadas** (CPM, CTR, CPC, CPA, ROAS) calculadas na hora a partir dos números crus.

### 5.3. As 5 abas
| Aba | Mostra | Fonte da conversão |
|---|---|---|
| **Funil** | Investido, faturamento, lucro, ROAS, CAC + funil com taxas | Meta (funil) + Hotmart (dinheiro) |
| **Quiz** | Visualização real (Meta) + funil tela-a-tela + A/B | Meta + rastreio do quiz |
| **Anúncios** | Ranking campanha→conjunto→anúncio, status, ordenável | Pixel do Meta (compras) |
| **Origem (UTM)** | Vendas reais por source/campaign/medium + detalhe | Hotmart × UTMs |
| **Produtos** | Vendas por produto + taxa dos order bumps | Hotmart |

### 5.4. Regra de ouro das fontes (evita confusão)
- **Decidir/otimizar anúncio** → use o **pixel do Meta** (completo e consistente em todos os níveis: campanha/conjunto/anúncio).
- **Dinheiro real (faturamento/ROAS/lucro)** → use a **venda da Hotmart** (verdade, mas só completa a partir de quando o webhook entrou no ar).
- No teste A/B, o page view real do Meta não é segmentável por variante (a divisão é client-side); estimamos por **rateio proporcional** 50/50.

---

## Parte 6 — Passo a passo para replicar num projeto novo

1. **Supabase:** criar projeto. Guardar `SUPABASE_URL`, `service_role key`, `anon key`.
2. **Tabela `vendas`** + RLS (Parte 1.1). Rodar o SQL.
3. **Edge Function `hotmart-webhook`** → deploy `--no-verify-jwt`. Pegar a URL.
4. **Hotmart:** criar webhook com a URL, todos os eventos → pegar o **hottok** → `secrets set HOTMART_HOTTOK`.
5. **Testar** a venda (disparo da Hotmart) caindo em `vendas`.
6. **UTMs no Meta:** configurar os parâmetros de URL (com `utm_term={{adset.id}}`).
7. **Atribuição:** garantir que o checkout carrega sck+src+xcod (tag XCOD do GTM e/ou injeção no funil — Parte 2).
8. **Tabelas do Meta** (`meta_insights`, `meta_ads`, `meta_status`, view `tracked_ad_ids`).
9. **Token Meta (System User)** com `ads_read` → `secrets set META_ACCESS_TOKEN / META_AD_ACCOUNT_ID`.
10. **Edge Function `meta-insights`** → deploy → rodar backfill (`?days=60`) → agendar pg_cron (Parte 3.3).
11. **Funções SQL** (Parte 4) → rodar todos os `.sql`.
12. **Dashboard:** copiar a pasta `dashboard/` e o `lib/supabase.ts`; setar `QUIZ_DASHBOARD_PASSWORD`.
13. **Ajustar** nomes de produto (aba Produtos) e o link de checkout base por projeto.

---

## Parte 7 — Credenciais e segredos

| Segredo | Onde fica | Para quê |
|---|---|---|
| `SUPABASE_URL` | env do site + das funções | base do banco |
| `SUPABASE_SERVICE_ROLE_KEY` | env do site (NUNCA no cliente) | ler/gravar ignorando RLS |
| `SUPABASE_ANON_KEY` | header do cron | chamar a função agendada |
| `HOTMART_HOTTOK` | secret da função | validar o webhook |
| `META_ACCESS_TOKEN` | secret da função | API do Meta (System User, ads_read, não expira) |
| `META_AD_ACCOUNT_ID` | secret da função | `act_<id>` da conta |
| `QUIZ_DASHBOARD_PASSWORD` | env do site | senha do dashboard |

**Regras:** `.env*` no `.gitignore`; chave service_role só no servidor; deploy de funções
e SQL via CLI/Management API com um **Personal Access Token** do Supabase (revogar após uso).

---

## Parte 8 — Aprendizados e armadilhas

1. **Hotmart manda o rastreio em `purchase.origin`** (sck/src/xcod), não em `purchase.tracking`. Conferir sempre o `raw` de uma venda real antes de mapear.
2. **`utm_term` pode ser o adset.id, não o ad.id.** Verificar consultando o id na Graph API (`/{id}?fields=name,adset_name`) — descobre se é anúncio ou conjunto. Define a granularidade do join.
3. **`act_<conta>/insights?level=ad` é incompleto.** Puxar por id rastreado (1 chamada por conjunto), nunca confiar no agregado da conta.
4. **Meta ajusta números retroativamente** → re-buscar uma janela (últimos dias) a cada run.
5. **Vendas só são atribuíveis se o link passou pelo navegador.** WhatsApp/links fixos não carregam atribuição.
6. **SPA quebra o GTM:** botão criado tarde não é alcançado pela tag (que roda 1x). O app precisa injetar sck/src/xcod.
7. **React vs GTM brigam pelo href:** se o React remonta o link, recoloque tudo (sck+src+xcod).
8. **Pixel ≠ venda real.** Pixel é completo/consistente (bom pra otimizar); Hotmart é a verdade do dinheiro (mas só a partir de quando o webhook entrou). Mostrar os dois lado a lado.
9. **Token temporário (Graph Explorer) expira em ~1h** — só pra teste. Produção exige System User.
10. **Idempotência sempre:** webhooks reenviam; use `on_conflict` + id único do evento.
11. **Guarde o `raw`:** quando um dado vier "errado", ele está lá pra reprocessar (foi assim que corrigimos o sck/src/xcod sem perder vendas).
12. **Múltiplas contas de anúncio:** o Business Manager pode ter dezenas; confirme `account_id` do anúncio (`/{id}?fields=account_id`) antes de assumir a conta.

---

*Construído por Vinicius + Claude (jun/2026). Funil Efeito Lipo · projeto `efeito-lipo-21` · Supabase `fjlbvoephhextnxemygf`.*
