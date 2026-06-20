-- ════════════════════════════════════════════════════════════════════
-- Função vendas_por_produto: vendas LÍQUIDAS (estado atual de cada compra)
-- agrupadas por produto, + reembolsos por produto. Usada pela aba "Produtos"
-- (principal + order bumps + taxa de reembolso por produto).
--
-- Mesma lógica do funil_resumo: cada transação vira UMA linha reduzida ao seu
-- evento mais recente. Conta como venda quem está APPROVED/COMPLETE agora;
-- reembolso = REFUNDED/CHARGEBACK. Período ancorado no 1º aviso da compra.
-- ════════════════════════════════════════════════════════════════════

drop function if exists public.vendas_por_produto(timestamptz, timestamptz);
create or replace function public.vendas_por_produto(p_since timestamptz, p_until timestamptz)
returns table (
  product_name text,
  vendas bigint, receita numeric, liquido numeric,
  reembolsos bigint, reembolsos_valor numeric
)
language sql stable as $fn$
  with tx as (
    select transaction,
           (array_agg(product_name order by received_at desc))[1] as product_name,
           (array_agg(event        order by received_at desc))[1] as last_event,
           min(received_at)                                        as anchor,
           max(price)                                              as price,
           max(producer_value)                                     as producer_value
    from public.vendas
    where transaction is not null
    group by transaction
  ),
  f as (
    select * from tx where anchor >= p_since and anchor <= p_until
  )
  select
    product_name,
    count(*) filter (where last_event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE'))                         as vendas,
    coalesce(sum(price) filter (where last_event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')),0)           as receita,
    coalesce(sum(producer_value) filter (where last_event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')),0)  as liquido,
    count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK'))                       as reembolsos,
    coalesce(sum(price) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')),0)         as reembolsos_valor
  from f
  group by product_name
  having count(*) filter (
    where last_event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE','PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')
  ) > 0
  order by vendas desc
$fn$;
