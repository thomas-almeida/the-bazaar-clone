import { normalizePublicPath } from "@/lib/public-path";
import type { Art, CardDef } from "@/lib/types";

const KINDS = ["creature", "spell", "equipment"];
const EFFECTS = ["damage", "healing", "shield"];
const SOUNDS = ["sword", "pistol", "blast", "heal", "shield", "haste"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Gera um id de carta a partir do nome: minúsculas, sem acentos, só
 * `[a-z0-9-]` (constraint do banco). Devolve "" quando não sobra nada válido.
 */
export function slugifyCardId(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // tudo que não é alfanumérico vira hífen
    .replace(/^-+|-+$/g, "") // sem hífens nas pontas
    .slice(0, 60);
}

function normalizeArtSource(src: string): string | null {
  return normalizePublicPath(src);
}

function validArt(value: unknown): value is Art {
  if (!isRecord(value) || (value.kind !== "image" && value.kind !== "video")) return false;
  if (typeof value.src !== "string" || value.src.length > 2048) return false;
  return normalizeArtSource(value.src) !== null &&
    (value.poster === undefined ||
      (typeof value.poster === "string" && value.poster.length <= 2048 && normalizeArtSource(value.poster) !== null));
}

export function normalizeCardArt(definition: CardDef): CardDef {
  if (!definition.art) return definition;
  const src = normalizeArtSource(definition.art.src);
  const poster = definition.art.poster === undefined ? undefined : normalizeArtSource(definition.art.poster);
  if (!src || (definition.art.poster !== undefined && !poster)) {
    throw new Error("Card art path is invalid.");
  }
  return {
    ...definition,
    art: {
      ...definition.art,
      src,
      ...(poster ? { poster } : {}),
    },
  };
}

export function parseCardDefinition(value: unknown): CardDef {
  if (!isRecord(value) || typeof value.id !== "string" || !isCardDefinition(value, value.id)) {
    throw new Error("A stored card definition is invalid.");
  }
  return normalizeCardArt(value);
}

export function isCardDefinition(value: unknown, expectedId: string): value is CardDef {
  if (!isRecord(value)) return false;
  if (value.id !== expectedId || !/^[a-z0-9-]+$/.test(expectedId)) return false;
  if (typeof value.name !== "string" || value.name.trim().length < 1 || value.name.length > 80) return false;
  if (!KINDS.includes(String(value.kind))) return false;
  if (typeof value.description !== "string" || value.description.length > 2000) return false;
  if (typeof value.cost !== "number" || !Number.isFinite(value.cost) || value.cost < 0 || value.cost > 999) return false;
  if (typeof value.cooldown !== "number" || !Number.isFinite(value.cooldown) || value.cooldown < 0 || value.cooldown > 999) return false;
  if (value.enabled !== undefined && typeof value.enabled !== "boolean") return false;
  if (value.piece !== undefined && typeof value.piece !== "boolean") return false;
  if (value.art !== undefined && !validArt(value.art)) return false;

  for (const key of ["level", "damage", "effectValue", "valueHaste", "cooldownHaste", "bleed"]) {
    if (value[key] !== undefined && (
      typeof value[key] !== "number" ||
      !Number.isFinite(value[key]) ||
      value[key] < 0 ||
      value[key] > 999
    )) return false;
  }
  if (value.effectType !== undefined && !EFFECTS.includes(String(value.effectType))) return false;
  if (value.sound !== undefined && !SOUNDS.includes(String(value.sound))) return false;
  if (value.target !== undefined && value.target !== "self" && value.target !== "enemy") return false;
  if (value.synergy !== undefined) {
    const synergy = value.synergy;
    if (
      !isRecord(synergy) ||
      !["left", "right", "both"].includes(String(synergy.dir)) ||
      typeof synergy.label !== "string" ||
      synergy.label.length > 200 ||
      (synergy.requires !== undefined &&
        !["creature", "spell", "equipment", "damage", "healing", "shield"].includes(String(synergy.requires)))
    ) return false;
    for (const key of ["bonusValue", "cooldownMult"]) {
      if (synergy[key] !== undefined && (typeof synergy[key] !== "number" || !Number.isFinite(synergy[key]))) return false;
    }
  }
  return true;
}
