"use client";

// Timer da névoa (estilo The Bazaar): duas linhas azuis vêm das laterais e se
// encontram no centro conforme o tempo se esgota. Aparece no aviso e fica ativa
// (pulsando) enquanto a névoa escala o dano. Posicionada entre os tabuleiros.

import { FOG_WARN_MS, useFog } from "@/lib/fog";

export default function FogTimerLine() {
  const status = useFog((s) => s.status);
  const remaining = useFog((s) => s.remaining);
  const damage = useFog((s) => s.damage);

  if (status === "idle") return null;

  const warnSecs = FOG_WARN_MS / 1000;
  const warning = status === "warning";
  // Progresso 0 -> 1 ao longo do aviso; cada linha cresce até 50% (meio).
  const progress = warning ? Math.max(0, Math.min(1, 1 - remaining / warnSecs)) : 1;
  const sideWidth = `${progress * 50}%`;

  return (
    <div className={`fog-timer fog-timer--${status}`} aria-hidden="true">
      <div className="fog-timer-label">
        {warning ? `NÉVOA EM ${remaining}s` : `NÉVOA · −${damage}/s`}
      </div>
      <div className="fog-timer-track">
        <span className="fog-timer-line fog-timer-line--left" style={{ width: sideWidth }} />
        <span className="fog-timer-line fog-timer-line--right" style={{ width: sideWidth }} />
      </div>
    </div>
  );
}
