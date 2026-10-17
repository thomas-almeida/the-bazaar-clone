// Regressões dos overrides de apresentação dos magos (2026-10).
//
// mergeMageConfig é a fronteira de confiança (usada no POST e no load): só
// magos conhecidos e caminhos públicos válidos passam. applyOverride overlaia
// retrato/fundo/música sobre o mago do código.

import { describe, expect, it } from "vitest";
import { MAGES, getMage } from "@/lib/mages";
import { mergeMageConfig, applyOverride, mergedMages } from "@/lib/mage-config";

describe("todo mago tem fundo e música", () => {
  it("background e music não vazios", () => {
    for (const m of MAGES) {
      expect(m.background, `${m.name} sem background`).toMatch(/^\/.+\.(mp4|webm)$/i);
      expect(m.music, `${m.name} sem música`).toMatch(/^\/.+\.mp3$/i);
    }
  });
});

describe("mergeMageConfig", () => {
  it("mantém overrides válidos de magos conhecidos", () => {
    const out = mergeMageConfig({ yamato: { portrait: "/x/mago.jpg", music: "/x/som.mp3" } });
    expect(out.yamato).toEqual({ portrait: "/x/mago.jpg", music: "/x/som.mp3" });
  });

  it("descarta magos desconhecidos", () => {
    const out = mergeMageConfig({ fulano: { portrait: "/x.jpg" } });
    expect(out.fulano).toBeUndefined();
  });

  it("descarta caminhos inválidos (sem barra inicial / vazios)", () => {
    const out = mergeMageConfig({ neon: { portrait: "mago.jpg", background: "", music: "/ok.mp3" } });
    expect(out.neon).toEqual({ music: "/ok.mp3" });
  });

  it("vazio quando nada válido", () => {
    expect(mergeMageConfig(null)).toEqual({});
    expect(mergeMageConfig({ neon: { portrait: "relativo.jpg" } })).toEqual({});
  });
});

describe("applyOverride / mergedMages", () => {
  it("overlaia só os campos do override", () => {
    const yamato = getMage("yamato")!;
    const merged = applyOverride(yamato, { yamato: { background: "/novo-fundo.mp4" } });
    expect(merged.background).toBe("/novo-fundo.mp4");
    expect(merged.portrait).toBe(yamato.portrait); // inalterado
    expect(merged.music).toBe(yamato.music);
  });

  it("sem override devolve o mago do código", () => {
    const yamato = getMage("yamato")!;
    expect(applyOverride(yamato, {})).toBe(yamato);
  });

  it("mergedMages aplica a todos", () => {
    const list = mergedMages({ neon: { portrait: "/p.jpg" } });
    expect(list.find((m) => m.id === "neon")!.portrait).toBe("/p.jpg");
    expect(list).toHaveLength(MAGES.length);
  });
});
