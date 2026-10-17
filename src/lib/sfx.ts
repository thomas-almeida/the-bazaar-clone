"use client";

// Camada de áudio do jogo: configuração publicada + reprodução de efeitos.
//
// O que mudou em relação à versão anterior (o catálogo de sons era fixo em
// código e alguns efeitos "não tocavam"):
//
// 1. Sons, volumes, gatilhos e limites vêm de GET /api/audio (patch publicado
//    no Supabase). Sem a config carregada, vale a biblioteca local padrão.
// 2. Pool de 4 elementos por arquivo, em round-robin, reaproveitando o mesmo
//    HTMLAudioElement. A versão anterior clonava o elemento a cada disparo,
//    criando players concorrentes que competiam pelo mesmo download — era a
//    causa de "às vezes o som não toca" em rajada.
// 3. Autoplay: o desbloqueio acontece no primeiro gesto real do usuário e é
//    aplicado a todos os elementos. Antes, `play().catch(() => {})` engolia o
//    NotAllowedError e o efeito sumia sem nenhum aviso.
// 4. Volume por evento (mixagem relativa) multiplicado pelo slider de efeitos.
// 5. Intervalo mínimo por evento: cartas com haste e hovers não empilham mais.

import { create } from "zustand";
import {
  AUDIO_EVENTS,
  buildDefaultAudioConfig,
  cardEvent,
  legacyCardSoundId,
  parseEvent,
  type AudioBinding,
  type AudioConfigResponse,
  type SoundDef,
} from "./audio";
import type { CardDef } from "./types";

// --- Configuração publicada -------------------------------------------------

interface AudioConfigState {
  config: AudioConfigResponse | null;
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export const useAudioConfig = create<AudioConfigState>((set, getState) => {
  const fetchConfig = async () => {
    set({ loading: true, error: null });
    try {
      const response = await fetch("/api/audio", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? `Erro ${response.status}`);
      set({ config: body as AudioConfigResponse, loading: false, error: null });
    } catch (reason) {
      // Segue com a biblioteca local: áudio não deve derrubar a página.
      set({
        config: buildDefaultAudioConfig(),
        loading: false,
        error: reason instanceof Error ? reason.message : "Falha ao carregar a configuração de áudio.",
      });
    }
  };
  return {
    config: null,
    loading: false,
    error: null,
    load: async () => {
      if (getState().config || getState().loading) return;
      await fetchConfig();
    },
    refresh: fetchConfig,
    reset: () => set({ config: null, error: null }),
  };
});

// --- Configurações de volume do jogador (persistidas) -----------------------

const MUSIC_KEY = "maggi.musicVolume";
const SFX_KEY = "maggi.sfxVolume";

function readStored(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    /* ignora (modo privado etc.) */
  }
}

interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export const useAudioSettings = create<AudioSettings>((set) => ({
  // Default determinístico no SSR; o valor real do localStorage entra no cliente.
  musicVolume: readStored(MUSIC_KEY, 0.55),
  sfxVolume: readStored(SFX_KEY, 0.7),
  setMusicVolume: (v) => {
    const value = clamp01(v);
    writeStored(MUSIC_KEY, value);
    set({ musicVolume: value });
  },
  setSfxVolume: (v) => {
    const value = clamp01(v);
    writeStored(SFX_KEY, value);
    set({ sfxVolume: value });
  },
}));

// --- Resolução de evento ----------------------------------------------------

export interface ResolvedSound {
  soundId: string;
  path: string;
  /** Volume final: mixagem do admin × slider de efeitos do jogador. */
  volume: number;
  minIntervalMs: number;
  /** Verdadeiro quando o som veio do padrão herdado e não de um binding salvo. */
  inherited: boolean;
  /** Canal exclusivo: tocar nele corta o que já tocava no mesmo canal. */
  channel?: string;
}

const EVENT_SPECS = new Map(AUDIO_EVENTS.map((spec) => [spec.event, spec]));
/** Cartas sem binding salvo usam o som legado derivado do efeito. */
export const DEFAULT_CARD_VOLUME = 0.55;
export const DEFAULT_CARD_MIN_INTERVAL_MS = 120;

function activeSounds(): Map<string, SoundDef> {
  const config = useAudioConfig.getState().config;
  if (config) {
    const map = new Map<string, SoundDef>();
    for (const sound of config.sounds) if (sound.enabled !== false) map.set(sound.id, sound);
    return map;
  }
  const fallback = buildDefaultAudioConfig();
  return new Map(fallback.sounds.map((sound) => [sound.id, sound]));
}

function bindings(): Map<string, AudioBinding> {
  const config = useAudioConfig.getState().config;
  return new Map((config?.bindings ?? []).map((binding) => [binding.event, binding]));
}

function defaultBindingFor(event: string): AudioBinding | null {
  const spec = EVENT_SPECS.get(event);
  if (!spec) return null;
  return {
    event,
    soundId: spec.defaultSoundId,
    volume: spec.defaultVolume,
    minIntervalMs: spec.defaultMinIntervalMs,
    enabled: true,
  };
}

