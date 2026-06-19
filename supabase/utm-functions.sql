-- ════════════════════════════════════════════════════════════════════
-- Função vendas_utm: une as vendas reais da Hotmart (sck/src) com os UTMs
-- capturados nas sessões do quiz (pelo id do conjunto = utm_term = tracking_src).
-- Usada pela aba "Origem (UTM)" do dashboard.
-- ════════════════════════════════════════════════════════════════════

create or replace function public.vendas_utm(p_since timestamptz, p_until timestamptz)
returns table (
  received_at timestamptz, product_name text, price numeric, sck text, src text,
  utm_source text, utm_campaign text, utm_medium text, utm_content text
)
language sql stable as $fn$
  with v as (
    -- 1 venda por transação (deduplica eventos)
    select distinct on (transaction) transaction, received_at, product_name, price,
           tracking_sck sck, tracking_src src
    from public.vendas
    where event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')
      and received_at >= p_since and received_at <= p_until
    order by transaction, received_at desc
  ),
  utm as (
    -- UTMs representativos por conjunto (utm_term): mode = valor mais frequente
    select utm_term,
           mode() within group (order by utm_source)   utm_source,
           mode() within group (order by utm_campaign) utm_campaign,
           mode() within group (order by utm_medium)   utm_medium,
           mode() within group (order by utm_content)  utm_content
    from public.quiz_sessions
    where utm_term is not null and utm_term <> ''
    group by utm_term
  )
  select v.received_at, v.product_name, v.price, v.sck, v.src,
         u.utm_source, u.utm_campaign, u.utm_medium, u.utm_content
  from v left join utm u on u.utm_term = v.src
  order by v.received_at desc
$fn$;
