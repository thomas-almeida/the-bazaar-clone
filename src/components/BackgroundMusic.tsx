"use client";

// Música de fundo global em loop. Fica no layout, então persiste entre as telas
// (não reinicia ao navegar). O volume vem dos Ajustes (useAudioSettings), com um
// fator menor dentro do jogo (/play). Como navegadores bloqueiam autoplay com
// som, tentamos tocar no mount e também na primeira interação do usuário.

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BACKGROUNDS, useBackground } from "@/lib/backgrounds";
import { useAudioSettings } from "@/lib/sfx";
import { useGame } from "@/lib/store";
import { applyOverride, useMageConfig } from "@/lib/mage-config";

const GAME_FACTOR = 0.4; // música mais baixa dentro do jogo

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pathname = usePathname();
  const bgIndex = useBackground((s) => s.index);
  const musicVolume = useAudioSettings((s) => s.musicVolume);
  const mage = useGame((s) => s.mage);
  const config = useMageConfig((s) => s.config);

  const inGame = pathname?.startsWith("/play") ?? false;
  // No jogo, a música é a do mago; fora dele, a trilha do tema sorteado.
  const soundtrack = inGame && mage
    ? applyOverride(mage, config).music
    : BACKGROUNDS[bgIndex]?.soundtrack ?? BACKGROUNDS[0].soundtrack;
  const target = musicVolume * (inGame ? GAME_FACTOR : 1);

  // Tenta tocar no mount e na primeira interação (contorna o autoplay).
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const tryPlay = () => a.play().catch(() => {});
    tryPlay();
    const onInteract = () => {
      tryPlay();
      window.removeEventListener("pointerdown", onInteract);
    };
    window.addEventListener("pointerdown", onInteract);
    return () => window.removeEventListener("pointerdown", onInteract);
  }, []);

  // Troca a faixa quando o tema de fundo sorteado muda.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.load();
    a.play().catch(() => {});
  }, [soundtrack]);

  // Rampa suave ao trocar de tela; aplicação direta ao mexer no slider.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const from = a.volume;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 300);
      a.volume = Math.min(1, Math.max(0, from + (target - from) * k));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return <audio ref={audioRef} src={soundtrack} loop preload="auto" />;
}
