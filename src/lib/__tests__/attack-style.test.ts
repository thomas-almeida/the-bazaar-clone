// Regressões dos estilos/trajetórias de ataque (2026-10).
//
// Antes havia um único projétil para todos os ataques. Agora cada estilo
// (pistol/blast/sword...) tem seu movimento: tiro reto, projétil em curva ou
// corte melee na badge. O estilo deriva do mesmo campo que define o som
// (`def.sound`), com o mesmo fallback de `legacyCardSoundId`, para que som e
// animação combinem.

import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { attackStyle, attackMotion } from "@/lib/attack-style";
import { useProjectiles, launchProjectile, healBadge } from "@/lib/projectiles";
import type { CardDef } from "@/lib/types";

const CSS = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf-8");

function def(over: Partial<CardDef> = {}): CardDef {
  return {
    id: "c",
    name: "C",
    kind: "spell",
    cost: 1,
    cooldown: 2,
    effectType: "damage",
    effectValue: 3,
    description: "x",
    ...over,
  };
}

describe("attackStyle: deriva do som/efeito", () => {
  it("prioriza o campo explícito def.sound", () => {
    expect(attackStyle(def({ sound: "pistol" }))).toBe("pistol");
    expect(attackStyle(def({ sound: "sword", effectType: "damage" }))).toBe("sword");
  });

  it("cai para o efeito quando não há sound", () => {
    expect(attackStyle(def({ effectType: "healing" }))).toBe("heal");
    expect(attackStyle(def({ effectType: "shield" }))).toBe("shield");
  });

  it("equipamento sem sound é haste (categoria aceleração)", () => {
    expect(attackStyle(def({ kind: "equipment", effectType: undefined }))).toBe("haste");
  });

  it("dano genérico sem sound é blast", () => {
    expect(attackStyle(def({ effectType: "damage" }))).toBe("blast");
  });
});

describe("attackMotion: estilo → trajetória", () => {
  it("pistola é tiro reto", () => expect(attackMotion("pistol")).toBe("shot"));
  it("espada é melee", () => expect(attackMotion("sword")).toBe("melee"));
  it("blast é curva", () => expect(attackMotion("blast")).toBe("arc"));
  it("estilos sem projétil próprio caem na curva", () => {
    expect(attackMotion("heal")).toBe("arc");
    expect(attackMotion("shield")).toBe("arc");
    expect(attackMotion("haste")).toBe("arc");
  });
});

describe("launchProjectile: cria o projétil com estilo/motion certos", () => {
  beforeEach(() => {
    useProjectiles.setState({ projectiles: [] });
    const player = document.createElement("div");
    player.className = "board-owner-badge board-player-badge";
    const opp = document.createElement("div");
    opp.className = "board-owner-badge";
    document.body.append(player, opp);
  });
  afterEach(() => {
    document.querySelectorAll(".board-owner-badge").forEach((n) => n.remove());
    useProjectiles.setState({ projectiles: [] });
  });

  it("pistola vira um tiro (shot) que viaja da carta até a badge", () => {
    const card = document.createElement("div");
    document.body.appendChild(card);
    launchProjectile(card, "opponent", def({ sound: "pistol" }));
    const p = useProjectiles.getState().projectiles[0];
    expect(p.motion).toBe("shot");
    expect(p.style).toBe("pistol");
    expect(p.targetSide).toBe("opponent");
    card.remove();
  });

  it("espada vira melee: nasce na própria badge (sem trajetória)", () => {
    const card = document.createElement("div");
    document.body.appendChild(card);
    launchProjectile(card, "player", def({ sound: "sword" }));
    const p = useProjectiles.getState().projectiles[0];
    expect(p.motion).toBe("melee");
    // Sem trajetória: origem e destino coincidem.
    expect(p.x0).toBe(p.x1);
    expect(p.y0).toBe(p.y1);
    card.remove();
  });

  it("não cria projétil se a badge alvo não existir", () => {
    document.querySelectorAll(".board-owner-badge").forEach((n) => n.remove());
    const card = document.createElement("div");
    document.body.appendChild(card);
    launchProjectile(card, "opponent", def({ sound: "pistol" }));
    expect(useProjectiles.getState().projectiles).toHaveLength(0);
    card.remove();
  });
});

describe("CSS: projétil dirigido por variáveis e cura pisca verde", () => {
  it("o orbe/feixe/rastro leem cor, tamanho e espessura das variáveis --vfx-*", () => {
    // O editor de VFX controla tudo por variáveis; o CSS não fixa mais cores.
    expect(CSS).toMatch(/\.projectile-orb\s*\{[^}]*var\(--vfx-size/);
    expect(CSS).toMatch(/\.projectile-orb\s*\{[^}]*var\(--vfx-color/);
    expect(CSS).toMatch(/\.projectile-beam\s*\{[^}]*var\(--vfx-thickness/);
    expect(CSS).toMatch(/\.projectile-trail\s*\{[^}]*var\(--vfx-color/);
  });

  it("o corte melee existe e não arrasta rastro de orbe", () => {
    expect(CSS).toMatch(/\.projectile-orb--melee\s*\{/);
    expect(CSS).toMatch(/\.projectile-orb--melee::after\s*\{\s*content:\s*none/);
  });

  it("a badge curada pisca em verde com blur", () => {
    expect(CSS).toMatch(/\.board-owner-badge\.is-healed\b/);
    expect(CSS).toMatch(/@keyframes badge-heal-flash/);
    // O glow verde usa blur.
    expect(CSS).toMatch(/\.board-owner-badge\.is-healed::after\s*\{[^}]*filter:\s*blur/);
  });
});

describe("healBadge: pisca a badge do lado curado", () => {
  afterEach(() => {
    document.querySelectorAll(".board-owner-badge").forEach((n) => n.remove());
  });

  it("marca .is-healed na badge do lado", () => {
    const player = document.createElement("div");
    player.className = "board-owner-badge board-player-badge";
    document.body.appendChild(player);
    healBadge("player");
    expect(player.classList.contains("is-healed")).toBe(true);
  });
});
