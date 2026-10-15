create table if not exists public.balance_patches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  status text not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists balance_patches_one_published
  on public.balance_patches (status)
  where status = 'published';

create table if not exists public.balance_patch_cards (
  patch_id uuid not null references public.balance_patches(id) on delete cascade,
  card_id text not null check (card_id ~ '^[a-z0-9-]+$'),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  primary key (patch_id, card_id),
  constraint balance_card_definition_id_matches
    check (definition ->> 'id' = card_id)
);

alter table public.balance_patches enable row level security;
alter table public.balance_patch_cards enable row level security;

insert into public.balance_patches (id, name, status, published_at)
values (
  '00000000-0000-4000-8000-000000000001',
  'Initial balance',
  'published',
  now()
)
on conflict (id) do nothing;

insert into public.balance_patch_cards (patch_id, card_id, definition, enabled, sort_order)
select
  '00000000-0000-4000-8000-000000000001'::uuid,
  card ->> 'id',
  card,
  true,
  ordinality::integer - 1
from jsonb_array_elements(
  '[
    {"id":"dragon-whelp","name":"DRAGON WHELP","kind":"creature","level":1,"cost":4,"cooldown":4,"damage":2,"description":"A fierce little dragon ready to join the fight."},
    {"id":"phoenix-lord","name":"PHOENIX LORD","kind":"creature","level":3,"cost":7,"cooldown":5,"damage":4,"description":"When destroyed, return to your hand and deal 3 damage to all enemies."},
    {"id":"healing-rain","name":"HEALING RAIN","kind":"spell","cost":3,"cooldown":3,"effectType":"healing","effectValue":4,"description":"Restore 4 health to all friendly creatures."},
    {"id":"moonlit-mage","name":"MOONLIT MAGE","kind":"creature","level":2,"cost":5,"cooldown":3,"damage":3,"description":"At the start of your turn, deal 1 damage to all enemies."},
    {"id":"ember-sprite","name":"EMBER SPRITE","kind":"creature","level":1,"cost":2,"cooldown":1.5,"damage":1,"description":"A quick spark that strikes before the enemy can react."},
    {"id":"tide-guardian","name":"TIDE GUARDIAN","kind":"creature","level":2,"cost":4,"cooldown":4,"damage":2,"description":"A steady defender that keeps the frontline safe."},
    {"id":"thorn-beast","name":"THORN BEAST","kind":"creature","level":2,"cost":3,"cooldown":2,"damage":2,"description":"A thorny beast with a reliable attack."},
    {"id":"starfall","name":"STARFALL","kind":"spell","cost":2,"cooldown":2,"effectType":"damage","effectValue":3,"description":"Deal 3 damage with a focused burst of astral energy."},
    {"id":"arcane-barrier","name":"ARCANE BARRIER","kind":"spell","cost":3,"cooldown":4,"effectType":"shield","effectValue":3,"description":"Grant 3 shield to all friendly creatures."},
    {"id":"verdant-bloom","name":"VERDANT BLOOM","kind":"spell","cost":2,"cooldown":2,"effectType":"healing","effectValue":3,"description":"A quick bloom that mends light wounds."},
    {"id":"sacred-font","name":"SACRED FONT","kind":"spell","cost":5,"cooldown":5,"effectType":"healing","effectValue":6,"description":"A holy font that restores a large amount of health."},
    {"id":"iron-ward","name":"IRON WARD","kind":"spell","cost":2,"cooldown":2,"effectType":"shield","effectValue":2,"description":"A swift ward that raises a small barrier."},
    {"id":"aegis-totem","name":"AEGIS TOTEM","kind":"spell","cost":5,"cooldown":5,"effectType":"shield","effectValue":5,"description":"A sturdy totem that grants a heavy shield."},
    {"id":"pack-alpha","name":"PACK ALPHA","kind":"creature","level":2,"cost":4,"cooldown":4,"damage":2,"description":"Líder de matilha: reforça as criaturas ao seu lado.","synergy":{"dir":"both","requires":"creature","bonusValue":2,"label":"+2 de dano às criaturas adjacentes"}},
    {"id":"tide-totem","name":"TIDE TOTEM","kind":"equipment","cost":4,"cooldown":0,"target":"self","description":"Totem veloz: acelera a carta imediatamente à direita.","synergy":{"dir":"right","cooldownMult":0.7,"label":"-30% de cooldown na carta à direita"}},
    {"id":"soul-link","name":"SOUL LINK","kind":"spell","cost":3,"cooldown":3,"effectType":"healing","effectValue":2,"description":"Elo de alma: potencializa a carta imediatamente à esquerda.","synergy":{"dir":"left","bonusValue":2,"label":"+2 ao efeito da carta à esquerda"}},
    {"id":"time-crystal","name":"TIME CRYSTAL","kind":"equipment","cost":4,"cooldown":0,"target":"self","valueHaste":0.12,"description":"Acelera o crescimento de dano, cura e escudo das suas cartas."},
    {"id":"swift-gear","name":"SWIFT GEAR","kind":"equipment","cost":4,"cooldown":0,"target":"self","cooldownHaste":0.5,"description":"Reduz o cooldown das suas cartas progressivamente."},
    {"id":"hex-chain","name":"HEX CHAIN","kind":"equipment","cost":5,"cooldown":0,"target":"enemy","valueHaste":0.09,"cooldownHaste":0.06,"description":"Desacelera o haste das cartas do adversário."}
  ]'::jsonb
) with ordinality as seeded(card, ordinality)
on conflict (patch_id, card_id) do nothing;

create or replace function public.publish_balance_patch(p_patch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.balance_patches
    where id = p_patch_id and status = 'draft'
  ) then
    raise exception 'Only a draft balance patch can be published';
  end if;

  if not exists (
    select 1 from public.balance_patch_cards
    where patch_id = p_patch_id and enabled
  ) then
    raise exception 'A balance patch must contain at least one enabled card';
  end if;

  update public.balance_patches
  set status = 'archived'
  where status = 'published';

  update public.balance_patches
  set status = 'published', published_at = now()
  where id = p_patch_id;
end;
$$;

revoke all on function public.publish_balance_patch(uuid) from public, anon, authenticated;
grant execute on function public.publish_balance_patch(uuid) to service_role;
grant all on public.balance_patches, public.balance_patch_cards to service_role;
