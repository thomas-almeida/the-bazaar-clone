// Regressões de exibição do placar.
//
// Bug (2026-10): buildFromSlots devolvia SEMPRE 4 posições. Com `slots` vazio
// (run anterior à coluna, ou gravação que falhou) elas vinham 4 nulas, o guard
// `{build && ...}` era verdadeiro porque um array de 4 nulos é truthy, e a tela
// desenhava uma grade com 4 tracejados vazios embaixo de todo jogador —
// parecendo que a build tinha sumido.
//
// Regra: linha sem build não desenha grade. Linha com build parcial desenha
// os 4 slots, com tracejado nos vazios, porque o tabuleiro tem 4 posições.

import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LeaderboardPage from "../../../app/leaderboard/page";
import type { CardDef, CatalogResponse, SnapshotSlot } from "@/lib/types";

const CARDS: CardDef[] = [
  { id: "dragon-whelp", name: "DRAGON WHELP", kind: "creature", level: 1, cost: 4, cooldown: 4, damage: 2, description: "dragao" },
  { id: "starfall", name: "STARFALL", kind: "spell", cost: 2, cooldown: 2, effectType: "damage", effectValue: 3, description: "estrelas" },
];

const ENTRY = {
  displayName: "ATB Poze",
  mageId: "neon",
  victories: 9,
  completed: true,
  updatedAt: "2026-10-16T00:00:00Z",
};

afterEach(() => {
  vi.restoreAllMocks();
});

function mockApi(slots: (SnapshotSlot | null)[] | undefined) {
  const entry = { ...ENTRY, slots };
  globalThis.fetch = vi.fn(async (url: string) => {
    const body = url.includes("/api/catalog")
      ? ({ cards: CARDS, config: {}, farmBots: [], rivalBuilds: [], version: "x" } as unknown as CatalogResponse)
      : { entries: [entry] };
    return { ok: true, status: 200, json: async () => body } as unknown as Response;
  }) as unknown as typeof fetch;
}

const grade = () => document.querySelector(".leaderboard-build");
const cartas = () => document.querySelectorAll(".leaderboard-build .hand-card");

describe("placar — linha sem build", () => {
  it("não desenha a grade quando slots é array vazio", async () => {
    mockApi([]);
    render(<LeaderboardPage />);
    await screen.findByText("ATB Poze");
    // Bug: aqui apareceria uma grade com 4 tracejados vazios.
    expect(grade()).toBeNull();
  });

  it("não desenha a grade quando slots é 4 nulos", async () => {
    // Foi exatamente o que a rota grava quando a run não tem build.
    mockApi([null, null, null, null]);
    render(<LeaderboardPage />);
    await screen.findByText("ATB Poze");
    expect(grade()).toBeNull();
    expect(cartas()).toHaveLength(0);
  });

  it("a linha continua mostrando jogador, vitórias e status", async () => {
    mockApi([]);
    render(<LeaderboardPage />);
    await screen.findByText("ATB Poze");
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("CONCLUÍDA")).toBeInTheDocument();
  });
});

describe("placar — linha com build", () => {
  it("desenha as 4 posições com o tier de cada uma", async () => {
    mockApi([
      { cardId: "dragon-whelp", tier: 0 },
      null,
      { cardId: "starfall", tier: 3 },
      null,
    ]);
    render(<LeaderboardPage />);
    await screen.findByText("ATB Poze");

    const grid = grade();
    expect(grid).not.toBeNull();
    const lista = cartas();
    expect(lista).toHaveLength(2);
    // tiers aplicados na classe e no selo
    expect(lista[0].className).toContain("tier-D");
    expect(lista[1].className).toContain("tier-A");
    // e os dois slots realmente vazios viram tracejado
    expect(grid!.querySelectorAll(".leaderboard-build-empty")).toHaveLength(2);
  });

  it("usa os valores finais: aplica o reforço do mago do jogador", async () => {
    mockApi([{ cardId: "starfall", tier: 0 }]);
    render(<LeaderboardPage />);
    await screen.findByText("ATB Poze");
    const carta = cartas()[0];
    // NEON (SYDRA) tem especialidade em dano: a cópia mostrada sai reforçada
    // (3 -> 5 pelo boost de 1.5 do mago).
    const stats = carta.querySelector(".card-stats");
    expect(stats?.textContent).toContain("5");
  });

  it("abre o tooltip com o resumo da carta", async () => {
    mockApi([{ cardId: "starfall", tier: 2 }]);
    render(<LeaderboardPage />);
    await screen.findByText("ATB Poze");

    const slot = document.querySelector(".leaderboard-build-slot")!;
    // React deriva onPointerEnter de pointerover.
    fireEvent.pointerOver(slot);

    const tip = document.querySelector(".card-tip");
    expect(tip).not.toBeNull();
    expect(tip!.textContent).toContain("STARFALL");
    // o rodapé é maiúsculo só por CSS (text-transform), o DOM fica em caixa normal
    expect(tip!.textContent).toMatch(/valores finais da run/i);
  });

  it("fecha o tooltip ao sair da carta", async () => {
    mockApi([{ cardId: "starfall", tier: 2 }, null, null, null]);
    render(<LeaderboardPage />);
    await screen.findByText("ATB Poze");

    const slot = document.querySelector(".leaderboard-build-slot")!;
    fireEvent.pointerOver(slot);
    expect(document.querySelector(".card-tip")).not.toBeNull();
    fireEvent.pointerOut(slot, { relatedTarget: document.body });
    expect(document.querySelector(".card-tip")).toBeNull();
  });
});
