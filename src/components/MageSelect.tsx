"use client";

// Tela de magos. Coluna à esquerda (mais abaixo): badge do mago atual acima de
// botões no estilo do menu principal. À direita, o deck em grade de 4 colunas
// com cartas maiores e tilt no hover; clique abre os detalhes.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useGame } from "@/lib/store";
import { MAGES, buildMageDeck, type Mage } from "@/lib/mages";
import { artFor } from "@/lib/arts";
import type { CardInstance, CatalogResponse, ShopCategory } from "@/lib/types";
import CardFace from "./CardFace";
import CardModal from "./CardModal";
import TiltCard from "./TiltCard";

const CAT_LABEL: Record<ShopCategory, string> = {
  dano: "DANO",
  cura: "CURA",
  aceleracao: "ACEL",
  escudo: "ESCUDO",
};

export default function MageSelect({
  catalog,
  viewOnly = false,
}: {
  catalog: CatalogResponse;
  viewOnly?: boolean;
}) {
  const init = useGame((s) => s.init);
  const openModal = useGame((s) => s.openModal);
  const [selectedId, setSelectedId] = useState<string>(MAGES[0].id);
  const mage = MAGES.find((m) => m.id === selectedId) as Mage;

  const deck: CardInstance[] = useMemo(
    () =>
      buildMageDeck(mage, catalog.cards.filter((card) => card.enabled !== false)).map((def, i) => ({
        id: `preview-${mage.id}-${i}`,
        def,
        tier: 0,
        art: artFor(def, mage.video),
      })),
    [mage, catalog.cards],
  );

  const start = () =>
    init({
      config: catalog.config,
      cards: catalog.cards,
      farmBots: catalog.farmBots,
      rivalBuilds: catalog.rivalBuilds,
      mage,
    });

  return (
    <div className="mage-select">
      <header className="mage-select-header">
        <Link href="/" className="mage-back">← MENU</Link>
        <p className="mage-select-eyebrow">MAGGI · ALFA 001</p>
        <h1 className="mage-select-title">{viewOnly ? "MAGOS & DECKS" : "ESCOLHA SEU MAGO"}</h1>
      </header>

      <div className="mage-body">
        <aside className="mage-rail" aria-label="Magos">
          <div className="mage-current" style={{ ["--accent" as string]: mage.accent }}>
            <img className="mage-current-bg" src={mage.portrait} alt="" />
            <div className="mage-current-grad" aria-hidden="true" />
            <div className="mage-current-text">
              <span className="mage-current-name">{mage.name}</span>
              <span className="mage-current-theme">{mage.theme}</span>
              <span className="mage-current-spec">
                {mage.specialties.map((c) => CAT_LABEL[c]).join(" · ")}
              </span>
            </div>
          </div>

          <p className="mage-blurb" style={{ ["--accent" as string]: mage.accent }}>
            {mage.blurb}
          </p>

          <nav className="mage-list">
            {MAGES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`home-item mage-item ${m.id === selectedId ? "is-selected" : ""}`}
                style={{ ["--accent" as string]: m.accent }}
                onClick={() => setSelectedId(m.id)}
                aria-pressed={m.id === selectedId}
              >
                <span className="home-item-label">{m.name}</span>
                <span className="home-item-sub">{m.theme}</span>
              </button>
            ))}
          </nav>

          {viewOnly ? (
            <Link href="/play" className="mage-start" style={{ ["--accent" as string]: mage.accent }}>
              JOGAR
            </Link>
          ) : (
            <button
              type="button"
              className="mage-start"
              style={{ ["--accent" as string]: mage.accent }}
              onClick={start}
            >
              INICIAR RUN
            </button>
          )}
        </aside>

        <section className="mage-deck-area">
          <div className="deck-grid">
            {deck.map((card) => (
              <TiltCard key={card.id} onClick={() => openModal(card)}>
                <CardFace card={card} context="preview" />
              </TiltCard>
            ))}
          </div>
        </section>
      </div>

      <CardModal showTierDetails={false} />
    </div>
  );
}
