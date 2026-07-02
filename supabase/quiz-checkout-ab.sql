-- ─────────────────────────────────────────────────────────────────────
-- Teste A/B de checkout do quiz: Hotmart (A) × Greenn (B)
-- Operação Corpo Feliz — Efeito Lipo
--
-- Rodar UMA vez no SQL Editor do Supabase (precisa do token sbp_ / service_role
-- não aplica DDL). São duas coisas:
--   1) coluna checkout_ab em quiz_sessions (qual checkout a sessão recebeu)
--   2) função quiz_checkout_ab (vendas/receita por gateway, SÓ do funil do quiz)
-- ─────────────────────────────────────────────────────────────────────

-- 1) DENOMINADOR — grava, na sessão, para qual checkout a pessoa foi mandada.
--    Sem isso o front quebra o rastreio de checkout (o upsert falharia). Aplique
--    ANTES de subir o front novo.
alter table public.quiz_sessions
  add column if not exists checkout_ab text;

-- 2) NUMERADOR — vendas aprovadas por gateway, isolando o funil do quiz pelo
--    marcador tracking_sck = 'efeito-lipo-quiz' (Hotmart manda no sck; Greenn no
--    utm_source → os dois caem em tracking_sck). Mesma lógica de dedup/reembolso
--    do funil_resumo, mas agrupada por gateway e restrita ao quiz. Assim a
--    Greenn hospedar outros produtos NÃO contamina a conta.
drop function if exists public.quiz_checkout_ab(timestamptz, timestamptz);
create or replace function public.quiz_checkout_ab(
  p_since timestamptz, p_until timestamptz
)
returns table (
  gateway text,
  vendas bigint,
  itens bigint,
  receita numeric,
  liquido numeric,
  reembolsos bigint,
  reembolsos_valor numeric
)
language sql stable as $fn$
  with tx as (
    select
      gateway,
      transaction,
      (array_agg(event order by received_at desc))[1]              as last_event,
      min(received_at) filter (where event = 'PURCHASE_APPROVED')  as approved_at,
      min(received_at)                                             as entry_anchor,
      max(price)                                                   as price,
      max(producer_value)                                         as producer_value,
      max(buyer_email)                                            as buyer_email
    from public.vendas
    where transaction is not null
      and coalesce(tracking_sck, '') = 'efeito-lipo-quiz'
    group by gateway, transaction
  )
  select
    gateway,
    count(distinct (coalesce(buyer_email, transaction), approved_at::date))
      filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)          as vendas,
    count(*)
      filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until)          as itens,
    coalesce(sum(price)
      filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until), 0)      as receita,
    coalesce(sum(producer_value)
      filter (where approved_at is not null and approved_at >= p_since and approved_at <= p_until), 0)      as liquido,
    count(*)
      filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until)        as reembolsos,
    coalesce(sum(price)
      filter (where last_event in ('PURCHASE_REFUNDED','PURCHASE_CHARGEBACK') and entry_anchor >= p_since and entry_anchor <= p_until), 0)    as reembolsos_valor
  from tx
  group by gateway
$fn$;
