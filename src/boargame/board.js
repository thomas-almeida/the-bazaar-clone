const MAX_HAND_SIZE = 7;
const SHOP_TEST_PRICE = 1;
const INFINITE_MANA = true;
const MAX_HEALTH = 20;
const hand = document.querySelector(".card-hand");
const slots = [...document.querySelectorAll(".player-slot")];
const cardModal = document.querySelector("#card-modal");
const opponentRow = document.querySelector(".board-row-opponent");
const opponentArt = opponentRow?.querySelector(".board-row-art");
const opponentOffers = document.querySelector("#opponent-offers");
const ownerBadge = document.querySelector("#board-owner-badge");
const phaseNext = document.querySelector("#phase-next");
const manaMeter = document.querySelector("#mana-meter");
const playerHealthBar = document.querySelector("#player-health");
const opponentHealthBar = document.querySelector("#opponent-health");
const battleResult = document.querySelector("#battle-result");
const battleResultTitle = document.querySelector("#battle-result-title");
const battleResultMessage = document.querySelector("#battle-result-message");
const battleResultAction = document.querySelector("#battle-result-action");
const modalArt = cardModal?.querySelector(".card-modal-art");
const modalName = cardModal?.querySelector("#modal-card-name");
const modalType = cardModal?.querySelector(".card-modal-type");
const modalStats = cardModal?.querySelector(".card-modal-stats");
const modalDescription = cardModal?.querySelector(".card-modal-description");

if (hand && slots.length !== 4) {
  throw new Error(`Expected 4 lower board slots, found ${slots.length}.`);
}

const handCards = hand ? [...hand.querySelectorAll(".hand-card")] : [];

if (handCards.length > MAX_HAND_SIZE) {
  throw new Error(`The player's hand cannot contain more than ${MAX_HAND_SIZE} cards.`);
}

const imageArts = [
  { kind: "image", src: "img/cover.jpg" },
  { kind: "image", src: "img/cover-2.jpg" },
  { kind: "image", src: "img/cover-3.jpg" },
  { kind: "image", src: "img/cover-4.jpg" },
];
const videoArts = [
  { kind: "video", src: "img/video-1.mp4", poster: "img/cover.jpg" },
  { kind: "video", src: "img/video-2.mp4", poster: "img/cover-2.jpg" },
  { kind: "video", src: "img/video-3.mp4", poster: "img/cover-3.jpg" },
  { kind: "video", src: "img/video-4.mp4", poster: "img/cover-4.jpg" },
];
const cardTypes = [
  { name: "creature", className: "type-creature", label: "CRIATURA" },
  { name: "spell", className: "type-spell", label: "FEITIÇO" },
];
const shopDeck = [
  { name: "DRAGON WHELP", kind: "creature", level: 1, cost: 4, cooldown: 4, damage: 2, description: "A fierce little dragon ready to join the fight." },
  { name: "PHOENIX LORD", kind: "creature", level: 3, cost: 7, cooldown: 5, damage: 4, description: "When destroyed, return to your hand and deal 3 damage to all enemies." },
  { name: "HEALING RAIN", kind: "spell", cost: 3, cooldown: 3, effectType: "healing", effectValue: 4, description: "Restore 4 health to all friendly creatures." },
  { name: "MOONLIT MAGE", kind: "creature", level: 2, cost: 5, cooldown: 4, damage: 3, description: "At the start of your turn, deal 1 damage to all enemies." },
  { name: "EMBER SPRITE", kind: "creature", level: 1, cost: 2, cooldown: 2, damage: 1, description: "A quick spark that strikes before the enemy can react." },
  { name: "TIDE GUARDIAN", kind: "creature", level: 2, cost: 4, cooldown: 4, damage: 2, description: "A steady defender that keeps the frontline safe." },
  { name: "THORN BEAST", kind: "creature", level: 2, cost: 3, cooldown: 3, damage: 2, description: "A thorny beast with a reliable attack." },
  { name: "STARFALL", kind: "spell", cost: 2, cooldown: 2, effectType: "damage", effectValue: 3, description: "Deal 3 damage with a focused burst of astral energy." },
  { name: "ARCANE BARRIER", kind: "spell", cost: 3, cooldown: 4, effectType: "shield", effectValue: 3, description: "Grant 3 shield to all friendly creatures." },
];
const effectPopups = {
  damage: { icon: "⚔", label: "Dano", className: "damage" },
  healing: { icon: "✚", label: "Cura", className: "healing" },
  shield: { icon: "⛨", label: "Escudo", className: "shield" },
};
const farmBots = [
  {
    name: "MAGO DAS BRASAS",
    portrait: "img/cover-2.jpg",
    background: "img/cover-2.jpg",
    deck: ["EMBER SPRITE", "PHOENIX LORD", "ARCANE BARRIER"],
  },
  {
    name: "ORÁCULO DA MARÉ",
    portrait: "img/cover-3.jpg",
    background: "img/cover-3.jpg",
    deck: ["TIDE GUARDIAN", "HEALING RAIN", "ARCANE BARRIER"],
  },
  {
    name: "DRUIDA DO BOSQUE",
    portrait: "img/cover-4.jpg",
    background: "img/cover-4.jpg",
    deck: ["THORN BEAST", "MOONLIT MAGE", "ARCANE BARRIER"],
  },
];
const rivalBuilds = [
  {
    name: "DUELISTA DAS CINZAS",
    portrait: "img/cover.jpg",
    background: "img/cover.jpg",
    deck: ["EMBER SPRITE", "DRAGON WHELP", "PHOENIX LORD", "STARFALL"],
  },
  {
    name: "GUARDIÃ DA MARÉ",
    portrait: "img/cover-2.jpg",
    background: "img/cover-2.jpg",
    deck: ["TIDE GUARDIAN", "HEALING RAIN", "MOONLIT MAGE", "ARCANE BARRIER"],
  },
  {
    name: "CAMPEÃO DO BOSQUE",
    portrait: "img/cover-3.jpg",
    background: "img/cover-3.jpg",
    deck: ["THORN BEAST", "MOONLIT MAGE", "PHOENIX LORD", "HEALING RAIN"],
  },
];
const maxMana = 10;
let currentPhase = "market";
let currentMana = 0;
let hasRolledThisMarket = false;
let currentOffers = [];
let currentFarmBot = null;
let currentRival = null;

