-- ════════════════════════════════════════════════════════════════════
-- FIX — a aba Upsell (e o bloco de upsell da aba Funil) parou de puxar vendas.
--
-- Causa: a auditoria (auditoria-06-upsell.sql) recriou upsell_resumo trocando o
-- parâmetro `p_main_product` (product_id do principal) por `p_main_offer`
-- (offer_code, default null). O front nunca foi atualizado: continua chamando
-- com p_main_product. Como o PostgREST resolve a função pelo NOME dos argumentos,
-- a chamada caía em PGRST202 ("function not found") e a página, sem dado, exibia
-- tudo zerado — parecia "sem vendas" quando na verdade era a chamada quebrando.
--
-- Correção: volta a assinatura que o front usa (p_upsell_offer, p_main_product,
-- p_slug), MANTENDO todas as melhorias da auditoria:
--   • compras de teste (emails_teste) fora da conta;
--   • venda devolvida não conta como venda;
--   • reembolso ancorado na data da DEVOLUÇÃO;
--   • views_desde (a página de upsell só existe desde 08/07).
--
-- A base volta a ser por PRODUTO (Efeito Lipo 21D na Greenn = 181143), que é o
-- correto: quem cai na página do upsell é quem comprou o principal, em qualquer
-- oferta dele. Por offer_code a base quebraria a cada oferta nova do produto.
-- ════════════════════════════════════════════════════════════════════

drop function if exists public.upsell_resumo(timestamptz, timestamptz, text, text, text);

create or replace function public.upsell_resumo(
  p_since        timestamptz,
  p_until        timestamptz,
  p_upsell_offer text,                                -- offer_code do upsell (ex.: '8QUFs9')
  p_main_product text,                                -- product_id do principal Greenn (ex.: '181143')
  p_slug         text default 'acompanhamento-up'     -- upsell_views.slug
)
returns table (
  vendas bigint, receita numeric, liquido numeric,
  reembolsos bigint, reembolsos_valor numeric,
  base bigint, views bigint, views_desde timestamptz
)
language sql stable as $fn$
  with tx as (
    select
      transaction,
      max(case when offer_code = p_upsell_offer then 1 else 0 end)  as is_upsell,
      max(case when product_id = p_main_product then 1 else 0 end)  as is_main,
      (array_agg(event order by received_at desc))[1]               as last_event,
      min(received_at) filter (where event = 'PURCHASE_APPROVED')   as approved_at,
      max(received_at) filter (where event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')) as refunded_at,
      max(price)          filter (where offer_code = p_upsell_offer) as u_price,
      max(producer_value) filter (where offer_code = p_upsell_offer) as u_liquido,
      lower(trim(max(buyer_email)))                                 as email
    from public.vendas
    where transaction is not null
    group by transaction
  ),
  txr as (   -- fora as compras de teste
    select t.* from tx t
    left join public.emails_teste e on e.email = t.email
    where e.email is null
  ),
  viva as (  -- fora as devolvidas: uma venda reembolsada não é venda
    select * from txr
    where last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK','PURCHASE_PROTEST')
  )
  select
    (select count(*) from viva
      where is_upsell = 1 and approved_at between p_since and p_until)              as vendas,
    (select coalesce(sum(u_price),0) from viva
      where is_upsell = 1 and approved_at between p_since and p_until)              as receita,
    (select coalesce(sum(u_liquido),0) from viva
      where is_upsell = 1 and approved_at between p_since and p_until)              as liquido,
    (select count(*) from txr
      where is_upsell = 1 and refunded_at between p_since and p_until)              as reembolsos,
    (select coalesce(sum(u_price),0) from txr
      where is_upsell = 1 and refunded_at between p_since and p_until)              as reembolsos_valor,
    (select count(*) from viva
      where is_main = 1 and approved_at between p_since and p_until)                as base,
    (select count(*) from public.upsell_views uv
      where uv.slug = p_slug and uv.viewed_at between p_since and p_until)          as views,
    (select min(viewed_at) from public.upsell_views uv where uv.slug = p_slug)      as views_desde
$fn$;
