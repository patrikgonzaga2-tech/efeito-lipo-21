-- ════════════════════════════════════════════════════════════════════
-- Função roi_conjuntos: cruza gasto (meta_insights) + funil (quiz_sessions)
-- + vendas (vendas) por CONJUNTO de anúncio (adset.id = utm_term = tracking_src),
-- num intervalo de datas. Usada pelo dashboard /efeito-lipo-quiz/dashboard/roi.
-- Cole no Supabase → SQL Editor → Run. Seguro rodar de novo (create or replace).
-- ════════════════════════════════════════════════════════════════════

create or replace function public.roi_conjuntos(p_since timestamptz, p_until timestamptz)
returns table (
  adset_id text, adset_name text, campaign_id text, campaign_name text,
  spend numeric, sessions bigint, checkouts bigint, vendas bigint, receita numeric
)
language sql stable as $fn$
  with sp as (
    select ad_id as adset_id,
           max(adset_name) adset_name, max(campaign_id) campaign_id,
           max(campaign_name) campaign_name, sum(spend) spend
    from public.meta_insights
    where date >= (p_since at time zone 'America/Sao_Paulo')::date
      and date <= (p_until at time zone 'America/Sao_Paulo')::date
    group by ad_id
  ),
  q as (
    select utm_term adset_id,
           count(*) sessions,
           count(*) filter (where checkout_clicked) checkouts
    from public.quiz_sessions
    where created_at >= p_since and created_at <= p_until
      and utm_term ~ '^[0-9]{6,}$'
    group by utm_term
  ),
  v as (
    -- receita por conjunto: deduplica eventos pela transação (1 venda = 1 linha)
    select adset_id, count(*) vendas, sum(price) receita
    from (
      select distinct on (transaction) tracking_src adset_id, price
      from public.vendas
      where event in ('PURCHASE_APPROVED','PURCHASE_COMPLETE')
        and received_at >= p_since and received_at <= p_until
        and tracking_src ~ '^[0-9]{6,}$'
      order by transaction, received_at desc
    ) d
    group by adset_id
  )
  select sp.adset_id, sp.adset_name, sp.campaign_id, sp.campaign_name,
         coalesce(sp.spend,0), coalesce(q.sessions,0), coalesce(q.checkouts,0),
         coalesce(v.vendas,0), coalesce(v.receita,0)
  from sp
  left join q on q.adset_id = sp.adset_id
  left join v on v.adset_id = sp.adset_id
$fn$;
