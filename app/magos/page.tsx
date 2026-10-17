"use client";

// Rota /magos: visualização dos magos e seus decks (somente leitura).

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CatalogResponse } from "@/lib/types";
import MageSelect from "@/components/MageSelect";
import AppBackground from "@/components/AppBackground";
import LoadingScreen from "@/components/LoadingScreen";
import NavLink from "@/components/NavLink";

export default function MagosPage() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog")
      .then((r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((d: CatalogResponse) => !cancelled && setCatalog(d))
      .catch((error: unknown) => {
        if (!cancelled) setCatalogError(error instanceof Error ? error.message : "Não foi possível carregar o catálogo.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    return <LoadingScreen label="Carregando magos…" />;
  }

  return (
    <main>
      <AppBackground />
      <MageSelect catalog={catalog} viewOnly />
    </main>
  );
}
