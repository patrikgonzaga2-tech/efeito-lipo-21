-- ════════════════════════════════════════════════════════════════════
-- PONTE — o front em produção ainda chama a assinatura ANTIGA
--
-- Ao trocar a oferta, mudei p_upsell_offer (text) para p_upsell_offers (text[])
-- no banco. Mas o deploy do front depende do Patrik sincronizar o fork — ou
-- seja, por um tempo o banco novo convive com o FRONT VELHO, que chama pelo
-- nome antigo. O PostgREST casa a função pelo NOME dos argumentos: sem a versão
-- antiga, a chamada morre em PGRST202 e a aba Upsell (e o bloco de upsell do
-- Funil) mostram zero — foi exatamente o que aconteceu.
--
-- Regra que fica: NUNCA remover a assinatura antiga enquanto o front que a usa
-- estiver no ar. Cria-se a nova e mantém-se a velha como ponte (o Postgres
-- aceita as duas: text e text[] são tipos diferentes).
--
-- A ponte devolve AS DUAS OFERTAS, não só a que o front velho sabe pedir — se
-- devolvesse apenas a antiga, a tela esconderia as vendas da oferta nova e
-- mentiria de outro jeito. Pode ser apagada depois que o fork for sincronizado.
-- ════════════════════════════════════════════════════════════════════

-- Ofertas do upsell, na ordem: atual, aposentada. Mesma lista do front
-- (UPSELL_OFFERS em app/efeito-lipo-quiz/dashboard/upsell/page.tsx).
create or replace function public.upsell_resumo(
  p_since        timestamptz,
  p_until        timestamptz,
  p_upsell_offer text,                              -- assinatura ANTIGA (uma oferta só)
  p_main_product text,
  p_slug         text default 'acompanhamento-up'
)
returns table (
  vendas bigint, receita numeric, liquido numeric,
  reembolsos bigint, reembolsos_valor numeric,
  base bigint, views bigint, views_desde timestamptz
)
language sql stable as $fn$
  select * from public.upsell_resumo(
    p_since, p_until,
    (select array_agg(distinct o) from unnest(array[p_upsell_offer, 'O8j7nc', '8QUFs9']) o),
    p_main_product, p_slug
  )
$fn$;

create or replace function public.upsell_canais(
  p_since        timestamptz,
  p_until        timestamptz,
  p_upsell_offer text,
  p_main_product text,
  p_slug         text default 'acompanhamento-up'
)
returns table (canal text, msg text, vendas bigint, receita numeric, liquido numeric, views bigint)
language sql stable as $fn$
  select * from public.upsell_canais(
    p_since, p_until,
    (select array_agg(distinct o) from unnest(array[p_upsell_offer, 'O8j7nc', '8QUFs9']) o),
    p_main_product, p_slug
  )
$fn$;
