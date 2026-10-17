-- Editor de VFX: configuração dos projéteis publicada como um único JSON.
-- Patch leve (sem versionamento nem uploads): uma linha publicada que o jogo lê
-- e que o painel sobrescreve ao publicar.

create table if not exists public.vfx_config (
  id text primary key default 'published',
  config jsonb not null,
  updated_at timestamptz not null default now()
);

-- Só o service role escreve/lê (pela API server-side). RLS ligado sem políticas
-- bloqueia acesso anônimo direto; o service role ignora RLS.
alter table public.vfx_config enable row level security;
