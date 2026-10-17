// Regressões de validação de áudio.
//
// Bug 1 (2026-10): o regex de sound_id era ^[a-z0-9-]+$, herdado das cartas.
// A biblioteca usa camelCase (diceA, attackSword, cardHover), então a migration
// falhou ao inserir os 19 sons e a aba de Sons nunca abriu.
//
// Bug 2 (2026-10): o regex de evento também era minúsculo e sem ponto, então
// rejeitava chaves reais como "ui:board.cardSelect" e TODO binding de interface
// voltaria 400 ao salvar — só apareceria depois da migration passar.

import { describe, expect, it } from "vitest";
import { isAudioBinding, isSoundDefinition } from "@/lib/admin-audio";
import { AUDIO_EVENTS, DEFAULT_SOUNDS, cardEvent, parseEvent } from "@/lib/audio";

describe("isSoundDefinition", () => {
  it("aceita os ids camelCase da biblioteca real", () => {
    for (const sound of DEFAULT_SOUNDS) {
      expect(isSoundDefinition(sound, sound.id), sound.id).toBe(true);
    }
  });

  it("aceita os caminhos publicados em /public", () => {
    expect(isSoundDefinition({ id: "x1", label: "X", path: "/sounds/ui/buy_sound.mp3", category: "ui" }, "x1")).toBe(true);
  });

  it("rejeita traversal e caminho não servido", () => {
    const base = { label: "X", category: "ui" as const };
    expect(isSoundDefinition({ ...base, id: "x1", path: "/sounds/../../etc/passwd" }, "x1")).toBe(false);
    expect(isSoundDefinition({ ...base, id: "x1", path: "C:/segredo/x.mp3" }, "x1")).toBe(false);
    expect(isSoundDefinition({ ...base, id: "x1", path: "" }, "x1")).toBe(false);
  });

  it("amarra o id do corpo ao id do path da rota", () => {
    const def = { id: "outro", label: "X", path: "/sounds/a.mp3", category: "ui" as const };
    expect(isSoundDefinition(def, "x1")).toBe(false);
  });
});

describe("isAudioBinding", () => {
  it("aceita TODAS as chaves do registro de eventos", () => {
    // Este é o teste que teria pegado o bug 2 antes da migration rodar.
    // Monta um binding a partir do default de cada spec — espalhar o spec
    // inteiro não serve, porque ele não tem `enabled`.
    for (const spec of AUDIO_EVENTS) {
      const binding = {
        event: spec.event,
        soundId: spec.defaultSoundId,
        volume: spec.defaultVolume,
        minIntervalMs: spec.defaultMinIntervalMs,
        enabled: true,
      };
      expect(isAudioBinding(binding), spec.event).toBe(true);
    }
  });

  it("aceita chaves de carta no formato card:<cardId>", () => {
    expect(isAudioBinding({ event: cardEvent("dragon-whelp"), soundId: "attackSword", volume: 0.5, minIntervalMs: 0, enabled: true })).toBe(true);
  });

  it("aceita soundId nulo (evento silencioso)", () => {
    expect(isAudioBinding({ event: "event:fog", soundId: null, volume: 0, minIntervalMs: 0, enabled: false })).toBe(true);
  });

  it("rejeita volume fora de [0,1] e intervalo absurdo", () => {
    const base = { event: "event:fog", soundId: "fog", minIntervalMs: 0, enabled: true };
    expect(isAudioBinding({ ...base, volume: 1.01 })).toBe(false);
    expect(isAudioBinding({ ...base, volume: -0.01 })).toBe(false);
    expect(isAudioBinding({ ...base, volume: 0.5, minIntervalMs: -1 })).toBe(false);
    expect(isAudioBinding({ ...base, volume: 0.5, minIntervalMs: 60001 })).toBe(false);
    expect(isAudioBinding({ ...base, volume: 0.5, minIntervalMs: 1.5 })).toBe(false);
  });

  it("rejeita escopo desconhecido", () => {
    const base = { soundId: "fog", volume: 0.5, minIntervalMs: 0, enabled: true };
    expect(isAudioBinding({ ...base, event: "banana:x" })).toBe(false);
    expect(isAudioBinding({ ...base, event: "event" })).toBe(false);
  });
});

describe("parseEvent", () => {
  it("separa escopo e nome", () => {
    expect(parseEvent("ui:board.cardSelect")).toEqual({ scope: "ui", name: "board.cardSelect" });
    expect(parseEvent("event:fog")).toEqual({ scope: "event", name: "fog" });
    expect(parseEvent("card:dragon-whelp")).toEqual({ scope: "card", name: "dragon-whelp" });
  });

  it("devolve null fora do formato", () => {
    expect(parseEvent("ui")).toBeNull();
    expect(parseEvent(":x")).toBeNull();
    expect(parseEvent("banana:x")).toBeNull();
  });
});

describe("coerência entre registro e biblioteca", () => {
  it("todo defaultSoundId do registro existe na biblioteca", () => {
    const ids = new Set(DEFAULT_SOUNDS.map((s) => s.id));
    for (const spec of AUDIO_EVENTS) {
      if (spec.defaultSoundId) {
        expect(ids.has(spec.defaultSoundId), `${spec.event} -> ${spec.defaultSoundId}`).toBe(true);
      }
    }
  });

  it("toda chave de evento é única", () => {
    const seen = new Set<string>();
    for (const spec of AUDIO_EVENTS) {
      expect(seen.has(spec.event), spec.event).toBe(false);
      seen.add(spec.event);
    }
  });

  it("a biblioteca não tem ids repetidos", () => {
    const seen = new Set<string>();
    for (const sound of DEFAULT_SOUNDS) {
      expect(seen.has(sound.id), sound.id).toBe(false);
      seen.add(sound.id);
    }
  });
});
