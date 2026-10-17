"use client";

// Fundo do app: cada tema associa um vídeo de background à sua trilha sonora.
// Edite livremente este array (adicione/remova objetos ou troque os caminhos) —
// o vídeo (AppBackground) e a música (BackgroundMusic) leem daqui e ficam
// sincronizados pelo índice sorteado a cada carregamento do menu.

import { create } from "zustand";

export interface BackgroundTheme {
  video: string;
  soundtrack: string;
}

export const BACKGROUNDS: BackgroundTheme[] = [
  {
    video: "/boargame/img/bg-video-homescreen.mp4",
    soundtrack: "/boargame/img/maggi-soundtrack-2.mp3",
  },
  {
    video: "/boargame/img/bg-video-homescreen-2.mp4",
    soundtrack: "/boargame/img/maggi-soundtrack-3.mp3",
  },
  {
    video: "/boargame/img/ascii-magic-18.mp4",
    soundtrack: "/boargame/img/menu-song.mp3",
  },
  {
    video: "/boargame/img/ascii-magic-19.mp4",
    soundtrack: "/boargame/img/menu-song.mp3",
  }
];

interface BackgroundState {
  index: number;
  pickRandom: () => void;
}

// Índice 0 por padrão (determinístico no SSR). O menu sorteia no cliente.
export const useBackground = create<BackgroundState>((set) => ({
  index: 0,
  pickRandom: () => set({ index: Math.floor(Math.random() * BACKGROUNDS.length) }),
}));
