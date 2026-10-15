"use client";

// Rota /magos: visualização dos magos e seus decks (somente leitura).

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CatalogResponse } from "@/lib/types";
import MageSelect from "@/components/MageSelect";
import AppBackground from "@/components/AppBackground";

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
        <Link href="/" className="menu-note">← Voltar ao menu</Link>
      </main>
    );
  }

  if (!catalog) {
    return (
      <main className="loading-screen">
        <p>Carregando magos…</p>
        <Link href="/" className="menu-note">← Voltar ao menu</Link>
      </main>
    );
  }

  return (
    <main>
      <AppBackground />
      <MageSelect catalog={catalog} viewOnly />
    </main>
  );
}
