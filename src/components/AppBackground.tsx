"use client";

// Fundo compartilhado (vídeo + overlay) usado na home, na página de magos e na
// batalha. Fica atrás de tudo (z-index negativo). O vídeo vem do tema de fundo
// em vigor (src/lib/backgrounds.ts), que o menu sorteia a cada carregamento e
// que fica sincronizado com a trilha sonora (BackgroundMusic).

import { usePathname } from "next/navigation";
import { BACKGROUNDS, useBackground } from "@/lib/backgrounds";
import { useGame } from "@/lib/store";
import { applyOverride, useMageConfig } from "@/lib/mage-config";

export default function AppBackground({ dim = false }: { dim?: boolean }) {
  const index = useBackground((s) => s.index);
  const mage = useGame((s) => s.mage);
  const config = useMageConfig((s) => s.config);
  const pathname = usePathname();
  const inGame = pathname?.startsWith("/play") ?? false;
  // No jogo, o fundo é o do mago escolhido; fora dele, o tema sorteado do menu.
  const src = inGame && mage
    ? applyOverride(mage, config).background
    : BACKGROUNDS[index]?.video ?? BACKGROUNDS[0].video;

  return (
    <>
      <video
        key={src}
        className="app-bg"
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className={`app-bg-overlay ${dim ? "is-dim" : ""}`} aria-hidden="true" />
    </>
  );
}