function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createBoardArt(art) {
  const media = document.createElement(art.kind === "video" ? "video" : "img");

  if (art.kind === "video") {
    media.src = art.src;
    media.poster = art.poster;
    media.autoplay = true;
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.preload = "metadata";
  } else {
    media.src = art.src;
    media.alt = "";
  }

  return media;
}

function randomizeBoardArt() {
  const rows = [...document.querySelectorAll(".board-row-art")];
  const arts = shuffle([...imageArts, ...videoArts]);

  if (rows.length !== 2) {
    throw new Error(`Expected 2 board rows, found ${rows.length}.`);
  }

  rows.forEach((row, index) => {
    row.replaceChildren(createBoardArt(arts[index]));
  });
}

function randomizeCards(cards) {
  const videoCount = Math.min(2, cards.length);
  const shuffledArts = shuffle([
    ...shuffle(imageArts).slice(0, cards.length - videoCount),
    ...shuffle(videoArts).slice(0, videoCount),
  ]);

  cards.forEach((card, index) => {
    const cardArt = card.querySelector(".card-art");
    const cardInfo = card.querySelector(".card-info");
    const typeLabel = cardInfo?.querySelector(".card-type");
    const kind = card.dataset.kind;
    const type = cardTypes.find((cardType) => cardType.name === kind);
    if (!cardArt || !cardInfo || !typeLabel || !type) {
      throw new Error("A card is missing its art or card information container.");
    }

    const art = shuffledArts[index % shuffledArts.length];
    card.classList.remove("type-creature", "type-spell", "video-card");
    card.classList.add(type.className);
    typeLabel.textContent = type.label;

    if (art.kind === "video") {
      const video = createBoardArt(art);
      video.className = "card-art-video";
      video.setAttribute("aria-hidden", "true");
      cardArt.replaceChildren(video);
      card.classList.add("video-card");
    } else {
      cardArt.replaceChildren(createBoardArt(art));
    }
  });
}

randomizeBoardArt();
randomizeCards(handCards);
const initialHandCards = handCards.map((card) => card.cloneNode(true));

