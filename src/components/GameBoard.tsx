"use client";

// Tabuleiro em perspectiva (CSS 3D). Fileira superior troca de contexto:
// bazar (loja), gambler (roleta) ou oponente (bot/player). Fileira inferior é o
// tabuleiro do jogador com 4 slots, badge à esquerda e rack de coringas à direita.

import { useGame, type Shop, type ShopCategory } from "@/lib/store";
import { useSoundEvent } from "@/components/useSoundEvent";
import { playEvent } from "@/lib/sfx";
import { useAuth } from "./AuthProvider";
import { PASSIVE_INFO } from "@/lib/mages";
import { applyOverride, useMageConfig } from "@/lib/mage-config";
import { useCombatEngine } from "@/hooks/useCombatEngine";
import type { AdventureOption, OpponentBuild } from "@/lib/types";
import CardFace from "./CardFace";
import OfferTile from "./OfferTile";
import HealthBar from "./HealthBar";
import Hand from "./Hand";
import DiceConsole from "./DiceConsole";
import CardTipHost from "./CardTipHost";
import BattleResult from "./BattleResult";
import ProjectileLayer from "./ProjectileLayer";
import FogTimerLine from "./FogTimerLine";
import FogOverlay from "./FogOverlay";
import JokerRack from "./JokerRack";
import MergePrompt from "./MergePrompt";
import SlotCard from "./SlotCard";
import SynergyLines from "./SynergyLines";
import PhaseIntro from "./PhaseIntro";
import VersusModal from "./VersusModal";
import TutorialOverlay from "./TutorialOverlay";

const SHOP_META: Record<ShopCategory, { label: string; icon: string; cls: string; art: string; desc: string }> = {
  dano: { label: "Jay Jay", icon: "⚔", cls: "shop-dano", art: "/boargame/img/loja-dano.jpg", desc: "Vende armas e criaturas que dão dano." },
  cura: { label: "Yaga", icon: "✚", cls: "shop-cura", art: "/boargame/img/loja-cura.jpg", desc: "Vende provisões de cura." },
  aceleracao: { label: "Billy", icon: "⚡", cls: "shop-haste", art: "/boargame/img/loja-aceleracao.jpg", desc: "Vende Feitiços de Aceleração." },
  escudo: { label: "Donavan", icon: "⛨", cls: "shop-escudo", art: "/boargame/img/loja-escudo.jpg", desc: "Forja armaduras e escudos." },
};

function ShopCard({ shop, index }: { shop: Shop; index: number }) {
  const open = useGame((s) => s.openShop);
  const openTip = useGame((s) => s.openSellerTip);
  const closeTip = useGame((s) => s.closeSellerTip);
  const soundOpen = useSoundEvent("ui:shop.open");
  const meta = SHOP_META[shop.category];
  const seller = { name: meta.label, description: meta.desc, category: shop.category };
  return (
    <button
      type="button"
      className={`shop-card ${meta.cls}`}
      onClick={() => { soundOpen(); open(index); }}
      aria-label={`Entrar na loja de ${meta.label}. ${meta.desc}`}
      onPointerEnter={(e) => {
        playEvent("ui:board.cardHover");
        openTip(seller, e.currentTarget);
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") openTip(seller, e.currentTarget);
      }}
      onPointerLeave={() => closeTip()}
    >
      <img className="shop-card-art" src={meta.art} alt="" />
      <span className="shop-card-grad" aria-hidden="true" />
    </button>
  );
}

function AdventureCard({ option }: { option: AdventureOption }) {
  const pick = useGame((s) => s.pickAdventure);
  const picked = useGame((s) => s.adventure.picked);
  const soundPick = useSoundEvent("ui:adventure.pick");
  return (
    <button
      type="button"
      className={`adventure-card adv-${option.kind} ${picked ? "is-locked" : "is-pickable"}`}
      onClick={() => {
        if (picked) return;
        soundPick();
        pick(option.id);
      }}
      disabled={picked}
      aria-label={option.title}
    >
      <span className="adv-icon" aria-hidden="true">{option.icon}</span>
      <span className="adv-title">{option.title}</span>
      <span className="adv-desc">{option.desc}</span>
    </button>
  );
}

function NpcCard({ build, index }: { build: OpponentBuild; index: number }) {
  const choose = useGame((s) => s.chooseBot);
  const soundPick = useSoundEvent("ui:bot.pick");
  return (
    <button
      type="button"
      className="npc-card"
      onClick={() => { soundPick(); choose(index); }}
      aria-label={`Enfrentar ${build.name}`}
    >
      <img className="npc-art" src={`/boargame/img/${build.portrait}`} alt="" />
      <span className="npc-grad" aria-hidden="true" />
      <span className="npc-text">
        <span className="npc-name">{build.name}</span>
        <span className="npc-go">ENFRENTAR</span>
      </span>
    </button>
  );
}

