"use client";

// Motor de combate com haste/aceleração.
//
// Cada carta de criatura/feitiço roda um ciclo de recarga. Em vez de contar
// elapsed/duração fixa, acumulamos "carga" por frame (dt / cooldownEfetivo),
// o que lida naturalmente com cooldown variável pela haste. Ao completar 1 de
// carga, dispara com o valor efetivo (escalado pelo tempo + equipamentos).
//
// Em tempo real, atualiza no DOM o valor exibido (.card-stat-value) e o cooldown
// (.card-cooldown) de cada carta — jogador e oponente. Equipamentos não disparam;
// apenas contribuem para as taxas de haste (ver src/lib/haste.ts).

import { useEffect } from "react";
import { useGame } from "@/lib/store";
import { launchProjectile } from "@/lib/projectiles";
import {
  FOG_DMG_STEP,
  FOG_START_MS,
  FOG_WARN_MS,
  useFog,
} from "@/lib/fog";
import { tierCooldownMs, tierValue } from "@/lib/tiers";
import { computeSynergy } from "@/lib/synergy";
import {
  effectiveCooldownMs,
  effectiveValue,
  formatSeconds,
  sideRates,
  type Rates,
} from "@/lib/haste";
import type { CardInstance, EffectType, Side } from "@/lib/types";

interface Combatant {
  el: HTMLElement;
  side: Side;
  baseValue: number;
  baseCdMs: number;
  effectType: EffectType;
  icon: string;
  valueEl: HTMLElement | null;
  cdEl: HTMLElement | null;
  baseValueText: string;
  baseCdText: string;
  charge: number;
  runFiring: number;
}

const EFFECT_ICON: Record<EffectType, string> = {
  damage: "⚔",
  healing: "✚",
  shield: "⛨",
};

