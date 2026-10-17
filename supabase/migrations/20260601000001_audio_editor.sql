-- Editor de áudio: patches versionados com biblioteca de sons e bindings de
-- evento. Espelha o padrão de balance_patches / balance_patch_cards para que
-- som e balanceamento sejam publicados de forma independente.
--
-- Rode uma vez pelo SQL Editor do Supabase (ou pelo CLI). Idempotente.

create table if not exists public.audio_patches (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 100),
  status text not null check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create unique index if not exists audio_patches_one_published
  on public.audio_patches (status)
  where status = 'published';

-- Biblioteca de arquivos: o banco guarda o caminho servido em /public, não o
-- arquivo (o upload local só existe em desenvolvimento).
create table if not exists public.audio_patch_sounds (
  patch_id uuid not null references public.audio_patches(id) on delete cascade,
  sound_id text not null,
  label text not null check (length(trim(label)) between 1 and 80),
  path text not null check (length(trim(path)) between 1 and 2048),
  category text not null check (category in ('dado', 'item', 'ui')),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  primary key (patch_id, sound_id)
);

-- O id do som preserva o camelCase da biblioteca atual (diceA, attackSword,
-- cardHover...). A constraint é (re)criada aqui em vez de ficar no CREATE TABLE
-- porque a tabela pode ter sido criada por uma versão anterior desta migration,
-- com a regex só minúscula — caso em que o CREATE acima é ignorado.
alter table public.audio_patch_sounds drop constraint if exists audio_patch_sounds_sound_id_check;
alter table public.audio_patch_sounds
  add constraint audio_patch_sounds_sound_id_check check (sound_id ~ '^[a-zA-Z0-9-]+$');

-- Binding: liga um evento nomeado a um som, com volume e intervalo mínimo.
-- `event` = "card:<cardId>" | "event:<nome>" | "ui:<tela>.<acao>".
-- sound_id null deixa o evento silencioso.
create table if not exists public.audio_patch_bindings (
  patch_id uuid not null references public.audio_patches(id) on delete cascade,
  event text not null check (length(trim(event)) between 3 and 120),
  -- Sem FK para audio_patch_sounds: a PK é (patch_id, sound_id) e um ON DELETE
  -- SET NULL aqui zeraria a própria patch_id. A consistência é garantida nas
  -- rotas de admin, que gravam e apagam som e binding juntos.
  sound_id text,
  volume double precision not null default 0.7 check (volume >= 0 and volume <= 1),
  min_interval_ms integer not null default 0 check (min_interval_ms >= 0 and min_interval_ms <= 60000),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  primary key (patch_id, event)
);

create index if not exists audio_patch_bindings_event_idx
  on public.audio_patch_bindings (event);

-- Mesma forma de chave validada em src/lib/admin-audio.ts. (re)criada pelo
-- mesmo motivo da constraint de som: a tabela pode ter vindo de uma versão
-- anterior desta migration.
alter table public.audio_patch_bindings drop constraint if exists audio_patch_bindings_event_check;
alter table public.audio_patch_bindings
  add constraint audio_patch_bindings_event_check
  check (event ~ '^(card|event|ui):[a-zA-Z0-9][a-zA-Z0-9.-]{0,100}$');

alter table public.audio_patches enable row level security;
alter table public.audio_patch_sounds enable row level security;
alter table public.audio_patch_bindings enable row level security;

-- --- Seed: patch inicial publicado com a biblioteca atual -------------------

insert into public.audio_patches (id, name, status, published_at)
values ('00000000-0000-4000-8000-0000000000a1', 'Initial audio', 'published', now())
on conflict (id) do nothing;

insert into public.audio_patch_sounds (patch_id, sound_id, label, path, category, enabled, sort_order)
select
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  sound ->> 'id',
  sound ->> 'label',
  sound ->> 'path',
  sound ->> 'category',
  true,
  ordinality::integer - 1
