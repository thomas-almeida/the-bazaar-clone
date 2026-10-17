-- Placar de líderes: guarda a build final da run.
--
-- A tabela leaderboard passou a ter uma coluna `slots` (jsonb) com as 4
-- posições do tabuleiro no fim da run, cada uma {cardId, tier} ou null. É o
-- que /leaderboard desenha abaixo do jogador.
--
-- Rode uma vez no SQL Editor do Supabase. Idempotente e seguro para linhas já
-- existentes: as runs antigas simplesmente ficam sem build.

alter table public.leaderboard
  add column if not exists slots jsonb;

comment on column public.leaderboard.slots is
  'Build final da run: 4 posicoes, cada uma {cardId, tier} ou null.';
