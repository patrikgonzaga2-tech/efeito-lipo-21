-- ════════════════════════════════════════════════════════════════════
-- MARCA · Fase 2 — Cross-sell + LTV (por cliente, via e-mail normalizado)
-- Cole no Supabase → SQL Editor → Run. Seguro rodar de novo.
--
-- Pergunta central: de quem comprou Efeito Lipo, quantos também entraram na
-- Comunidade? E quanto vale um cliente ao longo do tempo (LTV)?
--
-- COORTE POR 1ª COMPRA: o período (p_since/p_until) filtra os clientes pela DATA
-- DA PRIMEIRA COMPRA deles. O "também comprou" é checado em TODO o histórico —
-- porque cross-sell é um conceito de vida do cliente, não de um mês isolado.
-- Para a foto completa, use o período "Tudo".
--
-- Refunds: transações atualmente reembolsadas/chargeback saem do LTV e da contagem.
-- ════════════════════════════════════════════════════════════════════

-- Base: 1 linha por COMPRA APROVADA (transação), com cliente/família/valor/data.
-- Reduz o log de eventos a uma compra por transação (estado atual).
create or replace view public.compras_aprovadas as
select
  transaction,
  max(email_norm)                                      as email_norm,
  max(buyer_name)                                      as buyer_name,
  (array_agg(gateway  order by received_at desc))[1]   as gateway,
  (array_agg(familia  order by received_at desc))[1]   as familia,
  (array_agg(produto  order by received_at desc))[1]   as produto,
  (array_agg(tipo     order by received_at desc))[1]   as tipo,
  (array_agg(event    order by received_at desc))[1]   as last_event,
  min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
  max(price)                                           as price,
  max(producer_value)                                  as liquido
from public.vendas_norm
where transaction is not null
group by transaction;

-- ─────────────────────────────────────────────────────────────────────
-- 1) cross_sell_resumo — números de manchete da coorte.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.cross_sell_resumo(timestamptz, timestamptz);
create or replace function public.cross_sell_resumo(p_since timestamptz, p_until timestamptz)
returns table (
  clientes bigint, multi_familia bigint,
  clientes_el bigint, clientes_com bigint, el_e_com bigint,
  ltv_medio numeric, receita_total numeric,
  dias_el_para_com numeric
)
language sql stable as $fn$
  with cli as (
    select email_norm,
           min(approved_at)                                     as primeira,
           array_agg(distinct familia)                          as familias,
           sum(price)                                           as receita,
           min(approved_at) filter (where familia = 'Efeito Lipo') as primeira_el,
           min(approved_at) filter (where familia = 'Comunidade')  as primeira_com
    from public.compras_aprovadas
    where approved_at is not null
      and email_norm is not null
      and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')
    group by email_norm
  ),
  coorte as (
    select * from cli where primeira >= p_since and primeira <= p_until
  )
  select
    count(*)                                                                          as clientes,
    count(*) filter (where cardinality(familias) > 1)                                 as multi_familia,
    count(*) filter (where 'Efeito Lipo' = any(familias))                             as clientes_el,
    count(*) filter (where 'Comunidade'  = any(familias))                             as clientes_com,
    count(*) filter (where 'Efeito Lipo' = any(familias) and 'Comunidade' = any(familias)) as el_e_com,
    coalesce(round(avg(receita), 2), 0)                                               as ltv_medio,
    coalesce(sum(receita), 0)                                                         as receita_total,
    coalesce(round(avg(extract(epoch from (primeira_com - primeira_el)) / 86400)
             filter (where primeira_el is not null and primeira_com is not null and primeira_com >= primeira_el), 1), null) as dias_el_para_com
  from coorte
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 2) cross_sell_matriz — matriz família A (comprou) × família B (também comprou).
--    clientes_a = quantos compraram A; clientes_ambos = compraram A e B.
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.cross_sell_matriz(timestamptz, timestamptz);
create or replace function public.cross_sell_matriz(p_since timestamptz, p_until timestamptz)
returns table (familia_a text, familia_b text, clientes_a bigint, clientes_ambos bigint)
language sql stable as $fn$
  with cli as (
    select email_norm,
           min(approved_at)            as primeira,
           array_agg(distinct familia) as familias
    from public.compras_aprovadas
    where approved_at is not null and email_norm is not null
      and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')
    group by email_norm
  ),
  coorte as (select * from cli where primeira >= p_since and primeira <= p_until),
  fams as (select distinct unnest(familias) as familia from coorte)
  select fa.familia, fb.familia,
         count(*) filter (where fa.familia = any(c.familias))                                as clientes_a,
         count(*) filter (where fa.familia = any(c.familias) and fb.familia = any(c.familias)) as clientes_ambos
  from fams fa cross join fams fb cross join coorte c
  group by fa.familia, fb.familia
$fn$;

-- ─────────────────────────────────────────────────────────────────────
-- 3) clientes_top — ranking de clientes por LTV (valor total gasto na marca).
-- ─────────────────────────────────────────────────────────────────────
drop function if exists public.clientes_top(timestamptz, timestamptz, int);
create or replace function public.clientes_top(p_since timestamptz, p_until timestamptz, p_limit int default 50)
returns table (
  nome text, email text, n_familias int, familias text,
  pedidos bigint, ltv numeric, liquido numeric,
  primeira timestamptz, ultima timestamptz
)
language sql stable as $fn$
  with cli as (
    select email_norm,
           max(buyer_name)                                as nome,
           min(approved_at)                               as primeira,
           max(approved_at)                               as ultima,
           count(distinct transaction)                    as pedidos,
           array_agg(distinct familia)                    as familias_arr,
           sum(price)                                     as ltv,
           sum(liquido)                                   as liquido
    from public.compras_aprovadas
    where approved_at is not null and email_norm is not null
      and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')
    group by email_norm
  )
  select nome, email_norm,
         cardinality(familias_arr), array_to_string(familias_arr, ', '),
         pedidos, ltv, liquido, primeira, ultima
  from cli
  where primeira >= p_since and primeira <= p_until
  order by ltv desc nulls last
  limit p_limit
$fn$;
