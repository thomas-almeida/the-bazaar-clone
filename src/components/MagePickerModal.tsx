"use client";

// Modal do menu principal: abre ao clicar no retrato do mago. Lista todos os
// magos (vídeo de fundo + retrato + nome). Passar o mouse/focar um botão mostra
// o fundo do mago e toca ~10s da sua música (recorte do meio). Clicar
// pré-seleciona o mago (para pular a tela de seleção ao jogar) e fecha o modal.

import { useCallback, useEffect, useRef } from "react";
import { useMergedMages } from "@/lib/mage-config";
import { useAudioSettings } from "@/lib/sfx";
import { useSoundEvent } from "@/components/useSoundEvent";

const PREVIEW_MS = 10000; // ~10s de prévia da música

export default function MagePickerModal({
  selectedId,
  onPick,
  onClose,
}: {
  selectedId: string | null;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const mages = useMergedMages();
  const musicVolume = useAudioSettings((s) => s.musicVolume);
  const soundClose = useSoundEvent("ui:modal.close");
  const soundPick = useSoundEvent("ui:modal.magePick");

  const previewRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const pausedRef = useRef<HTMLAudioElement[]>([]);
  const volRef = useRef(musicVolume);
  volRef.current = musicVolume;

  const stopPreview = useCallback(() => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    const a = previewRef.current;
    if (a) { a.pause(); a.removeAttribute("src"); }
    // Retoma a música de fundo que foi pausada para a prévia.
    for (const el of pausedRef.current) el.play().catch(() => {});
    pausedRef.current = [];
  }, []);

  const startPreview = useCallback((music: string) => {
    stopPreview();
    // Pausa as faixas de fundo da página enquanto a prévia toca.
    pausedRef.current = Array.from(document.querySelectorAll<HTMLAudioElement>("audio"))
      .filter((el) => el !== previewRef.current && !el.paused);
    for (const el of pausedRef.current) el.pause();

    let a = previewRef.current;
    if (!a) { a = new Audio(); a.preload = "auto"; previewRef.current = a; }
    a.src = music;
    a.volume = Math.min(1, Math.max(0, volRef.current));
    const onMeta = () => {
      a!.currentTime = Number.isFinite(a!.duration) ? a!.duration / 2 : 0; // recorte do meio
      a!.play().catch(() => {});
    };
    a.addEventListener("loadedmetadata", onMeta, { once: true });
    a.load();
    timerRef.current = window.setTimeout(stopPreview, PREVIEW_MS);
  }, [stopPreview]);

  // Garante que a prévia pare ao desmontar o modal.
  useEffect(() => stopPreview, [stopPreview]);

  const close = () => { stopPreview(); soundClose(); onClose(); };

  return (
    <section
      className="fullscreen-prompt mage-picker-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mage-picker-title"
      onClick={close}
    >
      <div
        className="fullscreen-prompt-panel mage-picker-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="auth-modal-close" type="button" onClick={close} aria-label="Fechar">×</button>
        <p className="fullscreen-prompt-eyebrow">MAGGI · MAGOS</p>
        <h2 id="mage-picker-title">ESCOLHA SEU MAGO</h2>

        <div className="mage-picker-grid">
          {mages.map((mage) => (
            <button
              key={mage.id}
              type="button"
              className={`mage-picker-card ${mage.id === selectedId ? "is-selected" : ""}`}
              style={{ ["--profile-accent" as string]: mage.accent }}
              onClick={() => { stopPreview(); soundPick(); onPick(mage.id); }}
              onPointerEnter={() => startPreview(mage.music)}
              onPointerLeave={stopPreview}
              onFocus={() => startPreview(mage.music)}
              onBlur={stopPreview}
              aria-pressed={mage.id === selectedId}
            >
              <span className="mage-picker-frame" aria-hidden="true">
                <video
                  className="mage-picker-bg"
                  src={mage.background}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
                <span className="mage-picker-grad" />
              </span>
              {mage.cutout
                ? <img className="mage-picker-cutout" src={mage.cutout} alt={`Mago ${mage.name}`} />
                : <img className="mage-picker-portrait" src={mage.portrait} alt={`Mago ${mage.name}`} />}
              <span className="mage-picker-name">{mage.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
