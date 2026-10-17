-- MAGGI · Placar de líderes.
-- Uma linha por jogador: SEMPRE a última run (upsert em user_id sobrescreve).
-- Rode este script no SQL Editor do seu projeto Supabase (uma vez).

create table if not exists public.leaderboard (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  display_name  text not null,
  mage_id       text not null,
  victories     integer not null default 0,  -- vitórias de combate na última run
  completed     boolean not null default false, -- concluiu as 3 voltas?
  -- Build final da run: 4 posicoes, cada uma {cardId, tier} ou null.
  -- E o que o placar mostra abaixo do jogador.
  slots         jsonb,
  updated_at    timestamptz not null default now()
);

create index if not exists leaderboard_rank_idx
  on public.leaderboard (completed desc, victories desc, updated_at desc);

alter table public.leaderboard enable row level security;

-- O jogador só escreve a própria linha (insert + update do mesmo user_id).
drop policy if exists "upsert own leaderboard row" on public.leaderboard;
create policy "upsert own leaderboard row"
  on public.leaderboard
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "update own leaderboard row" on public.leaderboard;
create policy "update own leaderboard row"
  on public.leaderboard
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Leitura do placar é só pelo backend (service role, via /api/leaderboard).
