"use client";

// Overlay fixo da névoa: um vendaval varre a tela ao ativar (keyed por gust) e
// uma névoa translúcida fica à deriva enquanto ativa. pointer-events: none e
// z-index abaixo dos modais — não interfere no layout nem na interação.

import { useFog } from "@/lib/fog";

export default function FogOverlay() {
  const status = useFog((s) => s.status);
  const gust = useFog((s) => s.gust);

  if (status === "idle" && gust === 0) return null;

  return (
    <div className={`fog-overlay ${status === "active" ? "is-active" : ""}`} aria-hidden="true">
      {status !== "idle" && <div className="fog-haze" />}
      {status === "active" && <div className="fog-drift" />}
      {gust > 0 && (
        <div key={gust} className="fog-gust">
          <span className="fog-streak" />
          <span className="fog-streak" />
          <span className="fog-streak" />
          <span className="fog-streak" />
        </div>
      )}
    </div>
  );
}
