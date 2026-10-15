// Sistema de tiers (níveis) das cartas. O tier é por instância — as definições
// continuam idênticas; o que sobe é a cópia (via merge, roleta ou coringa).
//
// D=BRONZE, C=PRATA, B=OURO, A=DIAMANTE, S=ESMERALDA, SS=OBSIDIANA.
// Subir de tier escala atributos (~+30%/tier) e reduz cooldown (~-8%/tier).

export const MAX_TIER = 5;

export const TIER_KEYS = ["D", "C", "B", "A", "S", "SS"] as const;
export const TIER_NAMES = [
  "BRONZE",
  "PRATA",
  "OURO",
  "DIAMANTE",
  "ESMERALDA",
  "OBSIDIANA",
] as const;

// Cor de acento por tier (usada no modal; o CSS replica nos fundos .tier-*).
export const TIER_ACCENTS = [
  "#cd9b5a", // D bronze
  "#cfd6de", // C prata
  "#f4ce54", // B ouro
  "#7fdcff", // A diamante
  "#55f0a2", // S esmeralda
  "#b388ff", // SS obsidiana
] as const;

export function tierAccent(t: number): string {
  return TIER_ACCENTS[clampTier(t)];
}

export function tierName(t: number): string {
  return TIER_NAMES[clampTier(t)];
}

export function clampTier(t: number): number {
  return Math.max(0, Math.min(MAX_TIER, Math.round(t)));
}

export function tierKey(t: number): string {
  return TIER_KEYS[clampTier(t)];
}

export function tierClass(t: number): string {
  return `tier-${TIER_KEYS[clampTier(t)]}`;
}

// Atributo efetivo (dano/cura/escudo) do tier, só cresce.
export function tierValue(base: number, tier: number): number {
  return Math.max(base, Math.round(base * (1 + 0.3 * clampTier(tier))));
}

// Cooldown em ms ajustado pelo tier (encurta), com piso de 500ms.
export function tierCooldownMs(baseMs: number, tier: number): number {
  return Math.max(500, Math.round(baseMs * (1 - 0.08 * clampTier(tier))));
}

// Cooldown em segundos ajustado pelo tier (para exibição estática).
export function tierCooldownSecs(baseSecs: number, tier: number): number {
  return tierCooldownMs(baseSecs * 1000, tier) / 1000;
}

// Sorteio de tier para a roleta: viés para tiers baixos, raros altos.
export function randomRouletteTier(): number {
  const r = Math.random();
  if (r < 0.34) return 0; // D
  if (r < 0.62) return 1; // C
  if (r < 0.82) return 2; // B
  if (r < 0.93) return 3; // A
  if (r < 0.985) return 4; // S
  return 5; // SS
}
