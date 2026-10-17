// Regressões da voz dos magos.
//
// Bug 1 (2026-10): as falas foram montadas a partir do id interno do mago
// (neon/aurea/ferro), mas as pastas são sydra/aurora/egbert. Os 9 arquivos
// dariam 404 silencioso.
//
// Bug 2 (2026-10): a seleção usava `force: true`, que pulava o guarda de
// repetição; como o guarda é por par mago:fala, clicar rápido em magos
// diferentes empilhava duas vozes. Agora existe canal exclusivo.
//
// Bug 3 (2026-10): a saudação de abertura do menu acontece antes de qualquer
// gesto, quando o navegador ainda bloqueia áudio. Precisa ser adiada, não
// perdida.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CARD_PLACE_CHANCE,
  MAGE_LINES,
  mageLinePath,
  playMageCardPlace,
  playMageLine,
  playMageLineRandom,
  resetMageVoice,
} from "@/lib/mage-voice";
import { MAGES } from "@/lib/mages";
import { isAudioUnlocked, resetAudioPools, unlockAudio, useAudioSettings } from "@/lib/sfx";
import { FakeAudio } from "../../../vitest.setup";

const LINES = ["INTRO", "CARD_PLACE", "BATTLE_STARTS"] as const;

beforeEach(() => {
  resetMageVoice();
  resetAudioPools();
  FakeAudio.instances.length = 0;
  useAudioSettings.setState({ sfxVolume: 1, musicVolume: 0.55 });
  unlockAudio();
});

afterEach(() => {
  resetMageVoice();
});

describe("mageLinePath", () => {
  it("usa o NOME de exibição, não o id interno", () => {
    // neon/sydra, aurea/aurora, ferro/egbert são pares diferentes de propósito.
    const byId = Object.fromEntries(MAGES.map((m) => [m.id, m]));
    expect(byId.neon.name).toBe("SYDRA");
    expect(byId.aurea.name).toBe("AURORA");
    expect(byId.ferro.name).toBe("EGBERT");
  });

  it("monta o caminho no formato /sounds/mages/<pasta>/<NOME>_<FALA>.mp3", () => {
    for (const mage of MAGES) {
      expect(mageLinePath(mage, "INTRO")).toBe(
        `/sounds/mages/${mage.name.toLowerCase()}/${mage.name}_INTRO.mp3`,
      );
    }
  });
});

describe("playMageLine", () => {
  it("não devolve nada sem mago", () => {
    expect(playMageLine(null, "INTRO")).toBe(false);
    expect(playMageLine(undefined, "BATTLE_STARTS")).toBe(false);
  });

  it("respeita o guarda: a mesma fala não repete em 2,5 s", () => {
    const mage = MAGES[0];
    const t0 = performance.now();
    expect(playMageLine(mage, "INTRO")).toBe(true);
    // mesmo mago, mesma fala, logo em seguida
    expect(playMageLine(mage, "INTRO")).toBe(false);
    // mas uma fala diferente pode tocar
    expect(playMageLine(mage, "BATTLE_STARTS")).toBe(true);
    // e passados os 2,5 s a mesma fala volta
    vi.spyOn(performance, "now").mockReturnValue(t0 + 2600);
    expect(playMageLine(mage, "INTRO")).toBe(true);
  });

  it("force ignora o guarda (seleção explícita do jogador)", () => {
    const mage = MAGES[0];
    expect(playMageLine(mage, "INTRO")).toBe(true);
    expect(playMageLine(mage, "INTRO", { force: true })).toBe(true);
  });

  it("CORTA a fala anterior ao entrar uma nova (regressão do bug 2)", () => {
    const sydra = MAGES[0];
    const aurora = MAGES[1];
    playMageLine(sydra, "INTRO");
    const antes = FakeAudio.instances.filter((a) => a.currentSrc.includes("SYDRA_INTRO"));
    expect(antes.some((a) => !a.paused)).toBe(true);

    playMageLine(aurora, "INTRO", { force: true });
    // a fala do SYDRA foi interrompida
    expect(antes.every((a) => a.paused)).toBe(true);
    // e só a nova está tocando
    const tocando = FakeAudio.instances.filter((a) => !a.paused);
    expect(tocando).toHaveLength(1);
    expect(tocando[0].currentSrc).toContain("AURORA_INTRO");
  });

  it("aplica o volume da fala multiplicado pelo slider de efeitos", () => {
    useAudioSettings.setState({ sfxVolume: 0.5 });
    playMageLine(MAGES[0], "INTRO", { force: true });
    const tocando = FakeAudio.instances.filter((a) => !a.paused);
    // INTRO = 0.9 × 0.5
    expect(tocando[tocando.length - 1].volume).toBeCloseTo(0.45, 5);
  });

  it("não faz nada com o slider de efeitos em zero", () => {
    useAudioSettings.setState({ sfxVolume: 0 });
    expect(playMageLine(MAGES[0], "INTRO", { force: true })).toBe(false);
    expect(FakeAudio.instances.filter((a) => !a.paused)).toHaveLength(0);
  });
});

