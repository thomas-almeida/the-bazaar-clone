import type { Art, CardDef } from "@/lib/types";

const KINDS = ["creature", "spell", "equipment"];
const EFFECTS = ["damage", "healing", "shield"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validArt(value: unknown): value is Art {
  if (!isRecord(value) || (value.kind !== "image" && value.kind !== "video")) return false;
  if (typeof value.src !== "string" || value.src.length > 2048) return false;
  const validSource = (src: string) => {
    if (src.startsWith("/card-art/")) return true;
    try {
      return new URL(src).protocol === "https:";
    } catch {
      return false;
    }
  };
  return validSource(value.src) && (value.poster === undefined || (typeof value.poster === "string" && validSource(value.poster)));
}

export function parseCardDefinition(value: unknown): CardDef {
  if (!isRecord(value) || typeof value.id !== "string" || !isCardDefinition(value, value.id)) {
    throw new Error("A stored card definition is invalid.");
  }
  return value;
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
  if (value.art !== undefined && !validArt(value.art)) return false;

  for (const key of ["level", "damage", "effectValue", "valueHaste", "cooldownHaste"]) {
    if (value[key] !== undefined && (
      typeof value[key] !== "number" ||
      !Number.isFinite(value[key]) ||
      value[key] < 0 ||
      value[key] > 999
    )) return false;
  }
  if (value.effectType !== undefined && !EFFECTS.includes(String(value.effectType))) return false;
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
