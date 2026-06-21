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

-- VENDAS REAIS da Hotmart por CONJUNTO (adset.id = tracking_src = utm_term).
-- Permite ROAS real (receita real ÷ investido) por conjunto e, somando, por
-- campanha. No nível de ANÚNCIO não dá pra atribuir venda real (o quiz só captura
-- o id do conjunto), então lá fica só o pixel. Mesma regra das outras abas:
--  • venda conta pela APROVAÇÃO (PURCHASE_APPROVED), ancorada na data da aprovação
--    (exclui os fantasmas COMPLETE-only);
--  • bumps herdam o src do mesmo comprador na janela de ±30 min (não perdem o
--    conjunto de origem);
--  • "vendas" = pedidos únicos (comprador + dia); "itens" = produtos (com bumps);
--  • receita/líquido somam todos os itens.
drop function if exists public.vendas_por_conjunto(timestamptz, timestamptz);
create or replace function public.vendas_por_conjunto(p_since timestamptz, p_until timestamptz)
returns table (adset_id text, vendas bigint, itens bigint, receita numeric, liquido numeric)
language sql stable as $vc$
  with tx0 as (
    select transaction,
           min(received_at)                                            as entry_anchor,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           max(price)                                                  as price,
           max(producer_value)                                         as producer_value,
           max(buyer_email)                                            as buyer_email,
           max(tracking_src) filter (where tracking_src is not null and tracking_src <> '') as src
    from public.vendas
    where transaction is not null
    group by transaction
  ),
  tx as (
    select t.*,
           coalesce(t.src, (
             select t2.src from tx0 t2
             where t2.buyer_email is not null
               and t2.buyer_email = t.buyer_email
               and t2.src is not null
               and abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) <= 1800
             order by abs(extract(epoch from (t2.entry_anchor - t.entry_anchor))) asc
             limit 1
           )) as eff_src
    from tx0 t
  )
  select eff_src as adset_id,
         count(distinct (coalesce(buyer_email, transaction), approved_at::date)) as vendas,
         count(*)                                                                as itens,
         coalesce(sum(price),0)                                                  as receita,
         coalesce(sum(producer_value),0)                                         as liquido
  from tx
  where approved_at is not null and approved_at >= p_since and approved_at <= p_until
    and eff_src ~ '^[0-9]{6,}$'
  group by eff_src
$vc$;

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
