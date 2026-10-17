"use client";

// Tela de confronto (fase de player): você x o rival. Agora é uma TRANSIÇÃO
// automática — abre com fade, segura ~3s e fecha com fade, iniciando a luta
// sozinha (grava o snapshot da build antes). Fundo preto com blur; badges no
// estilo novo (dome + borda/brilho do accent), maiores e mais próximas.

import { useEffect, useRef, useState } from "react";
import { useGame } from "@/lib/store";
import { recordBuildSnapshot } from "@/lib/snapshots";
import { applyOverride, useMageConfig } from "@/lib/mage-config";
import { useSoundEvent } from "@/components/useSoundEvent";
import type { SnapshotSlot } from "@/lib/types";
import { useAuth } from "./AuthProvider";

const HOLD_MS = 3000; // tempo na tela antes do fade de saída
const FADE_MS = 420;

export default function VersusModal() {
  const versusOpen = useGame((s) => s.versusOpen);
  const opponent = useGame((s) => s.opponent);
  const baseMage = useGame((s) => s.mage);
  const config = useMageConfig((s) => s.config);
  const mage = baseMage ? applyOverride(baseMage, config) : null;
  const start = useGame((s) => s.startVersus);
  const { user } = useAuth();
  const soundFight = useSoundEvent("ui:versus.start");
  const [leaving, setLeaving] = useState(false);
  const firedRef = useRef(false);

  const username = (user?.user_metadata?.display_name as string | undefined)?.trim() || "JOGADOR";

  // Transição automática: toca o som ao abrir, segura, faz o fade e luta.
  useEffect(() => {
    if (!versusOpen) { setLeaving(false); firedRef.current = false; return; }
    soundFight();
    const hold = window.setTimeout(() => setLeaving(true), HOLD_MS);
    const go = window.setTimeout(() => void fight(), HOLD_MS + FADE_MS);
    return () => { window.clearTimeout(hold); window.clearTimeout(go); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versusOpen]);

  async function fight() {
    if (firedRef.current) return;
    firedRef.current = true;
    const s = useGame.getState();
    if (user && s.mage) {
      const slots: (SnapshotSlot | null)[] = s.slots.map((card) =>
        card ? { cardId: card.def.id, tier: card.tier } : null,
      );
      try {
        await recordBuildSnapshot(user, {
          name: username,
          mageId: s.mage.id,
          maxHealth: s.effectiveMaxHealth(),
          pass: s.passNumber(),
          slots,
        });
      } catch {
        // Fire-and-forget: falhar a gravação não pode impedir a luta.
      }
    }
    start();
  }

  if (!versusOpen || !opponent || !mage) return null;
  const build = opponent.build;

  return (
    <div
      className={`versus-screen ${leaving ? "is-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Confronto"
    >
      <div className="versus-row">
        <div className="versus-side" style={{ ["--accent" as string]: mage.accent }}>
          <span className={`versus-badge ${mage.cutout ? "has-cutout" : ""}`}>
            {mage.cutout ? (
              <>
                <span className="versus-badge-frame">
                  <img className="versus-badge-photo" src={mage.portrait} alt="" />
                </span>
                <img className="versus-badge-cutout" src={mage.cutout} alt="" aria-hidden="true" />
              </>
            ) : (
              <img className="versus-badge-img" src={mage.portrait} alt="" />
            )}
          </span>
          <span className="versus-name">{username}</span>
        </div>

        <span className="versus-vs" aria-hidden="true">VS</span>

        <div className="versus-side" style={{ ["--accent" as string]: mage.accent }}>
          <span className="versus-badge">
            <img className="versus-badge-img" src={`/boargame/img/${build.portrait}`} alt="" />
          </span>
          <span className="versus-name">{build.name}</span>
        </div>
      </div>
    </div>
  );
}
