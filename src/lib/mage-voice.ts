"use client";

// Vozes dos magos. Cada mago tem três falas em
// `public/sounds/mages/<mago>/<MAGO>_<FALA>.mp3`:
//
//   INTRO           ao selecionar o mago e no início da PRIMEIRA fase da run
//   CARD_PLACE      ao posicionar uma carta no tabuleiro (chance de 30%)
//   BATTLE_STARTS   início do combate — no lugar da INTRO
//
// O caminho sai do NOME de exibição do mago (`SYDRA` -> /sounds/mages/sydra/
// SYDRA_INTRO.mp3), não do id interno, que é outro (`neon`, `aurea`, `ferro`).
//
// Estas falas não passam pelo patch de áudio: são trilha narrativa do mago e
// não têm biblioteca nem binding no painel. Respeitam o slider de EFEITOS do
// jogador, como todo o resto.

import { isAudioUnlocked, playOrDefer, playPath, stopChannel } from "./sfx";
import type { Mage } from "./mages";

export type MageLine = "INTRO" | "CARD_PLACE" | "BATTLE_STARTS";

/** As três falas de um mago. Nos menus escolhemos uma ao acaso. */
export const MAGE_LINES: MageLine[] = ["INTRO", "CARD_PLACE", "BATTLE_STARTS"];

/** Volume relativo das falas antes do slider do jogador. */
const LINE_VOLUME: Record<MageLine, number> = {
  INTRO: 0.9,
  CARD_PLACE: 0.7,
  BATTLE_STARTS: 0.9,
};

/**
 * Duas fases seguidas podem tocar a mesma fala em menos de um segundo (menu
 * -> início da run), e ficar repetindo a voz do mago cansa. Este intervalo
 * trava a repetição da MESMA fala; falas diferentes podem se sobrepor.
 */
const REPEAT_GUARD_MS = 2500;

/** Probabilidade de a fala de posicionar carta tocar. */
export const CARD_PLACE_CHANCE = 0.3;

const lastPlayed = new Map<string, number>();

export function mageLinePath(mage: Mage, line: MageLine): string {
  return `/sounds/mages/${mage.name.toLowerCase()}/${mage.name}_${line}.mp3`;
}

/** Todas as falas do mago dividem um canal: uma voz por vez. */
const MAGE_CHANNEL = "mage-voice";

/** Toca a fala do mago. Devolve false quando o guarda de repetição segurou. */
export function playMageLine(
  mage: Mage | null | undefined,
  line: MageLine,
  options?: { force?: boolean },
): boolean {
  if (!mage) return false;
  const now = performance.now();
  const key = `${mage.id}:${line}`;
  if (!options?.force && now - (lastPlayed.get(key) ?? -Infinity) < REPEAT_GUARD_MS) return false;
  lastPlayed.set(key, now);
  const path = mageLinePath(mage, line);
  const speak = () => playPath(key, path, LINE_VOLUME[line], { channel: MAGE_CHANNEL });
  // Abertura do menu acontece antes de qualquer gesto: adia em vez de perder.
  if (!isAudioUnlocked()) return playOrDefer(`mage:${key}`, speak);
  return speak();
}

/** Toca uma das três falas do mago, escolhida ao acaso (usada nos menus). */
export function playMageLineRandom(
  mage: Mage | null | undefined,
  options?: { force?: boolean },
): boolean {
  if (!mage) return false;
  const line = MAGE_LINES[Math.floor(Math.random() * MAGE_LINES.length)];
  return playMageLine(mage, line, options);
}

/** Fala de carta posicionada: 30% de chance. */
export function playMageCardPlace(mage: Mage | null | undefined): boolean {
  if (!mage) return false;
  if (Math.random() >= CARD_PLACE_CHANCE) return false;
  return playMageLine(mage, "CARD_PLACE");
}

/** Libera o guarda e cala a voz (troca de run, reinício, logout). */
export function resetMageVoice(): void {
  lastPlayed.clear();
  stopChannel(MAGE_CHANNEL);
}