/** Como o evento `card:<id>` cai quando não há binding salvo. */
export function inheritedCardBinding(def: CardDef): AudioBinding {
  return {
    event: cardEvent(def.id),
    soundId: legacyCardSoundId(def),
    volume: DEFAULT_CARD_VOLUME,
    minIntervalMs: DEFAULT_CARD_MIN_INTERVAL_MS,
    enabled: true,
  };
}

function finalize(binding: AudioBinding | null | undefined, inherited: boolean): ResolvedSound | null {
  if (!binding || binding.enabled === false || !binding.soundId) return null;
  const sound = activeSounds().get(binding.soundId);
  if (!sound) return null;
  const volume = clamp01(binding.volume) * clamp01(useAudioSettings.getState().sfxVolume);
  if (volume <= 0) return null;
  return {
    soundId: binding.soundId,
    path: sound.path,
    volume,
    minIntervalMs: Math.max(0, binding.minIntervalMs || 0),
    inherited,
  };
}

/** Resolve um evento nomeado ("event:fog", "ui:menu.play"). */
export function resolveEvent(event: string): ResolvedSound | null {
  const saved = bindings().get(event);
  if (saved) return finalize(saved, false);
  return finalize(defaultBindingFor(event), true);
}

/** Resolve o som de uma carta: binding salvo tem prioridade sobre o efeito. */
export function resolveCardSound(def: CardDef, cardId?: string): ResolvedSound | null {
  const event = cardEvent(cardId ?? def.id);
  const saved = bindings().get(event);
  if (saved) return finalize(saved, false);
  return finalize(inheritedCardBinding(def), true);
}

// --- Reprodução -------------------------------------------------------------

const POOL_SIZE = 4;
const pools = new Map<string, HTMLAudioElement[]>();
const cursors = new Map<string, number>();
const lastPlayedAt = new Map<string, number>();
const warmed = new WeakSet<HTMLAudioElement>();

/**
 * Canais exclusivos. Sons de categories que não podem se sobrepor — a voz do
 * mago, por exemplo — declaram um canal: tocar no canal corta o que já estava
 * tocando nele. Efeitos de combate ficam fora, porque aí a sobreposição é
 * desejada (várias cartas disparando no mesmo frame).
 */
const channels = new Map<string, Set<string>>();

/** Interrompe o que estiver tocando no canal. */
export function stopChannel(channel: string): void {
  const keys = channels.get(channel);
  if (!keys) return;
  for (const key of keys) {
    for (const node of pools.get(key) ?? []) {
      node.pause();
      node.currentTime = 0;
    }
  }
  channels.delete(channel);
}

let unlocked = false;
let warnedBlocked = false;

function poolFor(key: string, src: string): HTMLAudioElement[] {
  let pool = pools.get(key);
  if (!pool) {
    pool = Array.from({ length: POOL_SIZE }, () => {
      const node = new Audio(src);
      node.preload = "auto";
      return node;
    });
    pools.set(key, pool);
  }
  return pool;
}

// Destrava um elemento específico. Chrome/Firefox liberam a página inteira
// após o primeiro gesto; no Safari cada elemento precisa ter sido tocado uma
// vez durante uma interação.
function warm(node: HTMLAudioElement) {
  if (warmed.has(node) || !unlocked) return;
  warmed.add(node);
  try {
    const previous = node.volume;
    node.volume = 0;
    const attempt = node.play();
    node.pause();
    node.currentTime = 0;
    node.volume = previous;
    attempt?.catch(() => {});
  } catch {
    warmed.delete(node);
  }
}

function emit(resolved: ResolvedSound, options?: { ignoreInterval?: boolean }) {
  if (typeof window === "undefined") return;
  if (!options?.ignoreInterval && resolved.minIntervalMs > 0) {
    const now = performance.now();
    const previous = lastPlayedAt.get(resolved.soundId) ?? -Infinity;
    if (now - previous < resolved.minIntervalMs) return;
    lastPlayedAt.set(resolved.soundId, now);
  }
  if (!unlocked) {
    if (!warnedBlocked && process.env.NODE_ENV === "development") {
      warnedBlocked = true;
      console.info("[sfx] Áudio bloqueado até o primeiro clique/tecla do jogador.");
    }
    return;
  }

  // A chave inclui o caminho: se o admin trocar o arquivo no patch, o pool
  // antigo é ignorado em vez de continuar tocando o arquivo anterior.
  const key = `${resolved.channel ?? resolved.soundId}|${resolved.path}`;
  if (resolved.channel) {
    const bucket = channels.get(resolved.channel) ?? new Set<string>();
    bucket.add(key);
    channels.set(resolved.channel, bucket);
  }
  const pool = poolFor(key, resolved.path);
  const index = (cursors.get(key) ?? 0) % pool.length;
  cursors.set(key, index + 1);
  const node = pool[index];
  warm(node);
  try {
    node.currentTime = 0;
    node.volume = resolved.volume;
    const attempt = node.play();
    attempt?.catch((error: unknown) => {
      // Um play interrompido (troca de aba, gesto concorrente) não é falha de
      // verdade; só o bloqueio por autoplay nos faz reexigir o destravamento.
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        unlocked = false;
      }
    });
  } catch {
    /* arquivo ausente ou ambiente sem áudio: segue sem som */
  }
}