function setupCardCooldown(card) {
  const duration = Number(card.dataset.cooldown) * 1000;
  const effectType = card.dataset.effectType || (card.dataset.damage ? "damage" : "");
  const effectValue = Number(card.dataset.effectValue ?? card.dataset.damage);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Card "${card.dataset.kind}" must have a positive cooldown.`);
  }

  if (effectType) {
    const popup = effectPopups[effectType];
    if (!popup || !Number.isFinite(effectValue) || effectValue < 0) {
      throw new Error(`Card "${card.dataset.kind}" has an invalid ${effectType} effect.`);
    }
    let effectPop = card.querySelector(".card-effect-pop");
    if (!effectPop) {
      effectPop = document.createElement("span");
      effectPop.className = `card-effect-pop card-effect-pop--${popup.className}`;
      effectPop.setAttribute("aria-hidden", "true");
      const icon = document.createElement("span");
      icon.className = "card-effect-icon";
      icon.textContent = popup.icon;
      const value = document.createElement("span");
      value.className = "card-effect-value";
      value.textContent = String(effectValue);
      effectPop.append(icon, value);
      card.append(effectPop);
    }

    card.addEventListener("card-cooldown-complete", (event) => {
      if (!battleActive || event.detail.effectType !== effectType || !Number.isFinite(event.detail.value)) return;
      card.classList.remove("effect-pop-active");
      void effectPop.offsetWidth;
      card.classList.add("effect-pop-active");
      applyCombatEffect(card, event.detail.effectType, event.detail.value);
    });
    effectPop.addEventListener("animationend", () => {
      card.classList.remove("effect-pop-active");
    });
  }

  card.classList.remove("cooldown-active");
  card.style.setProperty("--cooldown-progress", "0%");
  card.style.setProperty("--cooldown-charge", "0");
  card.dataset.cooldownSetup = "true";
}

function startCardCooldown(card) {
  if (!battleActive || !card.isConnected) return;
  if (card.dataset.cooldownSetup !== "true") setupCardCooldown(card);
  const duration = Number(card.dataset.cooldown) * 1000;
  const effectType = card.dataset.effectType || (card.dataset.damage ? "damage" : "");
  const effectValue = Number(card.dataset.effectValue ?? card.dataset.damage);
  const runId = (Number(card.dataset.cooldownRunId) || 0) + 1;
  card.dataset.cooldownRunId = String(runId);
  card.classList.add("cooldown-active");
  card.style.setProperty("--cooldown-progress", "0%");
  card.style.setProperty("--cooldown-charge", "0");
  let startedAt = performance.now();

  const updateCooldown = (now) => {
    if (!battleActive || !card.isConnected || card.dataset.cooldownRunId !== String(runId)) return;
    const elapsed = now - startedAt;
    const completedCycles = Math.floor(elapsed / duration);

    if (completedCycles > 0) {
      card.classList.add("is-firing");
      window.setTimeout(() => card.classList.remove("is-firing"), 240);
      for (let cycle = 0; cycle < completedCycles; cycle += 1) {
        card.dispatchEvent(new CustomEvent("card-cooldown-complete", {
          bubbles: true,
          detail: {
            card,
            effectType,
            value: Number.isFinite(effectValue) ? effectValue : 0,
          },
        }));
      }
      startedAt += completedCycles * duration;
    }

    const progress = (now - startedAt) / duration;
    card.style.setProperty("--cooldown-progress", `${progress * 100}%`);
    card.style.setProperty("--cooldown-charge", String(progress));

    requestAnimationFrame(updateCooldown);
  };

  requestAnimationFrame(updateCooldown);
}

let playerHealth = MAX_HEALTH;
let opponentHealth = MAX_HEALTH;
let playerShield = 0;
let opponentShield = 0;
let battleActive = false;
let battleWinner = null;
let battleOpponent = null;

function updateCombatHealthBar(bar, hp, shield, label) {
  if (!bar) throw new Error(`The ${label} health bar is missing.`);
  const clampedHealth = Math.max(0, Math.min(MAX_HEALTH, hp));
  bar.style.setProperty("--health-percent", `${(clampedHealth / MAX_HEALTH) * 100}%`);
  bar.setAttribute("aria-valuenow", String(clampedHealth));
  bar.setAttribute("aria-valuemax", String(MAX_HEALTH));
  bar.setAttribute(
    "aria-label",
    `Vida ${label}: ${clampedHealth} de ${MAX_HEALTH}${shield > 0 ? `; escudo ${shield}` : ""}`,
  );
  bar.setAttribute(
    "aria-valuetext",
    shield > 0
      ? `${clampedHealth} de ${MAX_HEALTH} de vida; escudo ${shield}`
      : `${clampedHealth} de ${MAX_HEALTH} de vida`,
  );
  const value = bar.querySelector(".battle-health-value");
  const shieldFill = bar.querySelector(".battle-shield-fill");
  const shieldValue = bar.querySelector(".battle-shield");
  const effect = bar.querySelector(".battle-health-effect");
  if (!value || !shieldFill || !shieldValue || !effect) {
    throw new Error(`The ${label} health bar is missing its values.`);
  }
  value.textContent = String(clampedHealth);
  shieldFill.style.setProperty("--shield-percent", `${Math.min(100, (shield / MAX_HEALTH) * 100)}%`);
  shieldFill.hidden = shield <= 0;
  shieldValue.hidden = shield <= 0;
  shieldValue.textContent = shield > 0 ? `⛨ ${shield} ESCUDO` : "";
}

function showCombatHealthEffect(bar, effectType, value) {
  if (value <= 0) return;
  const effect = bar.querySelector(".battle-health-effect");
  const popup = effectPopups[effectType];
  if (!effect || !popup) throw new Error(`The ${effectType} health effect is missing its UI.`);
  effect.textContent = `${popup.icon} ${value}`;
  effect.className = `battle-health-effect battle-health-effect--${popup.className}`;
  void effect.offsetWidth;
  effect.classList.add("is-active");
}

function updateCombatHealthBars() {
  updateCombatHealthBar(playerHealthBar, playerHealth, playerShield, "do jogador");
  updateCombatHealthBar(opponentHealthBar, opponentHealth, opponentShield, "do adversário");
}

function showBattleResult(winner) {
  battleActive = false;
  battleWinner = winner;
  document.querySelectorAll(".cooldown-active").forEach((card) => {
    card.classList.remove("cooldown-active", "is-firing", "effect-pop-active");
    card.style.setProperty("--cooldown-progress", "0%");
    card.style.setProperty("--cooldown-charge", "0");
  });

  if (!battleResult || !battleResultTitle || !battleResultMessage || !battleResultAction) {
    throw new Error("The battle result dialog is missing required elements.");
  }
  battleResultTitle.textContent = winner === "player" ? "VOCÊ VENCEU!" : "VOCÊ PERDEU";
  battleResultMessage.textContent = winner === "player"
    ? `${battleOpponent?.name ?? "O adversário"} foi derrotado.`
    : "Sua vida chegou a zero. Reinicie a run para tentar novamente.";
  battleResultAction.textContent = winner === "player" ? "CONTINUAR" : "REINICIAR RUN";
  battleResult.hidden = false;
  battleResultAction.focus();
  updatePhaseControls();
}

function resolveBattleEffect(side, effectType, value) {
  if (!battleActive || !Number.isFinite(value) || value < 0) return;
  const isPlayer = side === "player";
  let healthBar = isPlayer ? playerHealthBar : opponentHealthBar;
  let actualEffect = effectType;
  let actualValue = value;

  if (effectType === "damage") {
    const targetIsPlayer = !isPlayer;
    const targetShield = targetIsPlayer ? playerShield : opponentShield;
    const previousHealth = targetIsPlayer ? playerHealth : opponentHealth;
    let remainingDamage = value;
    const absorbed = Math.min(targetShield, remainingDamage);
    remainingDamage -= absorbed;
    const healthDamage = Math.min(previousHealth, remainingDamage);
    actualValue = healthDamage > 0 ? healthDamage : absorbed;
    actualEffect = healthDamage > 0 ? "damage" : "shield";
    if (targetIsPlayer) {
      playerShield = targetShield - absorbed;
      playerHealth = Math.max(0, playerHealth - remainingDamage);
      healthBar = playerHealthBar;
    } else {
      opponentShield = targetShield - absorbed;
      opponentHealth = Math.max(0, opponentHealth - remainingDamage);
      healthBar = opponentHealthBar;
    }
  } else if (effectType === "healing") {
    const previousHealth = isPlayer ? playerHealth : opponentHealth;
    if (isPlayer) playerHealth = Math.min(MAX_HEALTH, playerHealth + value);
    else opponentHealth = Math.min(MAX_HEALTH, opponentHealth + value);
    actualValue = (isPlayer ? playerHealth : opponentHealth) - previousHealth;
  } else if (effectType === "shield") {
    if (isPlayer) playerShield += value;
    else opponentShield += value;
  } else {
    throw new Error(`Unsupported combat effect "${effectType}".`);
  }
  const affectedPlayer = effectType === "damage" ? !isPlayer : isPlayer;
  const resultingHealth = affectedPlayer ? playerHealth : opponentHealth;
  updateCombatHealthBars();
  if (actualValue > 0) {
    healthBar?.classList.remove("is-damaged", "is-healed", "is-shielded");
    if (actualEffect === "damage") healthBar?.classList.add("is-damaged");
    else if (actualEffect === "healing") healthBar?.classList.add("is-healed");
    else if (actualEffect === "shield") healthBar?.classList.add("is-shielded");
    showCombatHealthEffect(healthBar, actualEffect, actualValue);
    window.setTimeout(() => healthBar?.classList.remove("is-damaged", "is-healed", "is-shielded"), 360);
  }

  if (resultingHealth <= 0) showBattleResult(isPlayer ? "player" : "opponent");
}

function applyCombatEffect(card, effectType, value) {
  const side = card.closest(".player-slot") ? "player" : "opponent";
  resolveBattleEffect(side, effectType, value);
}

function startBattle(opponent) {
  if (!opponent) throw new Error("Cannot start battle without an opponent build.");
  battleActive = true;
  battleWinner = null;
  battleOpponent = opponent;
  opponentHealth = MAX_HEALTH;
  opponentShield = 0;
  if (!opponentHealthBar) throw new Error("The opponent health bar is missing.");
  opponentHealthBar.hidden = false;
  updateCombatHealthBars();
  document.querySelectorAll(".player-slot > .hand-card, #opponent-offers.is-combat-board > .hand-card")
    .forEach(startCardCooldown);
  updatePhaseControls();
}

function closeBattleResult() {
  if (battleResult) battleResult.hidden = true;
}

function restartRun() {
  battleActive = false;
  battleWinner = null;
  battleOpponent = null;
  closeBattleResult();
  slots.forEach((slot) => {
    slot.replaceChildren();
    slot.classList.remove("is-occupied", "is-drop-target");
  });
  const freshCards = initialHandCards.map((card) => card.cloneNode(true));
  hand?.replaceChildren(...freshCards);
  freshCards.forEach((card) => {
    setupTilt(card);
    setupDragging(card);
    card.addEventListener("click", () => {
      if (card.parentElement !== hand) openCardModal(card);
    });
  });
  playerHealth = MAX_HEALTH;
  opponentHealth = MAX_HEALTH;
  playerShield = 0;
  opponentShield = 0;
  currentMana = 0;
  currentFarmBot = null;
  currentRival = null;
  updateCombatHealthBars();
  updateHandPositions();
  updateManaDisplay();
  startMarketRound();
}

function createCardElement(definition) {
  const card = document.createElement("article");
  const kind = cardTypes.find((type) => type.name === definition.kind);
  const art = shuffle([...imageArts, ...videoArts])[0];
  if (!kind || !art) throw new Error("A shop card has an invalid type or missing art.");

  card.className = `hand-card ${kind.className}`;
  card.dataset.kind = definition.kind;
  card.dataset.cost = String(definition.cost);
  card.dataset.cooldown = String(definition.cooldown);
  if (definition.level !== undefined) card.dataset.level = String(definition.level);
  if (definition.damage !== undefined) card.dataset.damage = String(definition.damage);
  const effectType = definition.effectType ?? (definition.damage !== undefined ? "damage" : undefined);
  const effectValue = definition.effectValue ?? definition.damage;
  if (effectType !== undefined) {
    if (!effectPopups[effectType] || !Number.isFinite(effectValue) || effectValue < 0) {
      throw new Error(`Card "${definition.name}" has an invalid ${effectType} effect.`);
    }
    card.dataset.effectType = effectType;
    card.dataset.effectValue = String(effectValue);
  }

  const header = document.createElement("header");
  header.className = "card-header";
  const name = document.createElement("span");
  name.textContent = definition.name;
  const cost = document.createElement("span");
  cost.className = "card-cost";
  cost.textContent = String(definition.cost);
  header.append(name, cost);

  const cardArt = document.createElement("div");
  cardArt.className = "card-art";
  cardArt.setAttribute("aria-hidden", "true");
  const media = createBoardArt(art);
  if (art.kind === "video") media.className = "card-art-video";
  cardArt.append(media);

  const info = document.createElement("div");
  info.className = "card-info";
  const type = document.createElement("div");
  type.className = "card-type";
  type.textContent = kind.label;
  info.append(type);

  if (definition.kind === "creature") {
    const level = document.createElement("div");
    level.className = "card-level";
    level.textContent = `LEVEL ${definition.level}`;
    info.append(level);
  }

  const stats = document.createElement("div");
  stats.className = "card-stats";
  if (definition.damage !== undefined) {
    const damage = document.createElement("span");
    damage.className = "card-damage";
    damage.textContent = `⚔ ${definition.damage}`;
    stats.append(damage);
  }
  const cooldown = document.createElement("span");
  cooldown.className = "card-cooldown";
  cooldown.textContent = `⏱ ${definition.cooldown}s`;
  stats.append(cooldown);
  info.append(stats);

  const description = document.createElement("p");
  description.className = "card-description";
  description.textContent = definition.description;
  info.append(description);

  if (art.kind === "video") {
    card.classList.add("video-card");
    card.append(cardArt, header, info);
  } else {
    card.append(header, cardArt, info);
  }

  return card;
}

function updateManaDisplay() {
  if (manaMeter) {
    const pips = [...manaMeter.querySelectorAll(".mana-pips span")];
    pips.forEach((pip, index) => pip.classList.toggle("is-filled", INFINITE_MANA || index < currentMana));
    const manaValue = manaMeter.querySelector("#mana-value");
    if (!manaValue) throw new Error("The mana meter is missing its current/maximum value.");
    manaValue.textContent = INFINITE_MANA ? "∞" : `${currentMana}/${maxMana}`;
    manaMeter.setAttribute("aria-valuenow", String(INFINITE_MANA ? maxMana : currentMana));
    manaMeter.setAttribute(
      "aria-label",
      INFINITE_MANA ? "Mana infinita" : `Mana atual: ${currentMana} de ${maxMana}`,
    );
  }

  updateHandSummonStates();
  updatePhaseControls();
}

function getCardSummonCost(card) {
  const cost = Number(card.dataset.cost);
  if (!Number.isFinite(cost) || cost < 0) {
    throw new Error(`Card "${card.dataset.kind}" must have a non-negative mana cost.`);
  }
  return cost;
}

function hasEnoughMana(cost) {
  return INFINITE_MANA || currentMana >= cost;
}

function hasInvokedCards() {
  return slots.some((slot) => slot.querySelector(".hand-card"));
}

function updateHandSummonStates() {
  if (!hand) return;
  hand.querySelectorAll(".hand-card").forEach((card) => {
    const cost = getCardSummonCost(card);
    const canSummon = currentPhase === "market" && hasEnoughMana(cost);
    card.classList.toggle("is-summonable", canSummon);
    card.classList.toggle("is-unaffordable", !canSummon);
    card.setAttribute(
      "aria-label",
      `${card.querySelector(".card-header span")?.textContent ?? "Carta"}, custo ${cost} de mana. ${
        canSummon ? "Pode ser invocada." : "Mana insuficiente ou fase de invocação indisponível."
      }`,
    );
    card.title = canSummon
      ? `Arraste para o tabuleiro para invocar por ${cost} de mana.`
      : currentPhase !== "market"
        ? "Cartas só podem ser invocadas na fase de loja."
        : `Mana insuficiente: precisa de ${cost}, disponível ${currentMana}.`;
  });
}

function updatePhaseControls() {
  if (!phaseNext) return;
  const canAdvance = currentPhase === "market" && !battleActive && hasRolledThisMarket && hasInvokedCards();
  phaseNext.disabled = !canAdvance;
  phaseNext.title = currentPhase !== "market"
    ? "O combate termina antes de avançar."
    : !hasRolledThisMarket
      ? "Role o dado na fase de loja antes de avançar."
      : !hasInvokedCards()
        ? "Invoque ao menos uma carta no seu tabuleiro antes de avançar."
        : "Avance para a próxima fase.";
}

function setOpponentArt(art) {
  if (!opponentArt) throw new Error("The opponent board is missing its background container.");
  opponentArt.replaceChildren(createBoardArt(art));
}

function createOfferTile(offer, index) {
  const button = document.createElement("button");
  const price = SHOP_TEST_PRICE;
  const handCount = hand?.querySelectorAll(".hand-card").length ?? MAX_HAND_SIZE;
  const canPurchase = currentPhase === "market" && hasEnoughMana(price) && handCount < MAX_HAND_SIZE;
  button.className = "offer-tile";
  button.classList.toggle("is-purchasable", canPurchase);
  button.classList.toggle("is-draggable", canPurchase);
  button.classList.toggle("is-unavailable", !canPurchase);
  button.type = "button";
  button.dataset.offerIndex = String(index);
  button.setAttribute("aria-label", `${offer.name}, ${price} de mana. Clique para ver detalhes.`);
  button.title = handCount >= MAX_HAND_SIZE
      ? "Clique para ver detalhes. Mão cheia: coloque uma carta no tabuleiro antes de comprar."
      : !hasEnoughMana(price)
        ? `Clique para ver detalhes. Mana insuficiente: arraste para a mão quando tiver ${price} de mana.`
        : `Clique para ver detalhes ou arraste para a mão para comprar por ${price} de mana.`;

  const art = document.createElement("span");
  art.className = "offer-tile-art";
  const cardArt = offer.art;
  if (!cardArt) throw new Error("The shop has no card art available.");
  const media = createBoardArt(cardArt);
  if (cardArt.kind === "video") media.className = "card-art-video";
  art.append(media);

  const details = document.createElement("span");
  details.className = "offer-tile-details";
  const name = document.createElement("span");
  name.className = "offer-tile-name";
  name.textContent = offer.name;
  const itemType = document.createElement("span");
  itemType.className = "offer-tile-type";
  itemType.textContent = offer.kind === "creature" ? `CRIATURA · NÍVEL ${offer.level}` : "FEITIÇO";
  const description = document.createElement("span");
  description.className = "offer-tile-description";
  description.textContent = offer.description;
  const priceTag = document.createElement("span");
  priceTag.className = "card-cost offer-tile-price offer-tile-cost";
  priceTag.textContent = String(price);
  details.append(name, itemType, description);
  button.append(art, details, priceTag);
  setupOfferDragging(button);
  button.addEventListener("click", () => {
    if (button.dataset.wasDragged === "true") {
      delete button.dataset.wasDragged;
      return;
    }
    openCardModal(createCardElement(offer));
  });
  return button;
}

function renderOpponentCombatBoard(owner, emptySlotLabel) {
  if (owner.deck.length > 4) throw new Error(`Opponent "${owner.name}" has more cards than board slots.`);
  opponentOffers.classList.add("is-combat-board");
  opponentOffers.style.setProperty("--tile-count", "4");

  owner.deck.forEach((cardName) => {
    const definition = shopDeck.find((card) => card.name === cardName);
    if (!definition) throw new Error(`Opponent deck references unknown card "${cardName}".`);
    const card = createCardElement(definition);
    card.classList.add("bot-board-card");
    const effectType = definition.effectType ?? (definition.damage !== undefined ? "damage" : "");
    const effectDescription = effectType
      ? `${effectPopups[effectType].label.toLowerCase()} ${definition.effectValue ?? definition.damage}, `
      : "";
    card.setAttribute(
      "aria-label",
      `${definition.name}, ${definition.kind === "creature" ? `nível ${definition.level}, ` : ""}${effectDescription}recarga ${definition.cooldown} segundos`,
    );
    opponentOffers.append(card);
    setupCardCooldown(card);
  });

  for (let index = owner.deck.length; index < 4; index += 1) {
    const emptySlot = document.createElement("div");
    emptySlot.className = "player-slot bot-empty-slot";
    emptySlot.setAttribute("aria-label", emptySlotLabel);
    opponentOffers.append(emptySlot);
  }
}

function renderUpperBoard() {
  if (!opponentRow || !opponentOffers || !ownerBadge || !phaseNext) {
    throw new Error("The modular opponent board is missing required UI elements.");
  }

  if (die) die.disabled = currentPhase !== "market" || hasRolledThisMarket;
  updateHandSummonStates();
  opponentOffers.replaceChildren();
  opponentOffers.classList.remove("is-market", "is-encounter", "is-farm", "is-combat-board");
  updatePhaseControls();
  phaseNext.setAttribute(
    "aria-label",
    currentPhase === "market"
      ? "Avançar para a fase de farm"
      : currentPhase === "farm"
        ? "Avançar para a fase de rival"
        : "Avançar para a próxima fase",
  );

  if (currentPhase === "market") {
    opponentRow.setAttribute("aria-label", "Ofertas do bazar");
    const ownerIcon = ownerBadge.querySelector(".board-owner-icon");
    if (ownerIcon) ownerIcon.textContent = "🏪";
    const ownerImage = ownerBadge.querySelector("img");
    if (ownerImage) ownerImage.src = "img/cover.jpg";
    ownerBadge.querySelector(".board-owner-label").textContent = "BAZAR";
    ownerBadge.setAttribute("aria-label", "Contexto atual: Bazar");
    opponentOffers.classList.add("is-market");
    opponentOffers.style.setProperty("--tile-count", String(Math.max(1, currentOffers.length)));
    if (currentOffers.length === 0) {
      const empty = document.createElement("p");
      empty.className = "board-context-message";
      empty.textContent = "OFERTAS ESGOTADAS";
      opponentOffers.append(empty);
    } else {
      currentOffers.forEach((offer, index) => opponentOffers.append(createOfferTile(offer, index)));
    }
    setOpponentArt({ kind: "image", src: "img/tapete.jpg" });
    return;
  }

  if (currentPhase === "farm") {
    if (!currentFarmBot) throw new Error("The farm phase is missing its selected NPC mage.");
    const ownerImage = ownerBadge.querySelector("img");
    if (ownerImage) ownerImage.src = currentFarmBot.portrait;
    ownerBadge.querySelector(".board-owner-label").textContent = "MAGO NPC";
    ownerBadge.setAttribute("aria-label", `Farm contra ${currentFarmBot.name}`);
    opponentRow.setAttribute("aria-label", `Tabuleiro de ${currentFarmBot.name}`);
    opponentOffers.classList.add("is-farm");
    renderOpponentCombatBoard(currentFarmBot, "Slot vazio do mago NPC");
    setOpponentArt({ kind: "image", src: currentFarmBot.background });
    return;
  }

  if (!currentRival) throw new Error("The rival phase is missing its selected player build.");
  const ownerImage = ownerBadge.querySelector("img");
  if (ownerImage) ownerImage.src = currentRival.portrait;
  ownerBadge.querySelector(".board-owner-label").textContent = "RIVAL";
  ownerBadge.setAttribute("aria-label", `Build do jogador rival: ${currentRival.name}`);
  opponentRow.setAttribute("aria-label", `Tabuleiro de ${currentRival.name}`);
  renderOpponentCombatBoard(currentRival, "Slot vazio do rival");
  setOpponentArt({ kind: "image", src: currentRival.background });
}

function startMarketRound() {
  battleActive = false;
  closeBattleResult();
  if (opponentHealthBar) opponentHealthBar.hidden = true;
  currentPhase = "market";
  hasRolledThisMarket = false;
  const offerCount = 1 + Math.floor(Math.random() * 4);
  currentOffers = shuffle(shopDeck)
    .slice(0, offerCount)
    .map((offer) => ({ ...offer, art: shuffle([...imageArts, ...videoArts])[0] }));
  if (die) {
    die.disabled = false;
    dieResult.textContent = "Role para ganhar mana";
    die.setAttribute("aria-label", "Rolar dado para ganhar mana");
  }
  renderUpperBoard();
}

function buyOffer(index) {
  const offer = currentOffers[index];
  if (currentPhase !== "market" || !offer) return;
  const price = SHOP_TEST_PRICE;
  if (!hasEnoughMana(price) || hand.querySelectorAll(".hand-card").length >= MAX_HAND_SIZE) return;

  if (!INFINITE_MANA) currentMana -= price;
  const card = createCardElement(offer);
  hand.append(card);
  setupTilt(card);
  setupDragging(card);
  card.addEventListener("click", () => {
    if (card.parentElement !== hand) openCardModal(card);
  });
  currentOffers.splice(index, 1);
  updateHandPositions();
  updateManaDisplay();
  renderUpperBoard();
}

function setupOfferDragging(button) {
  let drag = null;

  const clearDropTarget = () => hand?.classList.remove("is-drop-target");
  const isOverHand = (x, y) => {
    if (!hand) return false;
    const bounds = hand.getBoundingClientRect();
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  };

  const endDrag = (event, shouldDrop) => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    const droppedOnHand = shouldDrop && drag.moved && isOverHand(event.clientX, event.clientY);
    if (drag.moved && shouldDrop) button.dataset.wasDragged = "true";
    document.removeEventListener("pointermove", moveDrag);
    document.removeEventListener("pointerup", endPointerDrag);
    document.removeEventListener("pointercancel", cancelPointerDrag);
    clearDropTarget();
    drag.preview.remove();
    button.classList.remove("is-dragging-source");
    const offerIndex = Number(button.dataset.offerIndex);
    drag = null;

    if (droppedOnHand) buyOffer(offerIndex);
  };

  const moveDrag = (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.moved) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
      drag.moved = true;
      button.classList.add("is-dragging-source");
    }

    event.preventDefault();
    drag.preview.style.setProperty("--drag-x", `${event.clientX - drag.offsetX}px`);
    drag.preview.style.setProperty("--drag-y", `${event.clientY - drag.offsetY}px`);
    hand?.classList.toggle("is-drop-target", isOverHand(event.clientX, event.clientY));
  };
  const endPointerDrag = (event) => endDrag(event, true);
  const cancelPointerDrag = (event) => endDrag(event, false);

  button.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0 ||
      !button.classList.contains("is-draggable") ||
      currentPhase !== "market"
    ) return;

    const bounds = button.getBoundingClientRect();
    const preview = button.cloneNode(true);
    preview.classList.remove("is-dragging-source");
    preview.classList.add("offer-drag-preview");
    preview.style.width = `${bounds.width}px`;
    preview.style.height = `${bounds.height}px`;
    preview.style.setProperty("--drag-x", `${bounds.left}px`);
    preview.style.setProperty("--drag-y", `${bounds.top}px`);
    document.body.append(preview);

    drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      preview,
    };
    document.addEventListener("pointermove", moveDrag);
    document.addEventListener("pointerup", endPointerDrag);
    document.addEventListener("pointercancel", cancelPointerDrag);
  });
}

function advancePhase() {
  if (currentPhase === "market") {
    if (battleActive || !hasRolledThisMarket || !hasInvokedCards()) return;
    currentPhase = "farm";
    currentFarmBot = farmBots[Math.floor(Math.random() * farmBots.length)];
  } else if (currentPhase === "farm") {
    if (battleActive || !hasInvokedCards()) return;
    currentPhase = "rival";
    currentRival = rivalBuilds[Math.floor(Math.random() * rivalBuilds.length)];
  } else {
    if (battleActive || !hasInvokedCards()) return;
    startMarketRound();
    return;
  }
  renderUpperBoard();
  startBattle(currentPhase === "farm" ? currentFarmBot : currentRival);
}

phaseNext?.addEventListener("click", advancePhase);
battleResultAction?.addEventListener("click", () => {
  if (battleWinner !== "player") {
    restartRun();
    return;
  }
  closeBattleResult();
  if (currentPhase === "farm") {
    currentPhase = "rival";
    currentRival = rivalBuilds[Math.floor(Math.random() * rivalBuilds.length)];
    renderUpperBoard();
    startBattle(currentRival);
    return;
  }
  startMarketRound();
});

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const die = document.querySelector("#roll-die");
const dieResult = document.querySelector("#dice-result");
const dieFaceRotations = {
  1: [0, 0, 0],
  2: [90, 0, 0],
  3: [0, 0, -90],
  4: [0, 0, 90],
  5: [-90, 0, 0],
  6: [180, 0, 0],
};

if (die && dieResult) {
  const dieStage = die.closest(".dice-stage");
  let currentFace = 1;
  let dragState = null;
  let suppressNextClick = false;
  die.style.setProperty("--die-x", "0deg");
  die.style.setProperty("--die-y", "0deg");
  die.style.setProperty("--die-z", "0deg");

  const readOffset = (property) => Number.parseFloat(die.style.getPropertyValue(property)) || 0;
  const setOffset = (axis, value) => {
    die.style.setProperty(`--die-offset-${axis}`, `${value}px`);
    dieStage?.style.setProperty(`--die-offset-${axis}`, `${value}px`);
  };

  const rollDie = () => {
    if (currentPhase !== "market" || hasRolledThisMarket) return;
    const nextFace = Math.floor(Math.random() * 6) + 1;
    const [endX, endY, endZ] = dieFaceRotations[nextFace];
    die.querySelectorAll(".die-face").forEach((faceElement) => {
      faceElement.classList.remove("is-result-face");
    });
    die.disabled = true;
    dieResult.textContent = "Rolando...";
    die.setAttribute("aria-label", "Dado rolando");

    if (reduceMotion) {
      finishDieRoll(nextFace);
      return;
    }

    die.style.setProperty("--roll-start-x", die.style.getPropertyValue("--die-x") || "0deg");
    die.style.setProperty("--roll-start-y", die.style.getPropertyValue("--die-y") || "0deg");
    die.style.setProperty("--roll-start-z", die.style.getPropertyValue("--die-z") || "0deg");
    die.style.setProperty("--roll-end-x", `${endX}deg`);
    die.style.setProperty("--roll-end-y", `${endY}deg`);
    die.style.setProperty("--roll-end-z", `${endZ}deg`);
    die.dataset.pendingFace = String(nextFace);
    die.classList.remove("is-rolling");
    void die.offsetWidth;
    die.classList.add("is-rolling");
  };

  const finishDieRoll = (face) => {
    const [x, y, z] = dieFaceRotations[face];
    die.querySelectorAll(".die-face").forEach((faceElement) => {
      faceElement.classList.toggle("is-result-face", Number(faceElement.dataset.value) === face);
    });
    die.style.setProperty("--die-x", `${x}deg`);
    die.style.setProperty("--die-y", `${y}deg`);
    die.style.setProperty("--die-z", `${z}deg`);
    die.classList.remove("is-rolling");
    die.disabled = true;
    currentFace = face;
    hasRolledThisMarket = true;
    if (!INFINITE_MANA) currentMana = Math.min(maxMana, currentMana + face);
    updateManaDisplay();
    renderUpperBoard();
    dieResult.textContent = INFINITE_MANA
      ? `Resultado: ${face}. Mana infinita`
      : `Resultado: ${face}. Mana: ${currentMana}`;
    die.setAttribute(
      "aria-label",
      INFINITE_MANA
        ? `Dado: ${face}. Mana infinita.`
        : `Dado: ${face}. Mana atual: ${currentMana} de ${maxMana}.`,
    );
  };

  die.addEventListener("pointerdown", (event) => {
    if (
      die.disabled ||
      currentPhase !== "market" ||
      hasRolledThisMarket ||
      !dieStage ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) return;

    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: readOffset("--die-offset-x"),
      offsetY: readOffset("--die-offset-y"),
      moved: false,
    };
    die.setPointerCapture(event.pointerId);
  });

  die.addEventListener("pointermove", (event) => {
    if (!dragState || dragState.pointerId !== event.pointerId || !dieStage) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!dragState.moved && Math.hypot(deltaX, deltaY) < 4) return;

    dragState.moved = true;
    const stageBounds = dieStage.getBoundingClientRect();
    const halfDie = die.offsetWidth / 2 + 4;
    const maxOffsetX = Math.max(0, (stageBounds.width / 2) - halfDie);
    const maxOffsetY = Math.max(0, (stageBounds.height / 2) - halfDie);

    setOffset("x", Math.max(-maxOffsetX, Math.min(maxOffsetX, dragState.offsetX + deltaX)));
    setOffset("y", Math.max(-maxOffsetY, Math.min(maxOffsetY, dragState.offsetY + deltaY)));
    die.classList.add("is-dragging");
  });

  const finishDieDrag = (event, shouldRoll) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const dragged = dragState.moved;
    dragState = null;
    die.classList.remove("is-dragging");

    if (!dragged) return;

    suppressNextClick = true;
    window.setTimeout(() => {
      suppressNextClick = false;
    }, 0);

    if (shouldRoll) rollDie();
  };

  die.addEventListener("pointerup", (event) => finishDieDrag(event, true));
  die.addEventListener("pointercancel", (event) => finishDieDrag(event, false));
  die.addEventListener("lostpointercapture", (event) => finishDieDrag(event, false));

  die.addEventListener("click", () => {
    if (suppressNextClick) {
      suppressNextClick = false;
      return;
    }
    rollDie();
  });

  die.addEventListener("animationend", (event) => {
    if (event.animationName !== "dice-roll") return;
    finishDieRoll(Number(die.dataset.pendingFace) || currentFace);
    delete die.dataset.pendingFace;
  });
}

function closeCardModal() {
  if (!cardModal) return;
  cardModal.hidden = true;
  document.body.classList.remove("card-modal-open");
  modalArt.replaceChildren();
}

function openCardModal(card) {
  if (!cardModal || !modalArt || !modalName || !modalType || !modalStats || !modalDescription) {
    throw new Error("Card details modal is missing required elements.");
  }

  const preview = card.cloneNode(true);
  preview.classList.remove("is-tilting", "is-dragging-source", "effect-pop-active");
  preview.querySelector(".card-effect-pop")?.remove();
  preview.removeAttribute("style");
  preview.classList.add("modal-card");
  modalArt.replaceChildren(preview);
  modalArt.style.setProperty("--card-accent", getComputedStyle(card).getPropertyValue("--card-accent"));
  modalName.textContent = card.querySelector(".card-header span")?.textContent ?? "Card";
  modalType.textContent = card.querySelector(".card-type")?.textContent ?? "";
  modalStats.replaceChildren(
    ...(card.querySelector(".card-cost")
      ? [document.createElement("span")]
      : []),
    ...[...card.querySelectorAll(".card-stats span")].map((stat) => {
      const item = document.createElement("span");
      item.textContent = stat.textContent;
      return item;
    }),
  );
  const cardCost = card.querySelector(".card-cost");
  if (cardCost && modalStats.firstElementChild) {
    modalStats.firstElementChild.textContent = `◈ ${cardCost.textContent} MANA`;
  }
  modalDescription.textContent = card.querySelector(".card-description")?.textContent ?? "";
  cardModal.hidden = false;
  document.body.classList.add("card-modal-open");
  cardModal.querySelector(".card-modal-close")?.focus();
}

cardModal?.addEventListener("click", (event) => {
  if (event.target === cardModal || event.target.closest(".card-modal-close")) closeCardModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && cardModal && !cardModal.hidden) closeCardModal();
});

function clearTilt(card) {
  card.classList.remove("is-tilting");
  card.style.removeProperty("--tilt-x");
  card.style.removeProperty("--tilt-y");
  card.style.removeProperty("--tilt-z");
}

function setupTilt(card) {
  if (reduceMotion) return;

  let bounds;
  let frame = 0;
  let previousTime = 0;
  let currentX = 0;
  let currentY = 0;
  let currentDepth = 12;
  let targetX = 0;
  let targetY = 0;
  let targetDepth = 12;

  const animateTilt = (time) => {
    const delta = previousTime ? Math.min(time - previousTime, 32) : 16;
    previousTime = time;
    const smoothing = 1 - Math.exp(-delta / 55);

    currentX += (targetX - currentX) * smoothing;
    currentY += (targetY - currentY) * smoothing;
    currentDepth += (targetDepth - currentDepth) * smoothing;
    card.style.setProperty("--tilt-x", `${currentX}deg`);
    card.style.setProperty("--tilt-y", `${currentY}deg`);
    card.style.setProperty("--tilt-z", `${currentDepth}px`);

    if (
      Math.abs(targetX - currentX) > 0.05 ||
      Math.abs(targetY - currentY) > 0.05 ||
      Math.abs(targetDepth - currentDepth) > 0.1
    ) {
      frame = requestAnimationFrame(animateTilt);
    } else {
      frame = 0;
    }
  };

  card.addEventListener("pointerenter", () => {
    if (card.parentElement !== hand) return;
    bounds = card.getBoundingClientRect();
    currentX = targetX = 0;
    currentY = targetY = 0;
    currentDepth = targetDepth = 12;
    card.classList.add("is-tilting");
  });

  card.addEventListener("pointermove", (event) => {
    if (!bounds || card.parentElement !== hand) return;

    const x = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const y = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
    const horizontalOffset = (x - 0.5) * 2;
    const verticalOffset = (y - 0.5) * 2;
    const edgeProximity = Math.max(Math.abs(horizontalOffset), Math.abs(verticalOffset));

    targetX = -verticalOffset * 20;
    targetY = horizontalOffset * 20;
    targetDepth = 12 + edgeProximity * 28;

    if (!frame) frame = requestAnimationFrame(animateTilt);
  });

  card.addEventListener("pointerleave", () => {
    bounds = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    currentX = targetX = 0;
    currentY = targetY = 0;
    currentDepth = targetDepth = 12;
    clearTilt(card);
  });
}

function updateHandPositions() {
  const cards = [...hand.querySelectorAll(".hand-card")];
  const spread = Math.min(15, 68 / Math.max(1, cards.length - 1));
  const start = (100 - spread * (cards.length - 1)) / 2;
  cards.forEach((card, index) => {
    const offsetFromCenter = index - (cards.length - 1) / 2;
    card.style.setProperty("--card-index", index);
    card.style.setProperty("--card-position", `${start + spread * index}%`);
    card.style.setProperty("--card-angle", `${offsetFromCenter * 10}deg`);
    card.style.setProperty("--card-lift", `${Math.abs(offsetFromCenter) * 24}px`);
  });
}

function getSlotAtPoint(x, y) {
  return document
    .elementsFromPoint(x, y)
    .map((element) => element.closest(".player-slot"))
    .find((slot) => slot && !slot.querySelector(".hand-card"));
}

function setupDragging(card) {
  let drag = null;

  const clearDropTargets = () => {
    slots.forEach((slot) => slot.classList.remove("is-drop-target"));
  };

  const endDrag = (event, shouldDrop) => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    const canSummon = currentPhase === "market" && hasEnoughMana(getCardSummonCost(card));
    const target = shouldDrop && drag.moved && canSummon
      ? getSlotAtPoint(event.clientX, event.clientY)
      : null;
    clearDropTargets();
    drag.preview.remove();
    card.classList.remove("is-dragging-source");
    clearTilt(card);

    if (target) {
      if (!INFINITE_MANA) currentMana -= getCardSummonCost(card);
      card.classList.remove("is-summonable", "is-unaffordable");
      card.removeAttribute("aria-label");
      card.removeAttribute("title");
      target.append(card);
      target.classList.add("is-occupied");
      setupCardCooldown(card);
      updateHandPositions();
      updateManaDisplay();
      renderUpperBoard();
    } else if (shouldDrop && !drag.moved) {
      openCardModal(card);
    }

    drag = null;
  };

  card.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || card.parentElement !== hand || currentPhase !== "market") return;
    if (!hasEnoughMana(getCardSummonCost(card))) return;
    event.preventDefault();

    const bounds = card.getBoundingClientRect();
    const preview = card.cloneNode(true);
    preview.classList.remove("is-tilting", "is-dragging-source");
    preview.classList.add("drag-preview");
    preview.style.width = `${bounds.width}px`;
    preview.style.height = `${bounds.height}px`;
    preview.style.setProperty("--drag-x", `${bounds.left}px`);
    preview.style.setProperty("--drag-y", `${bounds.top}px`);
    preview.style.removeProperty("--tilt-x");
    preview.style.removeProperty("--tilt-y");
    preview.style.removeProperty("--tilt-z");
    preview.style.removeProperty("--shine-x");
    preview.style.removeProperty("--shine-y");
    document.body.append(preview);

    drag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      preview,
    };

    card.setPointerCapture(event.pointerId);
  });

  card.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (!drag.moved) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (distance < 6) return;
      if (currentPhase !== "market" || !hasEnoughMana(getCardSummonCost(card))) return;
      drag.moved = true;
      card.classList.add("is-dragging-source");
    }

    const left = event.clientX - drag.offsetX;
    const top = event.clientY - drag.offsetY;
    drag.preview.style.setProperty("--drag-x", `${left}px`);
    drag.preview.style.setProperty("--drag-y", `${top}px`);

    clearDropTargets();
    const target = getSlotAtPoint(event.clientX, event.clientY);
    if (target) target.classList.add("is-drop-target");
  });

  card.addEventListener("pointerup", (event) => endDrag(event, true));
  card.addEventListener("pointercancel", (event) => endDrag(event, false));
  card.addEventListener("lostpointercapture", (event) => endDrag(event, false));
}

handCards.forEach((card) => {
  setupTilt(card);
  setupDragging(card);
  card.addEventListener("click", () => {
    if (card.parentElement !== hand) openCardModal(card);
  });
});

updateHandPositions();
updateManaDisplay();
startMarketRound();
