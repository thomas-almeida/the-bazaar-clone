"use client";

// Ajustes: sliders de volume da música e dos efeitos, no estilo do menu
// principal. Os valores persistem (useAudioSettings -> localStorage).

import { useAudioSettings, playEvent } from "@/lib/sfx";
import { useSoundEvent } from "@/components/useSoundEvent";

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const musicVolume = useAudioSettings((s) => s.musicVolume);
  const sfxVolume = useAudioSettings((s) => s.sfxVolume);
  const setMusicVolume = useAudioSettings((s) => s.setMusicVolume);
  const setSfxVolume = useAudioSettings((s) => s.setSfxVolume);
  const soundClose = useSoundEvent("ui:modal.close");

  return (
    <section
      className="fullscreen-prompt settings-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      onClick={() => { soundClose(); onClose(); }}
    >
      <div
        className="fullscreen-prompt-panel settings-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="auth-modal-close" type="button" onClick={() => { soundClose(); onClose(); }} aria-label="Fechar">×</button>
        <p className="fullscreen-prompt-eyebrow">MAGGI · ÁUDIO</p>
        <h2 id="settings-title">AJUSTES</h2>

        <label className="settings-field">
          <span className="settings-label">
            MÚSICA <span className="settings-value">{Math.round(musicVolume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(musicVolume * 100)}
            onChange={(e) => setMusicVolume(Number(e.target.value) / 100)}
            aria-label="Volume da música"
          />
        </label>

        <label className="settings-field">
          <span className="settings-label">
            EFEITOS <span className="settings-value">{Math.round(sfxVolume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(sfxVolume * 100)}
            onChange={(e) => setSfxVolume(Number(e.target.value) / 100)}
            onPointerUp={() => playEvent("ui:settings.slider")}
            aria-label="Volume dos efeitos"
          />
        </label>
      </div>
    </section>
  );
}
