-- ════════════════════════════════════════════════════════════════════
-- MARCA · Fase 3 — Recorrência / MRR (assinaturas da Comunidade)
-- Cole no Supabase → SQL Editor → Run. Seguro rodar de novo.
--
-- A Greenn manda DOIS tipos de webhook: "sale" (cobrança = vai pra vendas) e
-- "contract" (ciclo da assinatura: created/active/ended/canceled = vai pra cá).
-- Até agora a função ignorava os de contrato; nesta fase a greenn-webhook passa
-- a gravá-los aqui, o que permite medir assinantes ativos, MRR e churn.
--
-- Enquanto os eventos de contrato não acumulam, as métricas de COBRANÇA (receita
-- recorrente coletada, nº de assinantes com cobrança) já saem da tabela `vendas`
-- (família Comunidade) — então a tela já mostra dado real desde já.
-- ════════════════════════════════════════════════════════════════════

-- 1) Tabela de eventos de assinatura (1 linha por aviso de contrato).
create table if not exists public.assinaturas (
  id                  uuid primary key default gen_random_uuid(),
  received_at         timestamptz not null default now(),
  gateway             text not null default 'greenn',
  greenn_event_id     text unique,            -- dedup: greenn-contract-{contract_id}-{status}
  event               text,
  contract_id         text,
  subscription_id     text,
  status              text,                   -- ended | active | created | canceled | trialing ...
  old_status          text,
  product_id          text,
  product_name        text,
  plan_amount         numeric,                -- valor do plano (ex.: 210)
  plan_period_days    int,                    -- período em dias (ex.: 180 = semestral)
  buyer_email         text,
  buyer_name          text,
  started_at          timestamptz,
  current_period_end  timestamptz,
  raw                 jsonb not null default '{}'::jsonb
);
create index if not exists assinaturas_sub_idx    on public.assinaturas(subscription_id);
create index if not exists assinaturas_status_idx on public.assinaturas(status);
create index if not exists assinaturas_recv_idx   on public.assinaturas(received_at desc);
alter table public.assinaturas enable row level security;

-- 2) recorrencia_resumo — manchete da recorrência.
--    assinantes = pessoas com cobrança da Comunidade não reembolsada (vendas).
--    mrr_estimado = soma da última cobrança de cada assinante ÷ 6 (plano semestral).
--    cancelados = assinaturas que viraram ended/canceled no período (assinaturas).
drop function if exists public.recorrencia_resumo(timestamptz, timestamptz);
create or replace function public.recorrencia_resumo(p_since timestamptz, p_until timestamptz)
returns table (
  assinantes bigint, cobrancas bigint, receita_coletada numeric,
  mrr_estimado numeric, arr_estimado numeric, cancelados bigint
)
language sql stable as $fn$
  with com as (
    select transaction,
           max(subscriber_code)                                        as sub,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           (array_agg(event order by received_at desc))[1]             as last_event,
           max(price)                                                  as price
    from public.vendas_norm
    where familia = 'Comunidade' and transaction is not null
    group by transaction
  ),
  pagas as (
    select * from com
    where approved_at is not null
      and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')
  ),
  ult_sub as (   -- última cobrança de cada assinante (p/ estimar o MRR)
    select distinct on (coalesce(sub, transaction)) coalesce(sub, transaction) as sub, price
    from pagas
    order by coalesce(sub, transaction), approved_at desc
  )
  select
    (select count(*) from ult_sub)                                                     as assinantes,
    (select count(*) from pagas where approved_at >= p_since and approved_at <= p_until) as cobrancas,
    coalesce((select sum(price) from pagas where approved_at >= p_since and approved_at <= p_until), 0) as receita_coletada,
    coalesce((select sum(price) from ult_sub), 0) / 6.0                                 as mrr_estimado,
    coalesce((select sum(price) from ult_sub), 0) / 6.0 * 12                            as arr_estimado,
    coalesce((select count(distinct subscription_id) from public.assinaturas
              where status in ('ended','canceled','cancelled')
                and received_at >= p_since and received_at <= p_until), 0)              as cancelados
$fn$;

-- 3) recorrencia_lista — assinantes (1 linha cada) com total pago e status.
drop function if exists public.recorrencia_lista(int);
create or replace function public.recorrencia_lista(p_limit int default 100)
returns table (
  nome text, email text, sub text, cobrancas bigint,
  total_pago numeric, primeira timestamptz, ultima timestamptz, status text
)
language sql stable as $fn$
  with com as (
    select transaction,
           max(subscriber_code)                                        as sub,
           max(buyer_name)                                             as nome,
           max(buyer_email)                                            as email,
           min(received_at) filter (where event = 'PURCHASE_APPROVED') as approved_at,
           (array_agg(event order by received_at desc))[1]             as last_event,
           max(price)                                                  as price
    from public.vendas_norm
    where familia = 'Comunidade' and transaction is not null
    group by transaction
  ),
  pagas as (
    select * from com
    where approved_at is not null
      and last_event not in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK')
  ),
  agg as (
    select coalesce(sub, transaction) as sub,
           max(nome) as nome, max(email) as email,
           count(*) as cobrancas, sum(price) as total_pago,
           min(approved_at) as primeira, max(approved_at) as ultima
    from pagas
    group by coalesce(sub, transaction)
  ),
  status_sub as (   -- status mais recente de cada assinatura (se houver evento)
    select distinct on (subscription_id) subscription_id, status
    from public.assinaturas
    where subscription_id is not null
    order by subscription_id, received_at desc
  )
  select a.nome, a.email, a.sub, a.cobrancas, a.total_pago, a.primeira, a.ultima,
         coalesce(s.status, 'ativo') as status
  from agg a
  left join status_sub s on s.subscription_id = a.sub
  order by a.total_pago desc nulls last
  limit p_limit
$fn$;
