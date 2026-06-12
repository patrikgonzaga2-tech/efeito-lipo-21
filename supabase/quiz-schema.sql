-- ════════════════════════════════════════════════════════════════════
-- Efeito Lipo — Quiz: schema de rastreio
-- Cole tudo no Supabase → SQL Editor → Run.
-- Seguro rodar mais de uma vez (idempotente).
-- ════════════════════════════════════════════════════════════════════

-- Sessões: uma linha por visitante do quiz
create table if not exists public.quiz_sessions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  status        text not null default 'started',   -- pageview | started | completed
  reached_index int  not null default 0,           -- tela mais avançada alcançada
  variante      text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  sck           text,
  referrer      text,
  user_agent    text,
  altura        int,
  peso          int,
  meta_peso     int,
  answers       jsonb not null default '{}'::jsonb,
  completed_at      timestamptz,
  checkout_clicked  boolean not null default false,
  checkout_at       timestamptz
);

-- Eventos: log granular de cada ação (start, step, complete, checkout)
create table if not exists public.quiz_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  uuid not null references public.quiz_sessions(id) on delete cascade,
  event       text not null,        -- pageview | start | step | complete | checkout
  step_index  int,
  step_id     text,
  answer      text,
  payload     jsonb
);

create index if not exists quiz_events_session_idx on public.quiz_events(session_id);
create index if not exists quiz_events_event_idx   on public.quiz_events(event);
create index if not exists quiz_sessions_created_idx on public.quiz_sessions(created_at desc);

-- Segurança: liga RLS e NÃO cria policies para anon/publishable.
-- Resultado: ninguém acessa os dados com as chaves públicas.
-- O servidor (service_role) ignora RLS, então a gravação e o dashboard funcionam.
alter table public.quiz_sessions enable row level security;
alter table public.quiz_events   enable row level security;