from jsonb_array_elements(
  '[
    {"id":"diceA","label":"Dado 1","path":"/sounds/dice/dice-sound-1.mp3","category":"dado"},
    {"id":"diceB","label":"Dado 2","path":"/sounds/dice/dice-sound-2.mp3","category":"dado"},
    {"id":"attackSword","label":"Ataque de espada","path":"/sounds/itens/sword_attack.mp3","category":"item"},
    {"id":"attackPistol","label":"Ataque de pistola","path":"/sounds/itens/pistol_attack.mp3","category":"item"},
    {"id":"attackBlast","label":"Ataque genérico","path":"/sounds/itens/blast_attack_generic.mp3","category":"item"},
    {"id":"shield","label":"Escudo ganho","path":"/sounds/itens/shield_gained_sound.mp3","category":"item"},
    {"id":"haste","label":"Aceleração","path":"/sounds/ui/haste_application.mp3","category":"item"},
    {"id":"heal","label":"Cura","path":"/sounds/ui/healing_sound.mp3","category":"item"},
    {"id":"buy","label":"Compra","path":"/sounds/ui/buy_sound.mp3","category":"ui"},
    {"id":"cardHover","label":"Hover de carta","path":"/sounds/ui/card_hover.mp3","category":"ui"},
    {"id":"cardModal","label":"Modal de carta","path":"/sounds/ui/card_modal_open_and_close.mp3","category":"ui"},
    {"id":"cardPlaced","label":"Carta colocada","path":"/sounds/ui/card_placed.mp3","category":"ui"},
    {"id":"fog","label":"Alerta de névoa","path":"/sounds/ui/fog_alert.mp3","category":"ui"},
    {"id":"login","label":"Login / logout","path":"/sounds/ui/login_or_logout.mp3","category":"ui"},
    {"id":"newBoard","label":"Novo tabuleiro","path":"/sounds/ui/new_board_animation.mp3","category":"ui"},
    {"id":"newCards","label":"Novas cartas","path":"/sounds/ui/new_cards_on_top_table_animation.mp3","category":"ui"},
    {"id":"optionSelected","label":"Opção selecionada","path":"/sounds/ui/option_selected.mp3","category":"ui"},
    {"id":"runDefeated","label":"Run derrotada","path":"/sounds/ui/run_defeated.mp3","category":"ui"},
    {"id":"runWin","label":"Run vencida","path":"/sounds/ui/run_win.mp3","category":"ui"}
  ]'::jsonb
) with ordinality as seeded(sound, ordinality)
on conflict (patch_id, sound_id) do nothing;

-- Só os eventos globais e de interface entram no seed. Cartas não têm binding
-- inicial: o runtime cai no som legado derivado do efeito da carta até o admin
-- configurar algo, o que preserva o comportamento atual após a migration.
insert into public.audio_patch_bindings (patch_id, event, sound_id, volume, min_interval_ms, enabled, sort_order)
select
  '00000000-0000-4000-8000-0000000000a1'::uuid,
  binding ->> 'event',
  binding ->> 'soundId',
  (binding ->> 'volume')::double precision,
  (binding ->> 'minIntervalMs')::integer,
  true,
  ordinality::integer - 1