export function useCombatEngine() {
  const battleActive = useGame((s) => s.battleActive);
  const opponentName = useGame((s) => s.battleOpponentName);

  useEffect(() => {
    if (!battleActive) return;

    const state = useGame.getState();
    const combatants: Combatant[] = [];
    const start = performance.now();

    const playerBonus = computeSynergy(state.slots).bonuses;
    const opponentBonus = computeSynergy(state.opponent?.cards ?? []).bonuses;

    const register = (card: CardInstance, side: Side, slotIndex: number) => {
      const def = card.def;
      if (def.kind === "equipment") return; // equipamentos não disparam
      const effectType: EffectType | null =
        def.effectType ?? (def.damage !== undefined ? "damage" : null);
      if (!effectType) return;
      const el = document.querySelector<HTMLElement>(
        `.board-row [data-card-id="${card.id}"]`,
      );
      if (!el) return;
      const bonus = (side === "player" ? playerBonus : opponentBonus)[slotIndex] ?? {
        bonusValue: 0,
        cooldownMult: 1,
      };
      const rawValue = def.effectValue ?? def.damage ?? 0;
      const baseValue = tierValue(rawValue, card.tier) + bonus.bonusValue;
      const baseCdMs = Math.max(500, tierCooldownMs(def.cooldown * 1000, card.tier) * bonus.cooldownMult);
      const icon = EFFECT_ICON[effectType];
      el.classList.add("cooldown-active");
      el.style.setProperty("--cooldown-progress", "0%");
      el.style.setProperty("--cooldown-charge", "0");
      combatants.push({
        el,
        side,
        baseValue,
        baseCdMs,
        effectType,
        icon,
        valueEl: el.querySelector<HTMLElement>(".card-stat-value"),
        cdEl: el.querySelector<HTMLElement>(".card-cooldown"),
        baseValueText: `${icon} ${baseValue}`,
        baseCdText: `⏱ ${formatSeconds(baseCdMs / 1000)}s`,
        charge: 0,
        runFiring: 0,
      });
    };

    state.slots.forEach((c, i) => c && register(c, "player", i));
    state.opponent?.cards.forEach((c, i) => c && register(c, "opponent", i));

    // Névoa: reseta o aviso/estado no início de cada batalha.
    useFog.getState().reset();
    let nextFogAt = FOG_START_MS;
    let fogDamage = 0; // escala a cada segundo (haste da névoa)

    const boards = (side: Side) => {
      const st = useGame.getState();
      const player = st.slots;
      const opp = st.opponent?.cards ?? [];
      return side === "player" ? { self: player, enemy: opp } : { self: opp, enemy: player };
    };

    const fire = (c: Combatant, value: number) => {
      c.el.classList.add("is-firing");
      window.clearTimeout(c.runFiring);
      c.runFiring = window.setTimeout(() => c.el.classList.remove("is-firing"), 240);

      // projétil cosmético para cartas de dano
      if (c.effectType === "damage") {
        launchProjectile(c.el, c.side === "player" ? "opponent" : "player");
      }
      // popup flutuante na carta com o valor efetivo
      const popValue = c.el.querySelector<HTMLElement>(".card-effect-value");
      if (popValue) popValue.textContent = String(value);
      c.el.classList.remove("effect-pop-active");
      void c.el.offsetWidth;
      c.el.classList.add("effect-pop-active");

      const resolution = useGame
        .getState()
        .resolveBattleEffect(c.side, c.effectType, value);
      if (resolution && resolution.actualValue > 0) {
        showHealthEffect(resolution.targetSide, resolution.actualEffect, resolution.actualValue);
      }
    };

    let raf = 0;
    let lastNow = start;
    const tick = (now: number) => {
      if (!useGame.getState().battleActive) return;
      const dt = now - lastNow;
      lastNow = now;
      const t = (now - start) / 1000;

      const { self: pSelf, enemy: pEnemy } = boards("player");
      const playerRates: Rates = sideRates(pSelf, pEnemy);
      const opponentRates: Rates = sideRates(pEnemy, pSelf);

      for (const c of combatants) {
        if (!c.el.isConnected) continue;
        const rates = c.side === "player" ? playerRates : opponentRates;
        const value = effectiveValue(c.baseValue, rates.value, t);
        const cdMs = effectiveCooldownMs(c.baseCdMs, rates.cd, t);

        // atualização em tempo real dos status exibidos
        if (c.valueEl) c.valueEl.textContent = `${c.icon} ${value}`;
        if (c.cdEl) c.cdEl.textContent = `⏱ ${formatSeconds(cdMs / 1000)}s`;

        c.charge += dt / cdMs;
        while (c.charge >= 1 && useGame.getState().battleActive) {
          fire(c, value);
          c.charge -= 1;
        }
        c.el.style.setProperty("--cooldown-progress", `${Math.min(1, c.charge) * 100}%`);
        c.el.style.setProperty("--cooldown-charge", String(Math.min(1, c.charge)));
      }

      // Névoa / sandstorm
      const elapsedMs = now - start;
      const fog = useFog.getState();
      if (elapsedMs >= FOG_START_MS) {
        if (fog.status !== "active") {
          useFog.setState({ status: "active", remaining: 0, gust: fog.gust + 1 });
        }
        while (elapsedMs >= nextFogAt && useGame.getState().battleActive) {
          fogDamage += FOG_DMG_STEP; // dano escala a cada segundo
          const res = useGame.getState().fogDamage(fogDamage);
          if (res) {
            if (res.player > 0) showHealthEffect("player", "damage", res.player);
            if (res.opponent > 0) showHealthEffect("opponent", "damage", res.opponent);
          }
          useFog.setState({ damage: fogDamage });
          nextFogAt += 1000;
        }
      } else if (elapsedMs >= FOG_START_MS - FOG_WARN_MS) {
        const remaining = Math.ceil((FOG_START_MS - elapsedMs) / 1000);
        if (fog.status !== "warning" || fog.remaining !== remaining) {
          useFog.setState({ status: "warning", remaining });
        }
      }

      if (useGame.getState().battleActive) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      useFog.getState().reset();
      for (const c of combatants) {
        window.clearTimeout(c.runFiring);
        c.el.classList.remove("cooldown-active", "is-firing", "effect-pop-active");
        c.el.style.setProperty("--cooldown-progress", "0%");
        c.el.style.setProperty("--cooldown-charge", "0");
        // restaura os status para os valores-base
        if (c.valueEl) c.valueEl.textContent = c.baseValueText;
        if (c.cdEl) c.cdEl.textContent = c.baseCdText;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battleActive, opponentName]);
}

function showHealthEffect(side: Side, effectType: EffectType, value: number) {
  const bar = document.querySelector<HTMLElement>(`[data-health="${side}"]`);
  if (!bar) return;
  const flash =
    effectType === "damage"
      ? "is-damaged"
      : effectType === "healing"
        ? "is-healed"
        : "is-shielded";
  bar.classList.remove("is-damaged", "is-healed", "is-shielded");
  bar.classList.add(flash);
  window.setTimeout(() => bar.classList.remove(flash), 360);

  const effect = bar.querySelector<HTMLElement>(".battle-health-effect");
  if (effect) {
    effect.textContent = `${EFFECT_ICON[effectType]} ${value}`;
    effect.className = `battle-health-effect battle-health-effect--${effectType}`;
    void effect.offsetWidth;
    effect.classList.add("is-active");
    window.setTimeout(() => effect.classList.remove("is-active"), 1250);
  }
}
