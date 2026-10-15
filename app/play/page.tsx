"use client";

// Página de jogo. Carrega o catálogo (/api/catalog), mostra a seleção de mago
// e só então inicia a run (store.init é chamado pela tela de seleção).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useGame } from "@/lib/store";
import type { CatalogResponse } from "@/lib/types";
import GameBoard from "@/components/GameBoard";
import MageSelect from "@/components/MageSelect";
import AppBackground from "@/components/AppBackground";

export default function PlayPage() {
  const loaded = useGame((s) => s.loaded);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  if (catalogError) {
    return (
      <main className="loading-screen">
        <p>Falha ao carregar o catálogo: {catalogError}</p>
        <Link href="/admin" className="menu-note">Abrir editor de balanceamento</Link>
        <Link href="/" className="menu-note">← Voltar ao menu</Link>
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className="loading-screen">
        <p>Carregando catálogo de cartas…</p>
        <Link href="/" className="menu-note">
          ← Voltar ao menu
        </Link>
      </main>
    );
  }

  if (!loaded) {
    return (
      <main>
        <AppBackground />
        <MageSelect catalog={catalog} />
      </main>
    );
  }

  return (
    <main>
      <AppBackground />
      <GameBoard />
    </main>
  );
}
