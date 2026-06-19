-- ════════════════════════════════════════════════════════════════════
-- Função vendas_por_produto: vendas reais (dedup por transação) agrupadas
-- por produto. Usada pela aba "Produtos" (principal + order bumps + taxas).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.vendas_por_produto(p_since timestamptz, p_until timestamptz)
returns table (product_name text, vendas bigint, receita numeric)
language sql stable as $fn$
  with v as (
    select distinct on (transaction) transaction, product_name, price
    from public.vendas
    where event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')
      and received_at >= p_since and received_at <= p_until
    order by transaction, received_at desc
  )
  select product_name, count(*) vendas, coalesce(sum(price),0) receita
  from v group by product_name order by vendas desc
$fn$;
