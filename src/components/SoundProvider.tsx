"use client";

// Mountado uma vez no layout. Duas responsabilidades:
//
// 1. Buscar a configuração de áudio publicada (GET /api/audio) uma vez por
//    sessão; até ela chegar, o runtime usa a biblioteca local padrão, então
//    nenhum efeito some enquanto a página carrega.
// 2. Destravar o áudio no primeiro gesto real do usuário. Sem isso o navegador
//    rejeita todo `play()` e os efeitos "não tocam" — era o bug mais difícil de
//    diagnosticar porque o erro era engolido em silêncio.

import { useEffect } from "react";
import { unlockAudio, useAudioConfig } from "@/lib/sfx";
import { useVfxConfig } from "@/lib/vfx";
import { useMageConfig } from "@/lib/mage-config";

const GESTURE_EVENTS: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "touchstart"];

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const load = useAudioConfig((s) => s.load);
  const loadVfx = useVfxConfig((s) => s.load);
  const loadMages = useMageConfig((s) => s.load);

  useEffect(() => {
    void load();
    void loadVfx(); // config de VFX publicada (projéteis); cai nos padrões sem backend
    void loadMages(); // overrides de apresentação dos magos (retrato/fundo/música)
  }, [load, loadVfx, loadMages]);

  useEffect(() => {
    const onGesture = () => unlockAudio();
    for (const type of GESTURE_EVENTS) {
      document.addEventListener(type, onGesture, { capture: true, passive: true });
    }
    return () => {
      for (const type of GESTURE_EVENTS) {
        document.removeEventListener(type, onGesture, { capture: true });
      }
    };
  }, []);

  return <>{children}</>;
}