function UpperRow() {
  const phase = useGame((s) => s.phase);
  const shops = useGame((s) => s.shops);
  const shopView = useGame((s) => s.shopView);
  const opponent = useGame((s) => s.opponent);
  const adventure = useGame((s) => s.adventure);
  const botChoices = useGame((s) => s.botChoices);
  const canAdvance = useGame((s) => s.canAdvance());
  const advancePhase = useGame((s) => s.advancePhase);
  const closeShop = useGame((s) => s.closeShop);

  const isMarket = phase === "market";
  const isAdventure = phase === "adventure";
  const inShop = isMarket && shopView !== null && !!shops[shopView];
  const inBotChoice = phase === "bot" && !!botChoices;
  const showOpponentBoard = (phase === "bot" || phase === "player") && !!opponent && !inBotChoice;
  const build = opponent?.build;

  const ownerLabel = isAdventure
    ? "AVENTURA"
    : inBotChoice
      ? "OPONENTE?"
      : phase === "bot"
        ? "BOT"
        : phase === "player"
          ? "JOGADOR"
          : inShop
            ? SHOP_META[shops[shopView!].category].label
            : "BAZAR";
  const ownerImg = showOpponentBoard
    ? `/boargame/img/${build?.portrait ?? "cover-3.jpg"}`
    : isAdventure || inBotChoice
      ? "/boargame/img/the-gambler.jpg"
      : "/boargame/img/bazaar-seller.jpg";
  const isGambler = isAdventure || inBotChoice;

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
  } else if (isAdventure) {
    offersClass = "is-adventure";
    tileCount = Math.max(1, adventure.options.length);
    content = adventure.options.map((opt) => <AdventureCard key={opt.id} option={opt} />);
  } else if (inBotChoice) {
    offersClass = "is-npc-choice";
    tileCount = Math.max(1, botChoices.length);
    content = botChoices.map((b, i) => <NpcCard key={`${b.name}-${i}`} build={b} index={i} />);
  } else if (showOpponentBoard) {
    content = opponent?.cards.map((card, i) =>
      card ? (
        <CardFace key={card.id} card={card} context="combat" extraClass="bot-board-card" />
      ) : (
        <div key={`empty-${i}`} className="player-slot bot-empty-slot" aria-label="Slot vazio do oponente" />
      ),
    );
  }

  // Botão AVANÇAR só na loja e na aventura; VOLTAR só dentro de uma loja.
  const showAdvance = isMarket || isAdventure;

  return (
    <div className="opponent-row-layout">
      <aside
        className={`board-owner-badge ${isGambler ? "is-gambler" : ""}`}
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

      {showAdvance && (
        <button
          className="phase-next"
          type="button"
          disabled={!canAdvance}
          onClick={() => {
            playEvent("event:optionSelected");
            advancePhase();
          }}
        >
          <span aria-hidden="true">➜</span>
          <span>AVANÇAR</span>
        </button>
      )}
      {inShop && (
        <button
          className="phase-next phase-back"
          type="button"
          onClick={() => {
            playEvent("event:optionSelected");
            closeShop();
          }}
        >
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
  const baseMage = useGame((s) => s.mage);
  const mageConfig = useMageConfig((s) => s.config);
  const mage = baseMage ? applyOverride(baseMage, mageConfig) : null;
  const magePortrait = mage?.portrait;
  const passive = mage ? PASSIVE_INFO[mage.passive] : null;
  const { user } = useAuth();
  const username =
    (user?.user_metadata?.display_name as string | undefined)?.trim() || "JOGADOR";

  return (
    <div
      className={`board-row board-row-player grid grid-cols-4 border ${armed ? "is-joker-armed" : ""}`}
      data-board-row="player"
      data-passive={mage?.passive ?? ""}
      aria-label="Seu tabuleiro"
    >
      <div className="board-row-art" aria-hidden="true" />
      <aside
        className={`board-owner-badge board-player-badge ${mage?.cutout ? "has-cutout" : ""}`}
        aria-label={`Seu personagem: ${username}`}
        style={mage ? { ["--badge-accent" as string]: mage.accent } : undefined}
      >
        {mage?.cutout ? (
          // Com recorte: o quadro leva a borda (nítida) e recorta a foto de base
          // borrada por dentro; o recorte nítido salta por cima.
          <span className="board-badge-frame">
            <img className="board-badge-photo" src={magePortrait ?? "/boargame/img/cover-3.jpg"} alt="Ícone do jogador" />
          </span>
        ) : (
          <img src={magePortrait ?? "/boargame/img/cover-3.jpg"} alt="Ícone do jogador" />
        )}
        {mage?.cutout && (
          <img className="board-badge-cutout" src={mage.cutout} alt="" aria-hidden="true" />
        )}
        <span className="board-owner-label">{username}</span>
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
        <div className="scene" style={{ transform: "rotateX(-42deg) rotateY(0deg)" }}>
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
      <CardTipHost />
      <VersusModal />
      <PhaseIntro />
      <BattleResult />
      <TutorialOverlay />
    </>
  );
}
