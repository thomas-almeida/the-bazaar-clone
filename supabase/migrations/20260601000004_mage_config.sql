-- Overrides de apresentação dos magos (retrato, vídeo de fundo e música),
-- publicados como um único JSON. Patch leve, como o de VFX.

create table if not exists public.mage_config (
  id text primary key default 'published',
  config jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.mage_config enable row level security;