from jsonb_array_elements(
  '[
    {"event":"event:dice","soundId":"diceA","volume":0.7,"minIntervalMs":0},
    {"event":"event:buy","soundId":"buy","volume":0.7,"minIntervalMs":0},
    {"event":"event:cardPlaced","soundId":"cardPlaced","volume":0.7,"minIntervalMs":0},
    {"event":"event:newBoard","soundId":"newBoard","volume":0.6,"minIntervalMs":0},
    {"event":"event:newCards","soundId":"newCards","volume":0.6,"minIntervalMs":0},
    {"event":"event:cardModal","soundId":"cardModal","volume":0.6,"minIntervalMs":120},
    {"event":"event:optionSelected","soundId":"optionSelected","volume":0.6,"minIntervalMs":60},
    {"event":"event:fog","soundId":"fog","volume":0.8,"minIntervalMs":0},
    {"event":"event:login","soundId":"login","volume":0.6,"minIntervalMs":0},
    {"event":"ui:menu.play","soundId":"optionSelected","volume":0.6,"minIntervalMs":0},
    {"event":"ui:menu.magePick","soundId":"optionSelected","volume":0.6,"minIntervalMs":0},
    {"event":"ui:menu.magos","soundId":"optionSelected","volume":0.5,"minIntervalMs":0},
    {"event":"ui:menu.ranking","soundId":"optionSelected","volume":0.5,"minIntervalMs":0},
    {"event":"ui:menu.ajustes","soundId":"optionSelected","volume":0.5,"minIntervalMs":0},
    {"event":"ui:menu.admin","soundId":"optionSelected","volume":0.5,"minIntervalMs":0},
    {"event":"ui:menu.signOut","soundId":"login","volume":0.6,"minIntervalMs":0},
    {"event":"ui:modal.close","soundId":"cardModal","volume":0.5,"minIntervalMs":150},
    {"event":"ui:modal.magePick","soundId":"optionSelected","volume":0.6,"minIntervalMs":0},
    {"event":"ui:modal.fullscreen","soundId":"optionSelected","volume":0.5,"minIntervalMs":0},
    {"event":"ui:auth.submit","soundId":"login","volume":0.6,"minIntervalMs":0},
    {"event":"ui:auth.switch","soundId":"optionSelected","volume":0.5,"minIntervalMs":0},
    {"event":"ui:settings.slider","soundId":"optionSelected","volume":0.5,"minIntervalMs":200},
    {"event":"ui:board.cardHover","soundId":"cardHover","volume":0.35,"minIntervalMs":220},
    {"event":"ui:board.cardSelect","soundId":"cardHover","volume":0.5,"minIntervalMs":90},
    {"event":"ui:board.place","soundId":"cardPlaced","volume":0.6,"minIntervalMs":0},
    {"event":"ui:shop.buy","soundId":"buy","volume":0.6,"minIntervalMs":0},
    {"event":"ui:shop.open","soundId":"cardHover","volume":0.5,"minIntervalMs":120},
    {"event":"ui:adventure.pick","soundId":"optionSelected","volume":0.6,"minIntervalMs":0},
    {"event":"ui:bot.pick","soundId":"optionSelected","volume":0.6,"minIntervalMs":0},
    {"event":"ui:versus.start","soundId":"newBoard","volume":0.7,"minIntervalMs":0},
    {"event":"ui:admin.tab","soundId":"optionSelected","volume":0.4,"minIntervalMs":150},
    {"event":"ui:admin.save","soundId":"buy","volume":0.6,"minIntervalMs":0},
    {"event":"ui:admin.publish","soundId":"newBoard","volume":0.7,"minIntervalMs":0},
    {"event":"ui:admin.newPatch","soundId":"buy","volume":0.6,"minIntervalMs":0}
  ]'::jsonb
) with ordinality as seeded(binding, ordinality)
on conflict (patch_id, event) do nothing;

-- --- Publicação transacional ------------------------------------------------

create or replace function public.publish_audio_patch(p_patch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.audio_patches
    where id = p_patch_id and status = 'draft'
  ) then
    raise exception 'Only a draft audio patch can be published';
  end if;

  if not exists (
    select 1 from public.audio_patch_sounds
    where patch_id = p_patch_id and enabled
  ) then
    raise exception 'An audio patch must contain at least one enabled sound';
  end if;

  -- A troca é transacional: o patch publicado anterior vira 'archived' e só
  -- então o rascunho assume 'published', respeitando o índice único de um
  -- único patch publicado. Binding apontando para som removido ou desativado
  -- não é validado aqui; o runtime o trata como evento mudo.
  update public.audio_patches
  set status = 'archived'
  where status = 'published';

  update public.audio_patches
  set status = 'published', published_at = now()
  where id = p_patch_id;
end;
$$;

revoke all on function public.publish_audio_patch(uuid) from public, anon, authenticated;
grant execute on function public.publish_audio_patch(uuid) to service_role;
grant all on public.audio_patches, public.audio_patch_sounds, public.audio_patch_bindings to service_role;
