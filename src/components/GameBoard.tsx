"use client";

// Tabuleiro em perspectiva (CSS 3D). Fileira superior troca de contexto:
// bazar (loja), gambler (roleta) ou oponente (bot/player). Fileira inferior é o
// tabuleiro do jogador com 4 slots, badge à esquerda e rack de coringas à direita.

import { useGame, type Shop, type ShopCategory } from "@/lib/store";
import { useCombatEngine } from "@/hooks/useCombatEngine";
import CardFace from "./CardFace";
import OfferTile from "./OfferTile";
import HealthBar from "./HealthBar";
import Hand from "./Hand";
import DiceConsole from "./DiceConsole";
import CardModal from "./CardModal";
import BattleResult from "./BattleResult";
import ProjectileLayer from "./ProjectileLayer";
import FogTimerLine from "./FogTimerLine";
import FogOverlay from "./FogOverlay";
import RouletteReels from "./RouletteReels";
import JokerRack from "./JokerRack";
import MergePrompt from "./MergePrompt";
import SlotCard from "./SlotCard";
import SynergyLines from "./SynergyLines";

const SHOP_META: Record<ShopCategory, { label: string; icon: string; cls: string }> = {
  dano: { label: "DANO", icon: "⚔", cls: "shop-dano" },
  cura: { label: "CURA", icon: "✚", cls: "shop-cura" },
  aceleracao: { label: "ACELERAÇÃO", icon: "⚡", cls: "shop-haste" },
  escudo: { label: "ESCUDO", icon: "⛨", cls: "shop-escudo" },
};

function ShopCard({ shop, index }: { shop: Shop; index: number }) {
  const open = useGame((s) => s.openShop);
  const meta = SHOP_META[shop.category];
  return (
    <button
      type="button"
      className={`shop-card ${meta.cls}`}
      onClick={() => open(index)}
      aria-label={`Entrar na loja de ${meta.label}`}
    >
      <span className="shop-card-icon" aria-hidden="true">{meta.icon}</span>
      <span className="shop-card-name">LOJA DE<br />{meta.label}</span>
      <span className="shop-card-count">{shop.items.length} itens</span>
    </button>
  );
}

function UpperRow() {
  const phase = useGame((s) => s.phase);
  const shops = useGame((s) => s.shops);
  const shopView = useGame((s) => s.shopView);
  const opponent = useGame((s) => s.opponent);
  const roulette = useGame((s) => s.roulette);
  const canAdvance = useGame((s) => s.canAdvance());
  const advancePhase = useGame((s) => s.advancePhase);
  const spinRoulette = useGame((s) => s.spinRoulette);
  const closeShop = useGame((s) => s.closeShop);

  const isMarket = phase === "market";
  const isRoulette = phase === "roulette";
  const isCombat = phase === "bot" || phase === "player";
  const inShop = isMarket && shopView !== null && !!shops[shopView];
  const build = opponent?.build;

  const ownerLabel = isRoulette
    ? "GAMBLER"
    : isCombat
      ? phase === "bot"
        ? "BOT"
        : "JOGADOR"
      : inShop
        ? SHOP_META[shops[shopView!].category].label
        : "BAZAR";
  const ownerImg = isCombat
    ? `/boargame/img/${build?.portrait ?? "cover.jpg"}`
    : "/boargame/img/cover.jpg";

  let offersClass = "is-combat-board";
  let tileCount = 4;
  let content: React.ReactNode = null;

  if (isMarket && !inShop) {
    offersClass = "is-shop-hub";
    tileCount = Math.max(1, shops.length);
    content = shops.map((shop, i) => <ShopCard key={shop.category} shop={shop} index={i} />);
  } else if (inShop) {
    const items = shops[shopView!].items;
    offersClass = "is-market";
    tileCount = Math.max(1, items.length);
    content =
      items.length === 0 ? (
        <p className="board-context-message">ESGOTADO</p>
      ) : (
        items.map((offer) => <OfferTile key={offer.id} offer={offer} />)
      );
  } else if (isRoulette) {
    offersClass = "is-roulette";
    tileCount = 3;
    content = <RouletteReels />;
  } else if (isCombat) {
    content = opponent?.cards.map((card, i) =>
      card ? (
        <CardFace key={card.id} card={card} context="combat" extraClass="bot-board-card" />
      ) : (
        <div key={`empty-${i}`} className="player-slot bot-empty-slot" aria-label="Slot vazio do oponente" />
      ),
    );
  }

  // Botão de avanço (AVANÇAR / RODAR); VOLTAR só dentro de uma loja.
  let advButton: React.ReactNode = null;
  if (isMarket) {
    advButton = (
      <button className="phase-next" type="button" disabled={!canAdvance} onClick={advancePhase}>
        <span aria-hidden="true">➜</span>
        <span>AVANÇAR</span>
      </button>
    );
  } else if (isRoulette) {
    advButton = roulette.spun ? (
      <button className="phase-next" type="button" disabled={!canAdvance} onClick={advancePhase}>
        <span aria-hidden="true">➜</span>
        <span>AVANÇAR</span>
      </button>
    ) : (
      <button className="phase-next phase-spin" type="button" onClick={spinRoulette}>
        <span aria-hidden="true">🎰</span>
        <span>RODAR</span>
      </button>
    );
  }

  return (
    <div className="opponent-row-layout">
      <aside
        className={`board-owner-badge ${isRoulette ? "is-gambler" : ""}`}
        aria-label={`Contexto: ${ownerLabel}`}
      >
        <img src={ownerImg} alt="" />
        <span className="board-owner-label">{ownerLabel}</span>
      </aside>

      <div className="board-row board-row-opponent" data-board-row="opponent">
        <div className="board-row-art" aria-hidden="true" />
        <div
          className={`opponent-offers ${offersClass}`}
          aria-live="polite"
          style={{ ["--tile-count" as string]: String(tileCount) }}
        >
          {content}
        </div>
      </div>

      {advButton}
      {inShop && (
        <button className="phase-next phase-back" type="button" onClick={closeShop}>
          <span aria-hidden="true">↩</span>
          <span>VOLTAR</span>
        </button>
      )}
    </div>
  );
}

