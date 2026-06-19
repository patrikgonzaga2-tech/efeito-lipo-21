-- ════════════════════════════════════════════════════════════════════
-- Operação Corpo Feliz — Vendas (Hotmart): schema de rastreio
-- Cole tudo no Supabase → SQL Editor → Run.
-- Seguro rodar mais de uma vez (idempotente).
-- ════════════════════════════════════════════════════════════════════

-- Log de eventos de venda: UMA linha por aviso (webhook) que a Hotmart envia.
-- Uma mesma compra gera vários avisos ao longo do tempo (aprovada → reembolso,
-- etc.). Guardamos todos como histórico; o status "atual" de cada transação é
-- o evento mais recente daquela transação (transaction).
create table if not exists public.vendas (
  id                uuid primary key default gen_random_uuid(),
  received_at       timestamptz not null default now(),  -- quando NÓS recebemos

  -- Identificação do aviso e da compra
  hotmart_event_id  text unique,        -- id único do aviso (evita duplicar reenvios)
  event             text,               -- PURCHASE_APPROVED | PURCHASE_REFUNDED | ...
  status            text,               -- APPROVED | REFUNDED | CANCELED | ...
  transaction       text,               -- código da compra (igual entre eventos da mesma compra)

  -- Produto / oferta
  product_id        text,
  product_name      text,
  offer_code        text,

  -- Comprador
  buyer_email       text,
  buyer_name        text,
  buyer_phone       text,
  buyer_doc         text,

  -- Valores
  price             numeric,            -- valor pago pelo cliente
  full_price        numeric,            -- valor cheio (antes de desconto)
  producer_value    numeric,            -- quanto sobra pro produtor (comissão PRODUCER)
  currency          text,
  payment_method    text,               -- CREDIT_CARD | BILLET | PIX | ...
  installments      int,                -- nº de parcelas

  -- Rastreio (a ponte com o Meta / quiz). A Hotmart v2 manda em purchase.origin
  -- (sck/src/xcod); produtos antigos em purchase.tracking. xcod = id de
  -- deduplicação gerado no site (casa a venda com o evento do GTM/Meta CAPI).
  tracking_src      text,
  tracking_sck      text,
  tracking_xcod     text,

  -- Assinatura (quando for produto recorrente)
  subscription_status text,
  plan_name           text,
  subscriber_code     text,

  -- Datas vindas da Hotmart
  order_date        timestamptz,        -- quando o pedido foi feito
  approved_date     timestamptz,        -- quando a compra foi aprovada

  -- Payload bruto completo: NUNCA perdemos nada que a Hotmart mandou.
  raw               jsonb not null default '{}'::jsonb
);

create index if not exists vendas_event_idx       on public.vendas(event);
create index if not exists vendas_transaction_idx on public.vendas(transaction);
create index if not exists vendas_sck_idx         on public.vendas(tracking_sck);
create index if not exists vendas_email_idx       on public.vendas(buyer_email);
create index if not exists vendas_received_idx    on public.vendas(received_at desc);

-- Segurança: liga RLS e NÃO cria policies para chaves públicas (anon).
-- Resultado: ninguém lê/escreve com chave pública. Só o servidor/Edge Function
-- (service_role, que ignora RLS) grava e o dashboard lê.
alter table public.vendas enable row level security;
