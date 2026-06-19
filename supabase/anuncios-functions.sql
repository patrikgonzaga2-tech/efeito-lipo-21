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

-- Status atual (ativo/pausado/reprovado) de conjuntos e anúncios. O robô faz
-- upsert por id a cada run (effective_status do Meta). Não é por data.
create table if not exists public.meta_status (
  id text primary key, level text, status text, updated_at timestamptz not null default now()
);
alter table public.meta_status enable row level security;

-- Funil completo por CONJUNTO (do meta_insights) — usado nas tabelas da aba
-- Anúncios (campanhas = soma dos conjuntos; conjuntos = direto).
drop function if exists public.ranking_conjuntos(timestamptz, timestamptz);
create function public.ranking_conjuntos(p_since timestamptz, p_until timestamptz)
returns table (
  adset_id text, adset_name text, campaign_id text, campaign_name text,
  spend numeric, impressions bigint, link_clicks bigint, lp_views bigint, ic bigint, purchases bigint, purchase_value numeric
)
language sql stable as $a$
  select ad_id, max(adset_name), max(campaign_id), max(campaign_name),
         sum(spend), sum(impressions), sum(link_clicks), sum(lp_views), sum(ic), sum(purchases), sum(purchase_value)
  from public.meta_insights
  where date >= (p_since at time zone 'America/Sao_Paulo')::date
    and date <= (p_until at time zone 'America/Sao_Paulo')::date
  group by ad_id
$a$;

-- Funil completo por ANÚNCIO (do meta_ads). Conversão = compras (pixel); não
-- há venda real por anúncio (utm_term é adset.id).
drop function if exists public.ranking_anuncios(timestamptz, timestamptz);
create function public.ranking_anuncios(p_since timestamptz, p_until timestamptz)
returns table (
  ad_id text, ad_name text, adset_name text, campaign_name text,
  spend numeric, impressions bigint, link_clicks bigint, lp_views bigint, ic bigint, purchases bigint, purchase_value numeric
)
language sql stable as $b$
  select ad_id, max(ad_name), max(adset_name), max(campaign_name),
         sum(spend), sum(impressions), sum(link_clicks), sum(lp_views), sum(ic), sum(purchases), sum(purchase_value)
  from public.meta_ads
  where date >= (p_since at time zone 'America/Sao_Paulo')::date
    and date <= (p_until at time zone 'America/Sao_Paulo')::date
  group by ad_id
$b$;
