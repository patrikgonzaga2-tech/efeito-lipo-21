-- ════════════════════════════════════════════════════════════════════
-- Nível ANÚNCIO: tabela meta_ads + função ranking_anuncios (aba Anúncios).
-- O robô meta-insights, além do nível de conjunto, puxa level=ad de cada
-- conjunto rastreado e grava aqui. Cole no Supabase → SQL Editor → Run.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.meta_ads (
  ad_id text not null, date date not null,
  ad_name text, adset_id text, adset_name text, campaign_id text, campaign_name text,
  spend numeric, impressions bigint, link_clicks bigint, lp_views bigint, ic bigint,
  purchases bigint, purchase_value numeric, ctr numeric, cpc numeric, cpm numeric,
  updated_at timestamptz not null default now(),
  primary key (ad_id, date)
);
create index if not exists meta_ads_adset_idx    on public.meta_ads(adset_id);
create index if not exists meta_ads_campaign_idx on public.meta_ads(campaign_id);
create index if not exists meta_ads_date_idx     on public.meta_ads(date desc);
alter table public.meta_ads enable row level security;

-- Agrega por anúncio num período (métricas do Meta; não há venda real por anúncio).
create or replace function public.ranking_anuncios(p_since timestamptz, p_until timestamptz)
returns table (
  ad_id text, ad_name text, adset_name text, campaign_name text,
  spend numeric, impressions bigint, link_clicks bigint, ic bigint, purchases bigint, purchase_value numeric
)
language sql stable as $fn$
  select ad_id, max(ad_name), max(adset_name), max(campaign_name),
         sum(spend), sum(impressions), sum(link_clicks), sum(ic), sum(purchases), sum(purchase_value)
  from public.meta_ads
  where date >= (p_since at time zone 'America/Sao_Paulo')::date
    and date <= (p_until at time zone 'America/Sao_Paulo')::date
  group by ad_id
$fn$;
