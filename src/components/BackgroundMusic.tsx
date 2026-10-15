"use client";

// Música de fundo global em loop. Fica no layout, então persiste entre as telas
// (não reinicia ao navegar). Volume maior nos menus e menor dentro do jogo
// (/play). Como navegadores bloqueiam autoplay com som, tentamos tocar no mount
// e também na primeira interação do usuário; há um botão de mute.

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const MENU_VOLUME = 0.55;
const GAME_VOLUME = 0.22;

export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const pathname = usePathname();
  const [muted, setMuted] = useState(false);

  const inGame = pathname?.startsWith("/play") ?? false;
  const target = inGame ? GAME_VOLUME : MENU_VOLUME;

  // Tenta tocar no mount e na primeira interação (contorna o autoplay).
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = MENU_VOLUME;
    const tryPlay = () => a.play().catch(() => {});
    tryPlay();
    const onInteract = () => {
      tryPlay();
      window.removeEventListener("pointerdown", onInteract);
    };
    window.addEventListener("pointerdown", onInteract);
    return () => window.removeEventListener("pointerdown", onInteract);
  }, []);

  // Rampa suave de volume ao trocar de tela / mutar.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const to = muted ? 0 : target;
    const from = a.volume;
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 500);
      a.volume = from + (to - from) * k;
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, muted]);

  return (
    <>
      <audio ref={audioRef} src="/boargame/img/menu-song.mp3" loop preload="auto" />
      <button
        type="button"
        className={`music-toggle ${muted ? "is-muted" : ""}`}
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Ativar música" : "Silenciar música"}
        title={muted ? "Ativar música" : "Silenciar música"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </>
  );
}
