"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppBackground from "@/components/AppBackground";
import AuthModal, { type AuthMode } from "@/components/AuthModal";
import MagePickerModal from "@/components/MagePickerModal";
import SettingsModal from "@/components/SettingsModal";
import { useAuth } from "@/components/AuthProvider";
import { useSoundEvent } from "@/components/useSoundEvent";
import NavLink from "@/components/NavLink";
import Spinner from "@/components/Spinner";
import { playEvent } from "@/lib/sfx";
import { useBackground } from "@/lib/backgrounds";
import { getMage, MAGES } from "@/lib/mages";
import { applyOverride, useMageConfig } from "@/lib/mage-config";
import { playMageLineRandom } from "@/lib/mage-voice";

export default function HomeMenu() {
  const { loading, signOut, updateLastMage, user } = useAuth();
  const pickRandomBackground = useBackground((s) => s.pickRandom);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [guestMageId, setGuestMageId] = useState<string | null>(null);
  const [pickedMageId, setPickedMageId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const lastMageId = user?.user_metadata?.last_mage_id;
  const accountName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "JOGADOR";

  // Um evento nomeado por ação do menu; o arquivo e o volume saem do patch de
  // áudio publicado, então trocar o som é trabalho do painel, não do código.
  const soundPlay = useSoundEvent("ui:menu.play");
  const soundMage = useSoundEvent("ui:menu.magePick");
  const soundMagos = useSoundEvent("ui:menu.magos");
  const soundRanking = useSoundEvent("ui:menu.ranking");
  const soundSettings = useSoundEvent("ui:menu.ajustes");
  const soundAdmin = useSoundEvent("ui:menu.admin");
  const soundSignOut = useSoundEvent("ui:menu.signOut");

  useEffect(() => {
    if (!lastMageId) {
      setGuestMageId((current) => current ?? MAGES[Math.floor(Math.random() * MAGES.length)].id);
    }
  }, [lastMageId]);

  // Cada carregamento do menu sorteia um tema de fundo (vídeo + trilha).
  useEffect(() => {
    pickRandomBackground();
  }, [pickRandomBackground]);

  // Mago em vigor: o escolhido agora > o último salvo na conta > o de convidado.
  const effectiveMageId =
    pickedMageId ?? (typeof lastMageId === "string" ? lastMageId : null) ?? guestMageId;
  const mageConfig = useMageConfig((s) => s.config);
  const baseMage = getMage(effectiveMageId ?? "");
  const profileMage = baseMage ? applyOverride(baseMage, mageConfig) : undefined;
  const playHref = effectiveMageId ? `/play?mage=${effectiveMageId}` : "/play";
  // Tutorial: run guiada sempre com o primeiro mago (o mais simples de ensinar).
  const tutorialHref = `/play?mage=${MAGES[0].id}&tutorial=1`;
  const tutorialDone = Boolean(user?.user_metadata?.tutorial_done);

  // A INTRO do mago NÃO toca ao abrir o menu — só ao selecionar o personagem
  // (pickMage, abaixo) e no início da primeira fase da run (ver store).

  function pickMage(id: string) {
    playEvent("ui:menu.magePick");
    const picked = getMage(id);
    // No menu, a fala ao selecionar é aleatória entre as três do mago.
    if (picked) playMageLineRandom(picked, { force: true });
    setPickedMageId(id);
    setPickerOpen(false);
    if (user) void updateLastMage(id).catch(() => { });
  }

  async function handleSignOut() {
    setSignOutError("");
    setSigningOut(true);
    try {
      await signOut();
    } catch (reason) {
      setSignOutError(reason instanceof Error ? reason.message : "Não foi possível sair da conta.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="home">
      <AppBackground />

      <nav className="home-menu" aria-label="Menu principal">
        {user ? (
          <>
            <NavLink event="ui:menu.play" href={playHref} className="home-item home-item--play">
              <span className="home-item-label">JOGAR</span>
              <span className="home-item-sub">escolher mago</span>
            </NavLink>
            <NavLink event="ui:menu.play" href={tutorialHref} className="home-item home-item--play">
              <span className="home-item-label">APRENDER MAGGI</span>
              <span className="home-item-sub">{tutorialDone ? "concluído ✓ · rejogar" : "run guiada · o básico"}</span>
            </NavLink>
          </>
        ) : (
          <>
            <button type="button" className="home-item home-item--play" onClick={() => { soundPlay(); setAuthMode("login"); }}>
              <span className="home-item-label">JOGAR</span>
              <span className="home-item-sub">entrar ou cadastrar</span>
            </button>
            <button type="button" className="home-item home-item--play" onClick={() => { soundPlay(); setAuthMode("login"); }}>
              <span className="home-item-label">APRENDER MAGGI</span>
              <span className="home-item-sub">entre para começar</span>
            </button>
          </>
        )}
        <NavLink event="ui:menu.magos" href="/magos" className="home-item">
          <span className="home-item-label">MAGOS</span>
        </NavLink>
        <NavLink event="ui:menu.ranking" href="/leaderboard" className="home-item">
          <span className="home-item-label">RANKING</span>
        </NavLink>
        <button type="button" className="home-item" onClick={() => { soundSettings(); setSettingsOpen(true); }}>
          <span className="home-item-label">AJUSTES</span>
        </button>
        {!loading && user && (
          <Link href="/" className={`home-item${signingOut ? " is-loading" : ""}`} aria-busy={signingOut || undefined} onClick={() => { soundSignOut(); void handleSignOut(); }}>
            <span className="home-item-label">SAIR</span>
            {signingOut && <Spinner />}
          </Link>
        )}
        <NavLink event="ui:menu.admin" href="/admin" className="home-item">
          <span className="home-item-label">BALANCEAMENTO</span>
          <span className="home-item-tag">ADMIN</span>
        </NavLink>
      </nav>

      <section className="home-profile" aria-label="Perfil do jogador">
        {profileMage && (
          <button
            type="button"
            className={`home-profile-mage-btn ${profileMage.cutout ? "has-cutout" : ""}`}
            onClick={() => { soundMage(); setPickerOpen(true); }}
            aria-label={`Trocar mago (atual: ${profileMage.name})`}
          >
            {profileMage.cutout ? (
              <span className="home-profile-frame" style={{ ["--profile-accent" as string]: profileMage.accent }}>
                <img className="home-profile-photo" src={profileMage.portrait} alt={`Mago ${profileMage.name}`} />
              </span>
            ) : (
              <img
                className="home-profile-mage"
                src={profileMage.portrait}
                alt={`Mago ${profileMage.name}`}
                style={{ ["--profile-accent" as string]: profileMage.accent }}
              />
            )}
            {profileMage.cutout && (
              <img
                className="home-profile-cutout"
                src={profileMage.cutout}
                alt=""
                aria-hidden="true"
                style={{ ["--profile-accent" as string]: profileMage.accent }}
              />
            )}
          </button>
        )}
        <div className="home-profile-copy" aria-live="polite">
          <span className="home-profile-eyebrow">{user ? "JOGADOR" : "FALA LOGIN"}</span>
          <strong>{loading ? "CARREGANDO…" : user ? accountName : "ENTRE PARA JOGAR"}</strong>
          <small>{profileMage ? profileMage.name : "MAGGI"}</small>
          {!loading && !user && (
            <button type="button" className="home-profile-action" onClick={() => { soundPlay(); setAuthMode("signup"); }}>
              CRIAR CONTA / LOGIN
            </button>
          )}
        </div>

        {signOutError && <span className="home-profile-error" role="alert">{signOutError}</span>}
      </section>

      <div className="home-title-side">
        <img className="home-logo" src="/boargame/img/logo-game.png" alt="MAGGI" />
        <p className="home-version">ALFA 001 · VERSÃO DE TESTE</p>
      </div>

      <footer className="home-footer">MAGGI / VER. DE TESTES / NÃO REFLETE A VERSÃO FINAL</footer>
      {authMode && <AuthModal key={authMode} mode={authMode} onClose={() => setAuthMode(null)} />}
      {pickerOpen && (
        <MagePickerModal
          selectedId={effectiveMageId}
          onPick={pickMage}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </main>
  );
}
