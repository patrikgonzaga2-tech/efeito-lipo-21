-- ════════════════════════════════════════════════════════════════════
-- Função vendas_utm: une as vendas reais da Hotmart (sck/src) com os UTMs
-- capturados nas sessões do quiz (pelo id do conjunto = utm_term = tracking_src).
-- Usada pela aba "Origem (UTM)" do dashboard.
--
-- HERANÇA DE SRC NOS ORDER BUMPS: os bumps (Cinturinha, Livro, Vitalício) viram
-- transação separada na Hotmart, que NÃO repassa o src do produto principal.
-- Então, quando uma venda vem sem src, herdamos o src de OUTRA compra do MESMO
-- comprador na MESMA janela de checkout (±30 min) que tenha src. Isso recupera
-- a origem dos bumps sem inventar nada (é o mesmo clique de compra).
--
-- VENDA = APROVAÇÃO (não "complete"): contamos a transação pelo evento
-- PURCHASE_APPROVED, ancorada na DATA DA APROVAÇÃO — é o que a Hotmart chama de
-- "compra aprovada". Antes filtrávamos por APPROVED *ou* COMPLETE e ancorávamos
-- no evento mais recente; mas o PURCHASE_COMPLETE é o aviso de FIM DE GARANTIA,
-- que chega semanas depois. Como muitas compras antigas (anteriores ao rastreio)
-- só mandam o COMPLETE, elas viravam "venda nova" na data errada e SEM src —
-- inflando o balde "sem rastreio". Contando pela aprovação, isso some e o número
-- bate com o painel da Hotmart. (Vendas futuras sempre têm APPROVED, então nada
-- real se perde; só somem os fantasmas pré-rastreio, que nunca tiveram origem.)
-- ════════════════════════════════════════════════════════════════════

create or replace function public.vendas_utm(p_since timestamptz, p_until timestamptz)
returns table (
  received_at timestamptz, product_name text, price numeric, sck text, src text,
  utm_source text, utm_campaign text, utm_medium text, utm_content text
)
language sql stable as $fn$
  appr as (
    -- todas as aprovações no período, numeradas por transação (1 = a 1ª aprovação)
    select transaction, received_at, product_name, price,
           tracking_sck as sck, tracking_src as src, buyer_email,
           row_number() over (partition by transaction order by received_at asc) as rn
    from public.vendas
    where event = 'PURCHASE_APPROVED'
      and received_at >= p_since and received_at <= p_until
  ),
  v as (
    -- 1 venda por transação, definida pela APROVAÇÃO e ancorada na data dela.
    select transaction, received_at, product_name, price, sck, src, buyer_email
    from appr
    where rn = 1
  ),
  -- Se a venda não tem src, herda o src da compra do mesmo comprador mais
  -- próxima no tempo (até 30 min) que tenha src — é o mesmo checkout (bump).
  vf as (
    select v.received_at, v.product_name, v.price, v.sck,
           coalesce(v.src, (
             select v2.src from v v2
             where v2.buyer_email is not null
               and v2.buyer_email = v.buyer_email
               and v2.src is not null
               and abs(extract(epoch from (v2.received_at - v.received_at))) <= 1800
             order by abs(extract(epoch from (v2.received_at - v.received_at))) asc
             limit 1
           )) as src
    from v
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
  select vf.received_at, vf.product_name, vf.price, vf.sck, vf.src,
         u.utm_source, u.utm_campaign, u.utm_medium, u.utm_content
  from vf left join utm u on u.utm_term = vf.src
  order by vf.received_at desc
$fn$;
