-- MAGGI · PVP assíncrono: snapshots das builds reais dos jogadores.
-- Rode este script no SQL Editor do seu projeto Supabase (uma vez).
-- A cada confronto da fase "player" (3 por run), o board do jogador é gravado aqui.

create table if not exists public.build_snapshots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  display_name  text not null,
  mage_id       text not null,
  pass          smallint not null check (pass between 1 and 3),
  max_health    integer not null,
  slots         jsonb not null,          -- [{cardId, tier} | null] × 4
  catalog_version text,
  created_at    timestamptz not null default now()
);

-- Busca de oponentes é por "pass" (força equivalente), mais recentes primeiro.
create index if not exists build_snapshots_pass_idx
  on public.build_snapshots (pass, created_at desc);

alter table public.build_snapshots enable row level security;

-- O jogador só pode inserir snapshots em nome dele mesmo.
drop policy if exists "insert own snapshots" on public.build_snapshots;
create policy "insert own snapshots"
  on public.build_snapshots
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Nenhuma policy de SELECT para anon/authenticated: a leitura de oponentes
-- acontece só pelo backend (service role, via /api/snapshots), que ignora RLS.
