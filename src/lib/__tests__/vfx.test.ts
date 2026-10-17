// Regressões da configuração de VFX (editor de efeitos, 2026-10).
//
// O config é um patch leve (um JSON publicado). mergeVfxConfig é a fronteira de
// confiança: normaliza/valida/clampa qualquer entrada (inclusive a vinda do
// corpo do POST) antes de valer no jogo.

import { describe, expect, it, afterEach } from "vitest";
import {
  DEFAULT_VFX,
  VFX_LIMITS,
  mergeVfxConfig,
  resolveVfx,
  vfxKeyForStyle,
} from "@/lib/vfx";
import { launchProjectile, useProjectiles } from "@/lib/projectiles";
import type { CardDef } from "@/lib/types";

describe("mergeVfxConfig: valida e clampa", () => {
  it("cai nos padrões quando vazio", () => {
    expect(mergeVfxConfig(null)).toEqual(DEFAULT_VFX);
    expect(mergeVfxConfig({})).toEqual(DEFAULT_VFX);
  });

  it("clampa números fora da faixa", () => {
    const out = mergeVfxConfig({ pistol: { size: 9999, blur: -5, speed: 0 } });
    expect(out.pistol.size).toBe(VFX_LIMITS.size.max);
    expect(out.pistol.blur).toBe(VFX_LIMITS.blur.min);
    expect(out.pistol.speed).toBe(VFX_LIMITS.speed.min);
  });

  it("rejeita cor inválida e motion inválido (mantém o padrão)", () => {
    const out = mergeVfxConfig({ blast: { color: "roxo", motion: "zigzag" as never } });
    expect(out.blast.color).toBe(DEFAULT_VFX.blast.color);
    expect(out.blast.motion).toBe(DEFAULT_VFX.blast.motion);
  });

  it("aceita cor hex e motion válidos", () => {
    const out = mergeVfxConfig({ sword: { color: "#123abc", motion: "arc" } });
    expect(out.sword.color).toBe("#123abc");
    expect(out.sword.motion).toBe("arc");
  });

  it("arredonda o rastro (inteiro)", () => {
    expect(mergeVfxConfig({ blast: { trail: 3.7 } }).blast.trail).toBe(4);
  });

  it("aceita forma válida e rejeita inválida", () => {
    expect(mergeVfxConfig({ pistol: { shape: "diamond" } }).pistol.shape).toBe("diamond");
    expect(mergeVfxConfig({ blast: { shape: "star" } }).blast.shape).toBe("star");
    expect(mergeVfxConfig({ pistol: { shape: "blob" as never } }).pistol.shape).toBe(DEFAULT_VFX.pistol.shape);
  });
});

describe("resolveVfx / vfxKeyForStyle: estilo de ataque → chave de VFX", () => {
  it("mapeia os estilos próprios", () => {
    expect(vfxKeyForStyle("pistol")).toBe("pistol");
    expect(vfxKeyForStyle("sword")).toBe("sword");
    expect(vfxKeyForStyle("blast")).toBe("blast");
  });
  it("estilos sem projétil próprio caem no blast", () => {
    expect(vfxKeyForStyle("heal")).toBe("blast");
    expect(vfxKeyForStyle("shield")).toBe("blast");
    expect(vfxKeyForStyle("haste")).toBe("blast");
  });
  it("resolveVfx devolve o VfxStyle da chave", () => {
    expect(resolveVfx("pistol", DEFAULT_VFX)).toEqual(DEFAULT_VFX.pistol);
  });
});

describe("launchProjectile respeita o config de VFX passado", () => {
  afterEach(() => {
    document.querySelectorAll(".board-owner-badge").forEach((n) => n.remove());
    useProjectiles.setState({ projectiles: [] });
  });

  function def(over: Partial<CardDef> = {}): CardDef {
    return { id: "c", name: "C", kind: "spell", cost: 1, cooldown: 2, effectType: "damage", effectValue: 3, description: "x", ...over };
  }

  it("assa a cor/velocidade do config no projétil e usa a trajetória configurada", () => {
    useProjectiles.setState({ projectiles: [] });
    const opp = document.createElement("div");
    opp.className = "board-owner-badge";
    document.body.appendChild(opp);
    const card = document.createElement("div");
    document.body.appendChild(card);

    // Override: faz a pistola virar uma curva vermelha e lenta.
    const config = mergeVfxConfig({ pistol: { color: "#ff0000", motion: "arc", speed: 999 } });
    launchProjectile(card, "opponent", def({ sound: "pistol" }), config);

    const p = useProjectiles.getState().projectiles[0];
    expect(p.vfx.color).toBe("#ff0000");
    expect(p.motion).toBe("arc");
    expect(p.duration).toBe(999);
    card.remove();
  });
});
