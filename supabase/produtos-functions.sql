-- ════════════════════════════════════════════════════════════════════
-- Função vendas_por_produto: vendas LÍQUIDAS (estado atual de cada compra)
-- agrupadas por produto, + reembolsos por produto. Usada pela aba "Produtos"
-- (principal + order bumps + taxa de reembolso por produto).
--
-- Mesma lógica do funil_resumo: cada transação vira UMA linha. A VENDA conta
-- pela APROVAÇÃO (evento PURCHASE_APPROVED) e é ancorada na data da aprovação —
-- isso exclui os fantasmas (compras antigas que só mandam o PURCHASE_COMPLETE,
-- fim da garantia, semanas depois, e sem origem). Reembolso = REFUNDED/CHARGEBACK
-- pelo estado atual, ancorado no 1º aviso da compra.
-- Obs.: aqui "vendas" é por TRANSAÇÃO (cada item vendido conta), não por pedido
-- único — é a contagem certa por produto (o bump é um produto à parte).
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
           (array_agg(product_name order by received_at desc))[1]      as product_name,
           (array_agg(event        order by received_at desc))[1]      as last_event,
           min(received_at)                                            as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           max(price)                                                  as price,
           max(producer_value)                                         as producer_value
    from public.vendas
    where transaction is not null
    group by transaction
  )
  select
    product_name,
    count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)                          as vendas,
    coalesce(sum(price) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)            as receita,
    coalesce(sum(producer_value) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until),0)   as liquido,
    count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until)               as reembolsos,
    coalesce(sum(price) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until),0) as reembolsos_valor
  from tx
  group by product_name
  having
    count(*) filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until) > 0
    or count(*) filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until) > 0
  order by vendas desc
$fn$;