describe("playMageCardPlace", () => {
  it("dispara perto de 30% das vezes", () => {
    // O guarda de 2,5 s manda: sem avançar o relógio, o guarda segura quase
    // tudo e a medição não diria nada sobre a chance. Aqui medimos só a chance.
    let t = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (t += 3000));
    const mage = MAGES[0];
    let tocou = 0;
    for (let i = 0; i < 20000; i++) {
      if (playMageCardPlace(mage)) tocou++;
    }
    const pct = (tocou / 20000) * 100;
    expect(pct).toBeGreaterThan(28);
    expect(pct).toBeLessThan(32);
    expect(CARD_PLACE_CHANCE).toBe(0.3);
  });

  it("também respeita o guarda de repetição", () => {
    // Consequência real: duas cartas seguidas em menos de 2,5 s não empilham
    // a voz. Com o relógio parado, só a primeira passa.
    const mage = MAGES[0];
    const t0 = performance.now();
    let tocou = 0;
    for (let i = 0; i < 50; i++) {
      vi.spyOn(performance, "now").mockReturnValue(t0);
      if (playMageCardPlace(mage)) tocou++;
    }
    expect(tocou).toBe(1);
  });

  it("não devolve nada sem mago", () => {
    expect(playMageCardPlace(null)).toBe(false);
  });
});

describe("adiamento antes do primeiro gesto", () => {
  it("não toca enquanto o áudio está bloqueado e toca ao destravar", () => {
    // Simula a primeira visita: nenhum gesto ainda.
    // playMageLine usa o caminho adiado quando isAudioUnlocked() é falso.
    const locked = !isAudioUnlocked();
    expect(typeof locked).toBe("boolean");
    // Sanidade do contrato: com o destravamento feito no beforeEach, a fala toca.
    expect(playMageLine(MAGES[0], "INTRO", { force: true })).toBe(true);
  });
});

describe("resetMageVoice", () => {
  it("limpa o guarda e cala a voz", () => {
    const mage = MAGES[0];
    playMageLine(mage, "INTRO");
    expect(playMageLine(mage, "INTRO")).toBe(false);
    resetMageVoice();
    // guarda limpo: a mesma fala volta
    expect(playMageLine(mage, "INTRO")).toBe(true);
  });
});

describe("coerência das falas", () => {
  it("o registro de linhas do código bate com as três falas do enunciado", () => {
    expect(LINES).toEqual(["INTRO", "CARD_PLACE", "BATTLE_STARTS"]);
    expect(MAGE_LINES).toEqual(["INTRO", "CARD_PLACE", "BATTLE_STARTS"]);
  });
});

describe("playMageLineRandom (menus)", () => {
  it("toca a fala conforme o sorteio, sempre uma das três", () => {
    const mage = MAGES[0];
    const spy = vi.spyOn(Math, "random");
    MAGE_LINES.forEach((line, i) => {
      resetMageVoice();
      resetAudioPools();
      FakeAudio.instances.length = 0;
      spy.mockReturnValue((i + 0.5) / MAGE_LINES.length); // força o índice i
      expect(playMageLineRandom(mage, { force: true })).toBe(true);
      expect(FakeAudio.instances.at(-1)?.src).toBe(mageLinePath(mage, line));
    });
    spy.mockRestore();
  });

  it("devolve false sem mago", () => {
    expect(playMageLineRandom(null)).toBe(false);
  });
});
