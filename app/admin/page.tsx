"use client";

// Shell do painel de balanceamento. Autentica pela senha administrativa e
// divide o trabalho em duas abas independentes:
//
// - CARTAS: patches de cartas (balanceamento), publicam em /api/admin/patches.
// - SONS:   patches de áudio (biblioteca + eventos), publicam em /api/admin/audio.
//
// Cada aba tem seu próprio patch bar e seu próprio botão de publicar, porque
// som e balanceamento mudam em ritmos diferentes e um não deve exigir o outro.

import { useCallback, useEffect, useState } from "react";
import AppBackground from "@/components/AppBackground";
import LoadingScreen from "@/components/LoadingScreen";
import { playEvent } from "@/lib/sfx";
import CardsTab from "@/components/admin/CardsTab";
import SoundsTab from "@/components/admin/SoundsTab";
import VfxTab from "@/components/admin/VfxTab";
import MagesTab from "@/components/admin/MagesTab";
import Spinner from "@/components/Spinner";
import { Field, readJson } from "@/components/admin/shared";

type Tab = "cards" | "sounds" | "vfx" | "mages";

export default function AdminPage() {
  const [session, setSession] = useState<"checking" | "login" | "ready">("checking");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("cards");
  const [notice, setNotice] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const logout = useCallback(async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setSession("login");
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/patches", { cache: "no-store" });
    if (response.status === 401) {
      setSession("login");
      return;
    }
    // A aba ativa busca os próprios dados; aqui só confirmamos a sessão.
    await readJson(response);
    setSession("ready");
    setError("");
  }, []);

  useEffect(() => {
    load().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar o painel.");
      setSession("ready");
    });
  }, [load]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await readJson(await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }));
      setPassword("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  if (session === "checking") {
    return <LoadingScreen label="Abrindo o painel…" />;
  }

  if (session === "login") {
    return (
      <main className="balance-admin balance-login-wrap">
        <AppBackground />
        <form className="balance-login fullscreen-prompt-panel" onSubmit={login}>
          <span className="balance-kicker">MAGGI · FERRAMENTAS</span>
          <h1>Balanceamento</h1>
          <p>Acesso restrito. Entre com a senha administrativa.</p>
          <Field label="Senha administrativa">
            <input autoFocus type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {error && <p className="balance-error" role="alert">{error}</p>}
          <button
            className={`home-item balance-button${busy ? " is-loading" : ""}`}
            disabled={busy || !password}
            aria-busy={busy || undefined}
          >
            {busy ? "ENTRANDO…" : "ENTRAR"}
            {busy && <Spinner />}
          </button>
          <a href="/" className="balance-back">← Voltar ao jogo</a>
        </form>
      </main>
    );
  }

  return (
    <main className="balance-admin">
      <AppBackground />
      <header className="balance-header">
        <div>
          <img className="balance-brand-logo" src="/boargame/img/logo-game.png" alt="MAGGI" />
          <span className="balance-kicker">MAGGI · FERRAMENTAS</span>
          <h1>Painel de balanceamento</h1>
          <p>Cartas e sons em patches versionados, com publicação explícita.</p>
        </div>
        <nav className="balance-header-actions">
          <a className="home-item balance-button" href="/">VOLTAR AO JOGO</a>
          <button
            className={`home-item balance-button${signingOut ? " is-loading" : ""}`}
            disabled={signingOut}
            aria-busy={signingOut || undefined}
            onClick={() => void handleSignOut()}
          >
            SAIR
            {signingOut && <Spinner />}
          </button>
        </nav>
      </header>

      <nav className="balance-tabs" role="tablist" aria-label="Seções do painel">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "cards"}
          className={`balance-tab ${tab === "cards" ? "is-selected" : ""}`}
          onClick={() => { playEvent("ui:admin.tab"); setTab("cards"); }}
        >
          CARTAS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "sounds"}
          className={`balance-tab ${tab === "sounds" ? "is-selected" : ""}`}
          onClick={() => { playEvent("ui:admin.tab"); setTab("sounds"); }}
        >
          SONS
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "vfx"}
          className={`balance-tab ${tab === "vfx" ? "is-selected" : ""}`}
          onClick={() => { playEvent("ui:admin.tab"); setTab("vfx"); }}
        >
          VFX
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "mages"}
          className={`balance-tab ${tab === "mages" ? "is-selected" : ""}`}
          onClick={() => { playEvent("ui:admin.tab"); setTab("mages"); }}
        >
          MAGOS
        </button>
      </nav>

      {notice && <p className="balance-success balance-notice" role="status">{notice}</p>}

      {tab === "cards" && <CardsTab key="cards" onNotice={setNotice} />}
      {tab === "sounds" && <SoundsTab key="sounds" onNotice={setNotice} />}
      {tab === "vfx" && <VfxTab key="vfx" onNotice={setNotice} />}
      {tab === "mages" && <MagesTab key="mages" onNotice={setNotice} />}
    </main>
  );
}
