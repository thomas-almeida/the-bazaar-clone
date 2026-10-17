import { normalizePublicPath } from "@/lib/public-path";
import type { AudioBinding, SoundCategory, SoundDef } from "@/lib/audio";

const CATEGORIES: SoundCategory[] = ["dado", "item", "ui"];
// O id do som preserva o camelCase da biblioteca (diceA, attackSword,
// cardHover...), e o evento aceita o formato real das chaves, com ponto e
// maiúsculas depois do escopo (ui:board.cardSelect, ui:menu.magePick...).
const EVENT_PATTERN = /^(card|event|ui):[a-zA-Z0-9][a-zA-Z0-9.-]{0,100}$/;
const ID_PATTERN = /^[a-zA-Z0-9-]+$/;
const MAX_VOLUME = 1;
const MAX_INTERVAL_MS = 60000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Valida a definição de um som gravada no patch. `expectedId` amarra o id do
 * path da rota ao id do corpo, como o editor de cartas faz.
 */
export function isSoundDefinition(value: unknown, expectedId: string): value is SoundDef {
  if (!isRecord(value)) return false;
  if (value.id !== expectedId || !ID_PATTERN.test(expectedId)) return false;
  if (typeof value.label !== "string" || value.label.trim().length < 1 || value.label.length > 80) return false;
  if (typeof value.path !== "string" || value.path.length > 2048) return false;
  if (!(CATEGORIES as string[]).includes(String(value.category))) return false;
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") return false;
  return normalizePublicPath(value.path) !== null;
}

export function normalizeSoundDefinition(definition: SoundDef): SoundDef {
  const path = normalizePublicPath(definition.path);
  if (!path) throw new Error("Sound path is invalid.");
  return { ...definition, path };
}

/** Valida um binding. `soundId` null é válido (evento silencioso). */
export function isAudioBinding(value: unknown): value is AudioBinding {
  if (!isRecord(value)) return false;
  if (typeof value.event !== "string" || !EVENT_PATTERN.test(value.event)) return false;
  if (value.soundId !== null && (typeof value.soundId !== "string" || !ID_PATTERN.test(value.soundId))) {
    return false;
  }
  if (
    typeof value.volume !== "number" ||
    !Number.isFinite(value.volume) ||
    value.volume < 0 ||
    value.volume > MAX_VOLUME
  ) return false;
  if (
    typeof value.minIntervalMs !== "number" ||
    !Number.isFinite(value.minIntervalMs) ||
    !Number.isInteger(value.minIntervalMs) ||
    value.minIntervalMs < 0 ||
    value.minIntervalMs > MAX_INTERVAL_MS
  ) return false;
  if (typeof value.enabled !== "boolean") return false;
  return true;
}

/** Percentual -> [0,1] com clamp, para os sliders do admin. */
export function clampVolume(volume: number): number {
  return Math.min(MAX_VOLUME, Math.max(0, volume));
}

export function clampInterval(interval: number): number {
  return Math.min(MAX_INTERVAL_MS, Math.max(0, Math.round(interval)));
}
