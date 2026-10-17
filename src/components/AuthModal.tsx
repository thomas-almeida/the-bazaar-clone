"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useSoundEvent } from "@/components/useSoundEvent";
import Spinner from "@/components/Spinner";

export type AuthMode = "login" | "signup";

export default function AuthModal({
  mode,
  onClose,
}: {
  mode: AuthMode;
  onClose: () => void;
}) {
  const { configured, signIn, signUp } = useAuth();
  const [currentMode, setCurrentMode] = useState<AuthMode>(mode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const soundClose = useSoundEvent("ui:modal.close");
  const soundSubmit = useSoundEvent("ui:auth.submit");
  const soundSwitch = useSoundEvent("ui:auth.switch");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (currentMode === "signup") {
        if (name.trim().length < 2) {
          setError("O nome de jogador precisa ter pelo menos 2 caracteres.");
          return;
        }
        const signedIn = await signUp(name.trim(), email.trim(), password);
        if (!signedIn) {
          setNotice("Conta criada. Confira seu email para confirmar o cadastro e depois entre.");
          return;
        }
      } else {
        await signIn(email.trim(), password);
      }
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="fullscreen-prompt auth-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <form className="fullscreen-prompt-panel auth-modal-panel" onSubmit={submit}>
        <button className="auth-modal-close" type="button" onClick={() => { soundClose(); onClose(); }} aria-label="Fechar">×</button>
        <p className="fullscreen-prompt-eyebrow">MAGGI · JOGADOR</p>
        <h2 id="auth-modal-title">{currentMode === "signup" ? "CRIAR CONTA" : "ENTRAR"}</h2>
        <p className="fullscreen-prompt-copy">
          {currentMode === "signup"
            ? "Crie sua conta para iniciar uma run e salvar seu mago."
            : "Entre com seu email e senha para jogar MAGGI."}
        </p>
        {!configured && (
          <p className="fullscreen-prompt-error" role="alert">
            Supabase Auth não está configurado. Adicione NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ao ambiente e reinicie o app.
          </p>
        )}
        {currentMode === "signup" && (
          <label className="auth-field">
            <span>Nome de jogador</span>
            <input
              autoComplete="nickname"
              maxLength={40}
              minLength={2}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}
        <label className="auth-field">
          <span>Email</span>
          <input
            autoComplete="email"
            maxLength={254}
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="auth-field">
          <span>Senha</span>
          <input
            autoComplete={currentMode === "signup" ? "new-password" : "current-password"}
            minLength={8}
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {currentMode === "signup" && <small>Use no mínimo 8 caracteres.</small>}
        </label>
        {error && <p className="fullscreen-prompt-error" role="alert">{error}</p>}
        {notice && <p className="auth-modal-notice" role="status">{notice}</p>}
        <div className="fullscreen-prompt-actions">
          <button
            className={`home-item home-item--play fullscreen-prompt-action${busy ? " is-loading" : ""}`}
            disabled={busy || !configured}
            aria-busy={busy || undefined}
            onClick={soundSubmit}
          >
            <span className="home-item-label">
              {busy ? "AGUARDE…" : currentMode === "signup" ? "CRIAR CONTA" : "ENTRAR"}
            </span>
            <span className="home-item-tag" aria-hidden="true">➜</span>
            {busy && <Spinner />}
          </button>
          <button
            className="home-item fullscreen-prompt-action auth-mode-switch"
            type="button"
            onClick={() => {
              soundSwitch();
              setCurrentMode(currentMode === "signup" ? "login" : "signup");
              setError("");
              setNotice("");
            }}
          >
            <span className="home-item-label">
              {currentMode === "signup" ? "JÁ TENHO CONTA" : "CRIAR UMA CONTA"}
            </span>
            <span className="home-item-sub">
              {currentMode === "signup" ? "entrar com email e senha" : "cadastro gratuito"}
            </span>
          </button>
        </div>
      </form>
    </section>
  );
}
