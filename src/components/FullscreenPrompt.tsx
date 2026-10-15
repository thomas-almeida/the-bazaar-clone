"use client";

import { useEffect, useRef, useState } from "react";

const DISMISS_KEY = "maggi-fullscreen-prompt-dismissed";

export default function FullscreenPrompt() {
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const fullscreenButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== "true");
    } catch {
      setVisible(true);
      setError("Não foi possível salvar preferências neste navegador.");
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    document.body.classList.add("fullscreen-prompt-open");
    fullscreenButton.current?.focus();
    return () => {
      document.body.classList.remove("fullscreen-prompt-open");
      previousFocus?.focus();
    };
  }, [visible]);

  const enterFullscreen = async () => {
    if (pending) return;
    if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) {
      setError("A tela cheia não está disponível neste navegador.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await document.documentElement.requestFullscreen();
      setVisible(false);
    } catch {
      setError("Não foi possível ativar a tela cheia. Verifique as permissões do navegador.");
    } finally {
      setPending(false);
    }
  };

  const dismissPermanently = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "true");
      setVisible(false);
    } catch {
      setError("Não foi possível salvar essa preferência. Tente novamente.");
    }
  };

  const trapFocus = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Tab") return;
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)");
    const first = buttons.item(0);
    const last = buttons.item(buttons.length - 1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (!ready || !visible) return null;

  return (
    <section
      className="fullscreen-prompt"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fullscreen-prompt-title"
      aria-describedby="fullscreen-prompt-description"
      onKeyDown={trapFocus}
    >
      <div className="fullscreen-prompt-panel">
        <p className="fullscreen-prompt-eyebrow">MAGGI · EXPERIÊNCIA DE JOGO</p>
        <h2 id="fullscreen-prompt-title">JOGUE EM TELA CHEIA</h2>
        <p id="fullscreen-prompt-description" className="fullscreen-prompt-copy">
          O jogo fica melhor em tela cheia. Você pode ativá-la agora ou ocultar este aviso.
        </p>
        <div className="fullscreen-prompt-actions">
          <button
            ref={fullscreenButton}
            type="button"
            className="home-item home-item--play fullscreen-prompt-action"
            onClick={enterFullscreen}
            disabled={pending}
          >
            <span className="home-item-label">
              {pending ? "ATIVANDO…" : "COLOCAR EM TELA CHEIA"}
            </span>
            <span className="home-item-tag" aria-hidden="true">⛶</span>
          </button>
          <button
            type="button"
            className="home-item fullscreen-prompt-action"
            onClick={dismissPermanently}
            disabled={pending}
          >
            <span className="home-item-label">NÃO MOSTRAR NOVAMENTE</span>
            <span className="home-item-sub">salvar preferência</span>
          </button>
        </div>
        {error && <p className="fullscreen-prompt-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}