/**
 * Executa `fn` agora, ou guarda para rodar assim que o áudio destravar.
 *
 * A fala de abertura do menu acontece no mount, antes de qualquer gesto — e o
 * navegador bloqueia `play()` até lá. Sem adiar, ela se perderia justamente na
 * primeira visita. `maxAgeMs` evita que uma saudação toque muito depois, num
 * clique sem relação.
 */
const deferred = new Map<string, { fn: () => void; at: number }>();
const DEFER_MAX_AGE_MS = 10000;

export function playOrDefer(id: string, fn: () => void): boolean {
  if (unlocked) {
    fn();
    return true;
  }
  // Uma fala pendente por chave: repetir a mesma não enfileira duas vezes.
  deferred.set(id, { fn, at: performance.now() });
  return false;
}

function flushDeferred() {
  const now = performance.now();
  for (const [id, item] of [...deferred]) {
    if (now - item.at > DEFER_MAX_AGE_MS) {
      deferred.delete(id);
      continue;
    }
    deferred.delete(id);
    item.fn();
  }
}

/** Deve ser chamado dentro de um gesto real do usuário. */
export function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  warnedBlocked = false;
  for (const pool of pools.values()) for (const node of pool) warm(node);
  flushDeferred();
}

export function isAudioUnlocked(): boolean {
  return unlocked;
}

export interface PlayOptions {
  /** Toca ignorando o intervalo mínimo — usado em preview e teste. */
  ignoreInterval?: boolean;
}

/** Toca um evento nomeado da configuração. */
export function playEvent(event: string, options?: PlayOptions) {
  const resolved = resolveEvent(event);
  if (resolved) emit(resolved, options);
  return resolved;
}

/** Toca o som da carta no disparo do cooldown. */
export function playCardSound(def: CardDef, cardId?: string) {
  const resolved = resolveCardSound(def, cardId);
  if (resolved) emit(resolved);
  return resolved;
}

/** Toca um arquivo da biblioteca diretamente, ignorando bindings e intervalos. */
export function previewSound(soundId: string, volume = 1) {
  const sound = activeSounds().get(soundId);
  if (!sound) return false;
  emit(
    {
      soundId,
      path: sound.path,
      volume: clamp01(volume) * clamp01(useAudioSettings.getState().sfxVolume),
      minIntervalMs: 0,
      inherited: false,
    },
    { ignoreInterval: true },
  );
  return true;
}

/**
 * Toca um binding exatamente como ele está no rascunho do painel, sem passar
 * pela configuração publicada. É o que o botão TESTAR usa: o que se ouve é o
 * que a linha mostra. Resolve também o caso das cartas, cujo binding só existe
 * no rascunho — `playEvent` procuraria a chave `card:<id>` no patch publicado e
 * não acharia nada.
 */
export function previewBinding(binding: AudioBinding): boolean {
  if (!binding.soundId || binding.volume <= 0) return false;
  return previewSound(binding.soundId, binding.volume);
}

/**
 * Toca um arquivo por caminho, sem passar pela biblioteca nem por bindings.
 * Usado pelas falas dos magos, que não são eventos do patch de áudio. Vai pelo
 * mesmo `emit`, então o pool, o destravamento e o slider do jogador valem igual.
 */
export function playPath(
  id: string,
  path: string,
  volume = 1,
  options?: { channel?: string },
): boolean {
  if (typeof window === "undefined") return false;
  const finalVolume = clamp01(volume) * clamp01(useAudioSettings.getState().sfxVolume);
  if (finalVolume <= 0) return false;
  // O canal corta o que ainda tocava ANTES de entrar a fala nova.
  if (options?.channel) stopChannel(options.channel);
  emit(
    {
      soundId: id,
      path,
      volume: finalVolume,
      minIntervalMs: 0,
      inherited: false,
      channel: options?.channel,
    },
    { ignoreInterval: true },
  );
  return true;
}

/** Zera pools e contadores — usado quando o patch de áudio muda em runtime. */
export function resetAudioPools() {
  for (const pool of pools.values()) for (const node of pool) node.pause();
  pools.clear();
  cursors.clear();
  lastPlayedAt.clear();
  channels.clear();
}

/** Rótulo legível de um evento, para o painel e para mensagens de erro. */
export function describeEvent(event: string): string {
  const spec = EVENT_SPECS.get(event);
  if (spec) return `${spec.group} · ${spec.label}`;
  const parsed = parseEvent(event);
  if (parsed?.scope === "card") return `Carta · ${parsed.name}`;
  return event;
}
