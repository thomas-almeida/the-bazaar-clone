"use client";

// Página de jogo. Carrega o catálogo (/api/catalog), mostra a seleção de mago
// e só então inicia a run (store.init é chamado pela tela de seleção).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGame } from "@/lib/store";
import { getMage } from "@/lib/mages";
import type { CatalogResponse } from "@/lib/types";
import GameBoard from "@/components/GameBoard";
import MageSelect from "@/components/MageSelect";
import AppBackground from "@/components/AppBackground";
import LoadingScreen from "@/components/LoadingScreen";
import NavLink from "@/components/NavLink";
import { useAuth } from "@/components/AuthProvider";

export default function PlayPage() {
  const { loading: authLoading, user } = useAuth();
  const userId = user?.id;
  const loaded = useGame((s) => s.loaded);
  const init = useGame((s) => s.init);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  // Mago pré-selecionado no menu (?mage=): pula a tela de seleção.
  const [autoMageId, setAutoMageId] = useState<string | null>(null);
  useEffect(() => {
    setAutoMageId(new URLSearchParams(window.location.search).get("mage"));
  }, []);
  const autoMage = autoMageId ? getMage(autoMageId) : undefined;

  useEffect(() => {
    if (!catalog || loaded || !autoMage) return;
    init({
      config: catalog.config,
      cards: catalog.cards,
      farmBots: catalog.farmBots,
      rivalBuilds: catalog.rivalBuilds,
      mage: autoMage,
    });
  }, [catalog, loaded, autoMage, init]);

  useEffect(() => {
    if (authLoading || !userId) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/catalog");
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data: CatalogResponse = await res.json();
        if (!cancelled) setCatalog(data);
      } catch (error) {
        if (!cancelled) {
          setCatalogError(error instanceof Error ? error.message : "Não foi possível carregar o catálogo.");
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  if (authLoading) {
    return <LoadingScreen label="Verificando sua conta…" />;
  }

  if (!user) {
    return (
      <main className="loading-screen">
        <AppBackground />
        <h1>ENTRE PARA JOGAR</h1>
        <p>É necessário ter uma conta MAGGI para iniciar uma run.</p>
        <NavLink event="ui:menu.play" href="/" className="menu-note">← Voltar ao menu e entrar ou cadastrar</NavLink>
      </main>
    );
  }

  if (catalogError) {
    return (
      <main className="loading-screen">
        <p>Falha ao carregar o catálogo: {catalogError}</p>
        <Link href="/admin" className="menu-note">Abrir editor de balanceamento</Link>
        <NavLink event="ui:menu.play" href="/" className="menu-note">← Voltar ao menu</NavLink>
      </main>
    );
  }

  if (!catalog) {
    return <LoadingScreen label="Carregando catálogo…" />;
  }

  if (!loaded) {
    // Com mago pré-selecionado, o init() acima dispara: mostra carregando em vez
    // de piscar a tela de seleção.
    if (autoMage) {
      return <LoadingScreen label="Preparando sua run…" />;
    }
    return (
      <main>
        <AppBackground />
        <MageSelect catalog={catalog} />
      </main>
    );
  }

  return (
    <main>
      <AppBackground dim />
      <GameBoard />
    </main>
  );
}
