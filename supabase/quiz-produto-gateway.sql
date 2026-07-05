-- Comparacao por gateway e por produto - SO do funil do quiz
-- Operacao Corpo Feliz - Efeito Lipo
--
-- Alimenta a aba "Gateways" do dashboard do quiz: para cada gateway
-- (Hotmart x Greenn) e cada produto/order bump, quantas vendas, receita e
-- liquido, isolando o funil do quiz pelo marcador tracking_sck.
--
-- Rodar UMA vez no SQL Editor do Supabase (precisa do token sbp_ /
-- service_role nao aplica DDL). Complementar a quiz_checkout_ab: aquela da a
-- conversao geral do checkout; esta abre por produto.

drop function if exists public.quiz_produto_gateway(timestamptz, timestamptz);

create or replace function public.quiz_produto_gateway(
  p_since timestamptz, p_until timestamptz
)
returns table (
  gateway text,
  product_name text,
  vendas bigint,
  receita numeric,
  liquido numeric,
  reembolsos bigint,
  reembolsos_valor numeric
)
language sql
stable
as $$
  with tx as (
    select
      gateway,
      transaction,
      max(product_name)                                           as product_name,
      (array_agg(event order by received_at desc))[1]             as last_event,
      min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
      min(received_at)                                            as entry_anchor,
      max(price)                                                  as price,
      max(producer_value)                                         as producer_value
    from public.vendas
    where transaction is not null
      and coalesce(tracking_sck, '') = 'efeito-lipo-quiz'
    group by gateway, transaction
  )
  select
    gateway,
    coalesce(product_name, 'sem-nome') as product_name,
    count(*) filter (
      where approved_at is not null and approved_at >= p_since and approved_at <= p_until
    ) as vendas,
    coalesce(sum(price) filter (
      where approved_at is not null and approved_at >= p_since and approved_at <= p_until
    ), 0) as receita,
    coalesce(sum(producer_value) filter (
      where approved_at is not null and approved_at >= p_since and approved_at <= p_until
    ), 0) as liquido,
    count(*) filter (
      where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until
    ) as reembolsos,
    coalesce(sum(price) filter (
      where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until
    ), 0) as reembolsos_valor
  from tx
  group by gateway, coalesce(product_name, 'sem-nome');
$$;