function PlayerRow() {
  const slots = useGame((s) => s.slots);
  const armed = useGame((s) => s.armedJokerId);

  return (
    <div
      className={`board-row board-row-player grid grid-cols-4 gap-2 p-4 border ${armed ? "is-joker-armed" : ""}`}
      data-board-row="player"
      aria-label="Seu tabuleiro"
    >
      <div className="board-row-art" aria-hidden="true" />
      <aside className="board-owner-badge board-player-badge" aria-label="Seu personagem: jogador">
        <img src="/boargame/img/cover.jpg" alt="Ícone do jogador" />
        <span className="board-owner-label">PLAYER</span>
      </aside>
      {slots.map((card, i) => (
        <div
          key={i}
          className={`player-slot border rounded flex items-center justify-center ${card ? "is-occupied" : ""}`}
          data-slot={i + 1}
          data-slot-index={i}
          aria-label={`Slot inferior ${i + 1}`}
        >
          {card ? <SlotCard card={card} index={i} /> : <span>{i + 1}</span>}
        </div>
      ))}
      <JokerRack />
    </div>
  );
}

export default function GameBoard() {
  useCombatEngine();

  return (
    <>
      <div id="tridiv">
        <div className="scene" style={{ transform: "rotateX(-53deg) rotateY(0deg)" }}>
          <div className="shape cuboid-1 cub-1">
            <div className="face ft hidden">
              <div className="photon-shader" style={{ backgroundColor: "rgba(0,0,0,0.114)" }} />
            </div>
            <div className="face bk">
              <div className="photon-shader" style={{ backgroundColor: "rgba(0,0,0,0.486)" }} />
            </div>
            <div className="face rt">
              <div className="photon-shader" style={{ backgroundColor: "rgba(0,0,0,0.114)" }} />
            </div>
            <div className="face lt">
              <div className="photon-shader" style={{ backgroundColor: "rgba(0,0,0,0.114)" }} />
            </div>
            <div className="face bm">
              <div className="photon-shader" style={{ backgroundColor: "rgba(0,0,0,0.114)" }} />
            </div>
            <div className="face tp">
              <div className="board-stack grid grid-cols-1 photon-shader z-0">
                <UpperRow />
                <HealthBar side="opponent" />
                <HealthBar side="player" />
                <PlayerRow />
                <FogTimerLine />
              </div>
            </div>
          </div>
        </div>

        <Hand />
      </div>

      <FogOverlay />
      <SynergyLines />
      <DiceConsole />
      <ProjectileLayer />
      <MergePrompt />
      <CardModal />
      <BattleResult />
    </>
  );
}
