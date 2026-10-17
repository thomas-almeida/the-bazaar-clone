"use client";

// Tela de magos. Coluna à esquerda (mais abaixo): badge do mago atual acima de
// botões no estilo do menu principal. À direita, o deck em grade de 4 colunas
// com cartas maiores e tilt no hover; clique abre os detalhes.

import Link from "next/link";
import { useMemo, useState } from "react";
import { useGame } from "@/lib/store";
import { MAGES, PASSIVE_INFO, buildMageDeck, getMage, type Mage } from "@/lib/mages";
import { applyOverride, useMageConfig } from "@/lib/mage-config";
import { artFor } from "@/lib/arts";
import type { CardInstance, CatalogResponse, ShopCategory } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { playEvent } from "@/lib/sfx";
import { playMageLineRandom } from "@/lib/mage-voice";
import NavLink from "@/components/NavLink";
import Spinner from "@/components/Spinner";
import CardFace from "./CardFace";
import CardTipHost from "./CardTipHost";
import TiltCard from "./TiltCard";
import { useCardTip } from "@/hooks/useCardTip";

const CAT_LABEL: Record<ShopCategory, string> = {
  dano: "DANO",
  cura: "CURA",
  aceleracao: "ACEL",
  escudo: "ESCUDO",
};

/** Prévia de carta do deck do mago, com a dica flutuante ligada. */
function DeckPreviewCard({ card }: { card: CardInstance }) {
  // Telas de magos/decks não têm tier: a dica não mostra "D · BRONZE".
  const tip = useCardTip(card, { hideTier: true });
  return (
    <TiltCard>
      <CardFace
        card={card}
        context="preview"
        onPointerEnter={tip.onPointerEnter}
        onPointerLeave={tip.onPointerLeave}
      />
    </TiltCard>
  );
}

export default function MageSelect({
  catalog,
  viewOnly = false,
}: {
  catalog: CatalogResponse;
  viewOnly?: boolean;
}) {
  const init = useGame((s) => s.init);
  const { updateLastMage } = useAuth();
  const [selectedId, setSelectedId] = useState<string>(MAGES[0].id);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");
  const mageConfig = useMageConfig((s) => s.config);
  const mage = MAGES.find((m) => m.id === selectedId) as Mage;
  const view = applyOverride(mage, mageConfig); // retrato/recorte com overrides

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

  const start = async () => {
    setStarting(true);
    setStartError("");
    try {
      await updateLastMage(mage.id);
      init({
        config: catalog.config,
        cards: catalog.cards,
        farmBots: catalog.farmBots,
        rivalBuilds: catalog.rivalBuilds,
        mage,
      });
    } catch (error) {
      setStartError(error instanceof Error ? error.message : "Não foi possível salvar seu mago.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mage-select">
      <header className="mage-select-header">
        <NavLink event="ui:menu.magos" href="/" className="mage-back">← MENU</NavLink>
        <p className="mage-select-eyebrow">MAGGI · ALFA 001</p>
      </header>

      <div className="mage-body">
        <aside className="mage-rail" aria-label="Magos">
          <div className="mage-current" style={{ ["--accent" as string]: mage.accent }}>
            {/* Camada "pop-out": cópia do retrato que salta acima da moldura,
                com máscara radial escondendo as bordas (efeito de profundidade,
                estilo Bazaar). Não é recorte real do fundo — é uma ilusão de CSS
                que funciona melhor com o rosto no topo-centro da foto. */}
            <img
              className={`mage-current-pop ${view.cutout ? "is-cutout" : ""}`}
              src={view.cutout ?? view.portrait}
              alt=""
              aria-hidden="true"
            />
            <div className="mage-current-frame">
              {view.cutout ? (
                // Com recorte: a base é o vídeo de fundo do mago (sem duplicar o
                // personagem), e o PNG recortado salta por cima.
                <video className="mage-current-bg" src={view.background} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
              ) : (
                <img className="mage-current-bg" src={view.portrait} alt="" />
              )}
              <div className="mage-current-grad" aria-hidden="true" />
            </div>
            {/* Texto FORA da moldura: fica acima do recorte (que salta por
                cima), para o nome aparecer na frente até da foto. */}
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

          <div className="mage-passive" style={{ ["--accent" as string]: mage.accent }}>
            <span className="mage-passive-name font-bold">{PASSIVE_INFO[mage.passive].label}</span>
            <br />
            <span className="mage-passive-desc">{PASSIVE_INFO[mage.passive].desc}</span>
          </div>

          <nav className="mage-list">
            {MAGES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`home-item mage-item ${m.id === selectedId ? "is-selected" : ""}`}
                style={{ ["--accent" as string]: m.accent }}
                onClick={() => {
                  playEvent("ui:modal.magePick");
                  const picked = getMage(m.id);
                  if (picked) playMageLineRandom(picked, { force: true });
                  setSelectedId(m.id);
                }}
                aria-pressed={m.id === selectedId}
              >
                <span className="home-item-label">{m.name}</span>
                <span className="home-item-sub">{m.theme}</span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="mage-deck-area">
          <div className="deck-grid">
            {deck.map((card) => (
              <DeckPreviewCard key={card.id} card={card} />
            ))}
          </div>
        </section>
      </div>

      <CardTipHost />
    </div>
  );
}
