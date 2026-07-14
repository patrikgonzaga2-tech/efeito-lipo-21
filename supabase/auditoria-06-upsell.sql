-- ════════════════════════════════════════════════════════════════════
-- AUDITORIA — Fase 6: UPSELL (/acompanhamento-up)
--
-- A tela mostrava "3 vendas · R$ 441". Auditado transação a transação:
--   • vinibenavides@gmail.com — COMPRA DE TESTE do próprio dev, reembolsada
--   • patidealmeida@…         — reembolsada 8 horas depois
--   • afreire2@…              — a única venda de verdade (R$ 147)
-- Ou seja: 1 venda real, R$ 147. A conversão exibida (0,4%) é 0,1%.
-- É uma decisão de produto apoiada numa venda — e o painel escondia isso.
--
-- Correções:
--   1) vendas/receita/líquido não contam mais compra devolvida;
--   2) compras de teste saem da conta (tabela emails_teste, reutilizável);
--   3) a RPC devolve `views_desde` — a página de upsell só existe desde 08/07 e
--      a tela dividia as visualizações pela base do MÊS INTEIRO, fazendo parecer
--      que 26% dos compradores nunca chegaram lá. Com o piso de data, a taxa
--      real é ~92%, não 73,6%.
-- ════════════════════════════════════════════════════════════════════

-- E-mails internos: compras de teste não são venda. Vale para qualquer função
-- que queira excluí-las (hoje: o upsell, onde 1 teste em 3 vendas distorcia 33%).
create table if not exists public.emails_teste (
  email text primary key,
  nota  text
);
insert into public.emails_teste (email, nota) values
  ('vinibenavides@gmail.com', 'dev — compras de teste')
on conflict (email) do nothing;

drop function if exists public.upsell_resumo(timestamptz, timestamptz, text, text, text);
create or replace function public.upsell_resumo(
  p_since timestamptz, p_until timestamptz,
  p_slug text default 'acompanhamento-up',
  p_upsell_offer text default '8QUFs9',
  p_main_offer text default null
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
      max(case when p_main_offer is null or offer_code = p_main_offer then 1 else 0 end) as is_main,
      (array_agg(event order by received_at desc))[1]               as last_event,
      min(received_at)                                              as entry_anchor,
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
      where is_upsell = 1 and approved_at is not null
        and approved_at >= p_since and approved_at <= p_until)                     as vendas,
    (select coalesce(sum(u_price),0) from viva
      where is_upsell = 1 and approved_at is not null
        and approved_at >= p_since and approved_at <= p_until)                     as receita,
    (select coalesce(sum(u_liquido),0) from viva
      where is_upsell = 1 and approved_at is not null
        and approved_at >= p_since and approved_at <= p_until)                     as liquido,
    -- reembolso ancorado na DATA DA DEVOLUÇÃO (antes: na entrada da compra)
    (select count(*) from txr
      where is_upsell = 1 and refunded_at is not null
        and refunded_at >= p_since and refunded_at <= p_until)                     as reembolsos,
    (select coalesce(sum(u_price),0) from txr
      where is_upsell = 1 and refunded_at is not null
        and refunded_at >= p_since and refunded_at <= p_until)                     as reembolsos_valor,
    (select count(*) from viva
      where is_main = 1 and approved_at is not null
        and approved_at >= p_since and approved_at <= p_until)                     as base,
    (select count(*) from public.upsell_views uv
      where uv.slug = p_slug and uv.viewed_at >= p_since and uv.viewed_at <= p_until) as views,
    -- desde quando a página existe: sem isto, a tela divide as visualizações
    -- pela base do mês inteiro e a etapa parece muito pior do que é
    (select min(viewed_at) from public.upsell_views uv where uv.slug = p_slug)     as views_desde
$fn$;
