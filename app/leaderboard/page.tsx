"use client";

// Tela do placar de líderes. Mostra a última run de cada jogador, ordenada por
// quem concluiu a run, depois por vitórias. Abaixo de cada linha, a build final
// daquele jogador: as 4 cartas do tabuleiro, com o tier com que terminaram.

import { useEffect, useMemo, useState } from "react";
import AppBackground from "@/components/AppBackground";
import LoadingScreen from "@/components/LoadingScreen";
import NavLink from "@/components/NavLink";
import CardFace from "@/components/CardFace";
import CardTooltip from "@/components/CardTooltip";
import { artFor } from "@/lib/arts";
import { buildMageDeck, getMage } from "@/lib/mages";
import { fetchLeaderboard, type LeaderboardEntry } from "@/lib/leaderboard";
import type { CardDef, CardInstance, CatalogResponse, SnapshotSlot } from "@/lib/types";

const SLOTS = 4;

/**
 * Reconstrói a build gravada no placar usando o catálogo publicado.
 * Devolve null quando a run não tem build nenhuma (run anterior à coluna
 * `slots`, ou gravação que falhou): nesse caso a tela não desenha a grade, em
 * vez de mostrar quatro slots vazios.
 */
function buildFromSlots(
  entry: LeaderboardEntry,
  deck: Map<string, CardDef>,
): (CardInstance | null)[] | null {
  const saved = entry.slots ?? [];
  if (!saved.some((slot) => slot !== null && slot !== undefined)) return null;

  const mage = getMage(entry.mageId);
  return Array.from({ length: SLOTS }, (_, i) => {
    const slot: SnapshotSlot | null = saved[i] ?? null;
    if (!slot) return null;
    const base = deck.get(slot.cardId);
    if (!base) return null;
    // O jogador jogou com o deck reforçado do mago: aplicar o mesmo reforço
    // aqui mostra os atributos que ele realmente tinha.
    const def = mage ? buildMageDeck(mage, [base])[0] : base;
    return { id: `lb-${i}`, def, tier: slot.tier, art: artFor(def, mage?.video) };
  });
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [deck, setDeck] = useState<Map<string, CardDef> | null>(null);
  // Chave `${indiceDaLinha}-${slot}` da carta com o tooltip aberto. Os pointers
  // ficam no wrapper (não na carta) para o tooltip poder ser apontado sem
  // fechar: ele é filho do wrapper, então pointerleave não dispara.
  const [openCard, setOpenCard] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchLeaderboard().then((list) => {
      if (alive) setEntries(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  // O catálogo é público e resolve cardId -> definição. Sem ele a build não tem
  // como ser desenhada (a arte e os atributos vivem na carta, não no placar).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<CatalogResponse>) : Promise.reject(r.status)))
      .then((data) => {
        if (cancelled) return;
        setDeck(new Map((data.cards ?? []).map((card) => [card.id, card])));
      })
      .catch(() => {
        /* sem catálogo: a build simplesmente não é desenhada */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // while deck carrega, não desenha a build para evitar piscar
  const builds = useMemo(
    () => (entries && deck ? entries.map((entry) => buildFromSlots(entry, deck)) : null),
    [entries, deck],
  );

  // Mesmo loading das demais telas enquanto o placar carrega.
  if (entries === null) return <LoadingScreen label="Carregando placar…" />;

  return (
    <main className="leaderboard-page">
      <AppBackground dim />

      <header className="leaderboard-header">
        <NavLink event="ui:menu.ranking" href="/" className="mage-back">← MENU</NavLink>
        <p className="leaderboard-eyebrow">MAGGI · TEMPORADA 1</p>
        <h1 className="leaderboard-title">PLACAR DE LÍDERES</h1>
        <p className="leaderboard-note">Vale sempre a sua última run.</p>
      </header>

      <section className="leaderboard-panel" aria-live="polite">
        {entries === null ? (
          <p className="leaderboard-empty">Carregando placar…</p>
        ) : entries.length === 0 ? (
          <p className="leaderboard-empty">Ninguém pontuou ainda. Seja o primeiro a concluir uma run!</p>
        ) : (
          <ol className="leaderboard-list">
            <li className="leaderboard-row leaderboard-row--head" aria-hidden="true">
              <span className="lb-rank">#</span>
              <span className="lb-player">JOGADOR</span>
              <span className="lb-victories">VITÓRIAS</span>
              <span className="lb-status">RUN</span>
            </li>
            {entries.map((entry, i) => {
              const mage = getMage(entry.mageId);
              const build = builds?.[i] ?? null;
              return (
                <li
                  key={`${entry.displayName}-${i}`}
                  className={`leaderboard-row ${i < 3 ? `is-top is-top-${i + 1}` : ""}`}
                  style={mage ? { ["--accent" as string]: mage.accent } : undefined}
                >
                  <span className="lb-rank">{i + 1}</span>
                  <span className="lb-player">
                    {mage && <img className="lb-mage" src={mage.portrait} alt="" />}
                    <span className="lb-player-text">
                      <strong>{entry.displayName}</strong>
                      <small>{mage ? mage.name : entry.mageId}</small>
                    </span>
                  </span>
                  <span className="lb-victories">{entry.victories}</span>
                  <span className="lb-status">
                    {entry.completed ? (
                      <span className="lb-badge lb-badge--win">CONCLUÍDA</span>
                    ) : (
                      <span className="lb-badge">ELIMINADO</span>
                    )}
                  </span>

                  {build && build.some(Boolean) && (
                    <div className="leaderboard-build" aria-label="Build final">
                      {build.map((card, slot) => {
                        if (!card) {
                          return <span key={slot} className="leaderboard-build-empty" aria-hidden="true" />;
                        }
                        const key = `${i}-${slot}`;
                        return (
                          <div
                            key={slot}
                            className="leaderboard-build-slot"
                            onPointerEnter={() => setOpenCard(key)}
                            onPointerLeave={() => setOpenCard((current) => (current === key ? null : current))}
                            onClick={() => setOpenCard(key)}
                          >
                            <CardFace card={card} context="slot" className="leaderboard-build-card" />
                            {openCard === key && <CardTooltip card={card} slot={slot} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
