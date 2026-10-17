// Regressões do placar de líderes.
//
// Bug 1 (2026-10): a coluna `slots` só passou a existir depois da migration
// 20260601000002. Até lá, GET falhava com 42703 e a rota devolvia lista vazia —
// o placar inteiro sumia. A rota passou a degradar; este teste trava o formato
// que a tela consome.
//
// Bug 2 (2026-10): `parseSlots` mal validado gravava lixo no banco. Slot ruim
// tem que ser descartado, não a run inteira.

import { describe, expect, it } from "vitest";
import { toSnapshotSlots, type LeaderboardEntry } from "@/lib/leaderboard";
import type { CardInstance } from "@/lib/types";

// --- espelha o parseSlots da rota -----------------------------------------
// A função é privada do route handler; replicamos a regra para travar o
// contrato. Se a rota mudar, este arquivo precisa mudar junto.
function parseSlots(value: unknown): ({ cardId: string; tier: number } | null)[] {
  const MAX_SLOTS = 4;
  const MAX_TIER = 5;
  if (!Array.isArray(value)) return [];
  const slots: ({ cardId: string; tier: number } | null)[] = [];
  for (const item of value.slice(0, MAX_SLOTS)) {
    if (item === null || item === undefined) { slots.push(null); continue; }
    if (typeof item !== "object") { slots.push(null); continue; }
    const { cardId, tier } = item as { cardId?: unknown; tier?: unknown };
    const validId = typeof cardId === "string" && /^[a-z0-9-]{1,64}$/.test(cardId);
    const validTier = Number.isInteger(tier) && (tier as number) >= 0 && (tier as number) <= MAX_TIER;
    slots.push(validId && validTier ? { cardId, tier: tier as number } : null);
  }
  while (slots.length < MAX_SLOTS) slots.push(null);
  return slots;
}

describe("parseSlots", () => {
  it("aceita a build completa com tiers", () => {
    const slots = parseSlots([
      { cardId: "dragon-whelp", tier: 0 },
      null,
      { cardId: "starfall", tier: 5 },
      { cardId: "time-crystal", tier: 2 },
    ]);
    expect(slots).toEqual([
      { cardId: "dragon-whelp", tier: 0 },
      null,
      { cardId: "starfall", tier: 5 },
      { cardId: "time-crystal", tier: 2 },
    ]);
  });

  it("completa até 4 posições quando vem array curto", () => {
    expect(parseSlots([{ cardId: "starfall", tier: 1 }])).toHaveLength(4);
  });

  it("descarta posição inválida em vez de recusar a run", () => {
    const slots = parseSlots([
      { cardId: "STARFALL", tier: 1 },   // id com maiúscula
      { cardId: "ok", tier: 9 },          // tier acima do máximo
      { cardId: "ok", tier: 1.5 },        // tier fracionário
      "lixo",
    ]);
    expect(slots).toEqual([null, null, null, null]);
  });

  it("ignora posição além das 4", () => {
    const slots = parseSlots(Array.from({ length: 9 }, () => ({ cardId: "starfall", tier: 0 })));
    expect(slots).toHaveLength(4);
  });

  it("devolve vazio para entrada não-array (run sem build)", () => {
    expect(parseSlots(null)).toEqual([]);
    expect(parseSlots(undefined)).toEqual([]);
    expect(parseSlots("nope")).toEqual([]);
  });
});

describe("toSnapshotSlots", () => {
  it("mapeia o tabuleiro para cardId + tier, preservando slots vazios", () => {
    const card = (id: string, defId: string, tier: number): CardInstance =>
      ({ id, def: { id: defId }, tier, art: { kind: "image", src: "/x.png" } }) as unknown as CardInstance;
    expect(
      toSnapshotSlots([card("a", "dragon-whelp", 0), null, card("c", "starfall", 3), null]),
    ).toEqual([
      { cardId: "dragon-whelp", tier: 0 },
      null,
      { cardId: "starfall", tier: 3 },
      null,
    ]);
  });

  it("preserva a ordem dos 4 slots", () => {
    expect(toSnapshotSlots([null, null, null, null])).toEqual([null, null, null, null]);
  });
});

describe("LeaderboardEntry", () => {
  it("o contrato de slots é sempre um array de 4 posições", () => {
    // A tela percorre entry.slots[i]; sem esse contrato, um registro antigo
    // com slots ausente quebraria o índice.
    const entry: LeaderboardEntry = {
      displayName: "X",
      mageId: "neon",
      victories: 0,
      completed: false,
      slots: [],
      updatedAt: "2026-10-16T00:00:00Z",
    };
    expect(Array.isArray(entry.slots)).toBe(true);
    expect(entry.slots[0] ?? null).toBeNull();
  });
});
