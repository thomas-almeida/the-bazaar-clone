// Ambiente de teste. O projeto não tem DOM completo nos testes de lógica, mas
// a camada de áudio depende de HTMLMediaElement e performance.now().

import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom não implementa mídia. Registramos o que `src/lib/sfx.ts` usa, para os
// testes poderem observar volume, pool e canais sem tocar som de verdade.
class FakeAudio {
  static instances: FakeAudio[] = [];
  src: string;
  currentSrc = "";
  volume = 1;
  paused = true;
  currentTime = 0;
  preload = "";
  playCount = 0;

  constructor(src: string) {
    this.src = src;
    this.currentSrc = src;
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCount++;
    this.paused = false;
    return Promise.resolve();
  }

  pause(): void {
    this.paused = true;
  }

  cloneNode(): FakeAudio {
    return new FakeAudio(this.src);
  }

  addEventListener(): void {}
  removeEventListener(): void {}
}

vi.stubGlobal("Audio", FakeAudio);

export { FakeAudio };
