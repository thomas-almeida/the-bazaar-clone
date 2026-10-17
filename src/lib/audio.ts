// Contrato da camada de áudio e registro de eventos — importado tanto pelo
// cliente (runtime de som) quanto pelo servidor (rotas /api/audio e
// /api/admin/audio). Não pode ter efeito colateral nem "use client": a
// migration do Supabase espelha os padrões declarados aqui.
//
// Um "binding" liga um evento nomeado a um arquivo da biblioteca, com volume
// próprio e um intervalo mínimo entre repetições. As cartas usam o escopo
// `card:<cardId>` e sobrescrevem o campo `sound` legado da definição.

import { categoryOf } from "./catalog";
import type { CardDef } from "./types";

export type SoundCategory = "dado" | "item" | "ui";

export type AudioScope = "card" | "event" | "ui";

export interface SoundDef {
  /** Identificador estável; não muda ao renomear o arquivo. */
  id: string;
  label: string;
  /** Caminho servido em /public ou URL HTTPS. O banco guarda o caminho, não o arquivo. */
  path: string;
  category: SoundCategory;
  enabled: boolean;
}

export interface AudioBinding {
  /** Chave completa: "card:<cardId>", "event:<nome>" ou "ui:<tela>.<acao>". */
  event: string;
  /** null deixa o evento silencioso. */
  soundId: string | null;
  /** 0..1 — mixagem relativa, multiplicada pelo volume de efeitos do jogador. */
  volume: number;
  /** Intervalo mínimo entre disparos (ms). Evita rajada em hover e cartas rápidas. */
  minIntervalMs: number;
  enabled: boolean;
}

/** Resposta de GET /api/audio (patch publicado). */
export interface AudioConfigResponse {
  version: string;
  sounds: SoundDef[];
  bindings: AudioBinding[];
}

// --- Registro de eventos ----------------------------------------------------

export interface AudioEventSpec {
  event: string;
  scope: AudioScope;
  /** Rótulo curto para a lista do admin. */
  label: string;
  /** Agrupamento na tela de sons ("Menu principal", "Combate"…). */
  group: string;
  /** Quando dispara, em linguagem de regra — exibido como dica no admin. */
  trigger: string;
  defaultSoundId: string | null;
  defaultVolume: number;
  defaultMinIntervalMs: number;
}

const EVENT = (
  event: string,
  scope: AudioScope,
  group: string,
  label: string,
  trigger: string,
  defaultSoundId: string | null,
  defaultVolume: number,
  defaultMinIntervalMs = 0,
): AudioEventSpec => ({
  event,
  scope,
  group,
  label,
  trigger,
  defaultSoundId,
  defaultVolume,
  defaultMinIntervalMs,
});

/** Eventos nomeados por tela, mais os eventos globais de jogo. */
export const AUDIO_EVENTS: AudioEventSpec[] = [
  // --- Eventos globais de jogo (disparados pelo motor e pelo store) ---
  EVENT("event:dice", "event", "Jogo", "Rolagem do dado", "Ao rolar o dado obrigatório da loja.", "diceA", 0.7),
  EVENT("event:buy", "event", "Jogo", "Comprar oferta", "Ao comprar uma carta no bazar.", "buy", 0.7),
  EVENT("event:cardPlaced", "event", "Jogo", "Carta no tabuleiro", "Ao soltar uma carta em um slot vazio.", "cardPlaced", 0.7),
  EVENT("event:newBoard", "event", "Jogo", "Novo tabuleiro", "Ao entrar na fase de bot ou iniciar a luta.", "newBoard", 0.6),
  EVENT("event:newCards", "event", "Jogo", "Novas ofertas", "Ao abrir uma loja ou a fase de aventura.", "newCards", 0.6),
  // O id segue "cardModal" de propósito: é o que os patches de áudio já
  // gravaram no banco. Renomear quebraria todo binding existente.
  EVENT("event:cardModal", "event", "Jogo", "Dica da carta", "Ao abrir o detalhe de uma carta (hover/toque).", "cardModal", 0.6, 120),
  EVENT("event:optionSelected", "event", "Jogo", "Opção selecionada", "Escolha genérica de uma opção offered.", "optionSelected", 0.6, 60),
  EVENT("event:fog", "event", "Combate", "Alerta de névoa", "8 s antes da névoa começar (uma vez por batalha).", "fog", 0.8),
  EVENT("event:login", "event", "Jogo", "Entrar / sair", "Ao entrar, cadastrar ou encerrar a sessão.", "login", 0.6),

  // --- Menu principal ---
  EVENT("ui:menu.play", "ui", "Menu principal", "JOGAR", "Botão de entrada na run.", "optionSelected", 0.6),
  EVENT("ui:menu.magePick", "ui", "Menu principal", "Trocar mago", "Clique no retrato do mago no menu.", "optionSelected", 0.6),
  EVENT("ui:menu.magos", "ui", "Menu principal", "MAGOS", "Acesso à galeria de magos.", "optionSelected", 0.5),
  EVENT("ui:menu.ranking", "ui", "Menu principal", "RANKING", "Acesso ao placar de líderes.", "optionSelected", 0.5),
  EVENT("ui:menu.ajustes", "ui", "Menu principal", "AJUSTES", "Abre o modal de ajustes.", "optionSelected", 0.5),
  EVENT("ui:menu.admin", "ui", "Menu principal", "BALANCEAMENTO", "Acesso ao painel administrativo.", "optionSelected", 0.5),
  EVENT("ui:menu.signOut", "ui", "Menu principal", "SAIR", "Encerra a sessão.", "login", 0.6),

  // --- Modais ---
  EVENT("ui:modal.close", "ui", "Modais", "Fechar modal", "Botão ×, backdrop ou Escape.", "cardModal", 0.5, 150),
  EVENT("ui:modal.magePick", "ui", "Modais", "Escolher mago", "Clique em um mago na galeria do modal.", "optionSelected", 0.6),
  EVENT("ui:modal.fullscreen", "ui", "Modais", "Tela cheia", "Confirmação de tela cheia no primeiro acesso.", "optionSelected", 0.5),

  // --- Conta e ajustes ---
  EVENT("ui:auth.submit", "ui", "Conta e ajustes", "Entrar / cadastrar", "Envio do formulário de acesso.", "login", 0.6),
  EVENT("ui:auth.switch", "ui", "Conta e ajustes", "Alternar login/cadastro", "Troca de modo no formulário.", "optionSelected", 0.5),
  EVENT("ui:settings.slider", "ui", "Conta e ajustes", "Mover slider", "Ao soltar um slider de volume.", "optionSelected", 0.5, 200),

  // --- Tabuleiro e fases ---
  EVENT("ui:board.cardHover", "ui", "Tabuleiro", "Hover de carta", "Passe o mouse sobre uma carta (com limite).", "cardHover", 0.35, 220),
  EVENT("ui:board.cardSelect", "ui", "Tabuleiro", "Selecionar carta", "Clique numa carta da mão ou do slot.", "cardHover", 0.5, 90),
  EVENT("ui:board.place", "ui", "Tabuleiro", "Posicionar carta", "Solta uma carta em um slot vazio.", "cardPlaced", 0.6),
  EVENT("ui:shop.buy", "ui", "Bazar", "Comprar oferta", "Clique em uma oferta da loja.", "buy", 0.6),
  EVENT("ui:shop.open", "ui", "Bazar", "Abrir vendedor", "Clique no vendedor para ver as ofertas.", "cardHover", 0.5, 120),
  EVENT("ui:adventure.pick", "ui", "Aventura", "Escolher relíquia", "Clique em uma das três situações.", "optionSelected", 0.6),
  EVENT("ui:bot.pick", "ui", "Batalha", "Escolher NPC", "Seleciona o NPC com quem lutar.", "optionSelected", 0.6),
  EVENT("ui:versus.start", "ui", "Batalha", "LUTAR", "Confirma o confronto contra o rival.", "newBoard", 0.7),

  // --- Painel administrativo ---
  EVENT("ui:admin.tab", "ui", "Admin", "Trocar aba", "Alterna entre Cartas e Sons.", "optionSelected", 0.4, 150),
  EVENT("ui:admin.save", "ui", "Admin", "Salvar", "Salva carta, som ou binding no rascunho.", "buy", 0.6),
  EVENT("ui:admin.publish", "ui", "Admin", "Publicar", "Confirma a publicação do patch.", "newBoard", 0.7),
  EVENT("ui:admin.newPatch", "ui", "Admin", "Criar rascunho", "Cria um rascunho a partir do publicado.", "buy", 0.6),
];

/** Eventos não ligados a uma carta específica. */
export const GLOBAL_EVENTS = AUDIO_EVENTS;

/** Monta a chave de binding de uma carta. */
export function cardEvent(cardId: string): string {
  return `card:${cardId}`;
}

export function parseEvent(value: string): { scope: AudioScope; name: string } | null {
  const index = value.indexOf(":");
  if (index <= 0) return null;
  const scope = value.slice(0, index);
  if (scope !== "card" && scope !== "event" && scope !== "ui") return null;
  return { scope, name: value.slice(index + 1) };
}

// --- Biblioteca padrão (espelha os 19 arquivos já servidos) -----------------

export const DEFAULT_SOUNDS: SoundDef[] = [
  { id: "diceA", label: "Dado 1", path: "/sounds/dice/dice-sound-1.mp3", category: "dado", enabled: true },
  { id: "diceB", label: "Dado 2", path: "/sounds/dice/dice-sound-2.mp3", category: "dado", enabled: true },
  { id: "attackSword", label: "Ataque de espada", path: "/sounds/itens/sword_attack.mp3", category: "item", enabled: true },
  { id: "attackPistol", label: "Ataque de pistola", path: "/sounds/itens/pistol_attack.mp3", category: "item", enabled: true },
  { id: "attackBlast", label: "Ataque genérico", path: "/sounds/itens/blast_attack_generic.mp3", category: "item", enabled: true },
  { id: "shield", label: "Escudo ganho", path: "/sounds/itens/shield_gained_sound.mp3", category: "item", enabled: true },
  { id: "haste", label: "Aceleração", path: "/sounds/ui/haste_application.mp3", category: "item", enabled: true },
  { id: "heal", label: "Cura", path: "/sounds/ui/healing_sound.mp3", category: "item", enabled: true },
  { id: "buy", label: "Compra", path: "/sounds/ui/buy_sound.mp3", category: "ui", enabled: true },
  { id: "cardHover", label: "Hover de carta", path: "/sounds/ui/card_hover.mp3", category: "ui", enabled: true },
  { id: "cardModal", label: "Dica da carta", path: "/sounds/ui/card_modal_open_and_close.mp3", category: "ui", enabled: true },
  { id: "cardPlaced", label: "Carta colocada", path: "/sounds/ui/card_placed.mp3", category: "ui", enabled: true },
  { id: "fog", label: "Alerta de névoa", path: "/sounds/ui/fog_alert.mp3", category: "ui", enabled: true },
  { id: "login", label: "Login / logout", path: "/sounds/ui/login_or_logout.mp3", category: "ui", enabled: true },
  { id: "newBoard", label: "Novo tabuleiro", path: "/sounds/ui/new_board_animation.mp3", category: "ui", enabled: true },
  { id: "newCards", label: "Novas cartas", path: "/sounds/ui/new_cards_on_top_table_animation.mp3", category: "ui", enabled: true },
  { id: "optionSelected", label: "Opção selecionada", path: "/sounds/ui/option_selected.mp3", category: "ui", enabled: true },
  { id: "runDefeated", label: "Run derrotada", path: "/sounds/ui/run_defeated.mp3", category: "ui", enabled: true },
  { id: "runWin", label: "Run vencida", path: "/sounds/ui/run_win.mp3", category: "ui", enabled: true },
];

/** Mapeia o enum legado `CardDef.sound` para um id da biblioteca. */
export const CARD_SOUND_TO_ID = {
  sword: "attackSword",
  pistol: "attackPistol",
  blast: "attackBlast",
  heal: "heal",
  shield: "shield",
  haste: "haste",
} as const;

export const CARD_SOUND_IDS = Object.values(CARD_SOUND_TO_ID);
export const CARD_SOUND_VALUES = Object.keys(CARD_SOUND_TO_ID) as (keyof typeof CARD_SOUND_TO_ID)[];

export const SOUND_CATEGORY_LABEL: Record<SoundCategory, string> = {
  dado: "Dado",
  item: "Item",
  ui: "Interface",
};

/**
 * Configuração padrão derivada da biblioteca e do registro de eventos. É o
 * fallback de desenvolvimento (sem SUPABASE_SERVICE_ROLE_KEY) e o que o runtime
 * usa para qualquer binding ausente no patch publicado.
 */
export function buildDefaultAudioConfig(): AudioConfigResponse {
  const bindings: AudioBinding[] = AUDIO_EVENTS.map((spec) => ({
    event: spec.event,
    soundId: spec.defaultSoundId,
    volume: spec.defaultVolume,
    minIntervalMs: spec.defaultMinIntervalMs,
    enabled: true,
  }));
  return { version: "local", sounds: DEFAULT_SOUNDS.map((s) => ({ ...s })), bindings };
}


export const AUDIO_SCOPE_LABEL: Record<AudioScope, string> = {
  card: "Cartas",
  event: "Eventos do jogo",
  ui: "Interface",
};

/** Som legado derivado do efeito da carta, quando não há binding na config. */
export function legacyCardSoundId(def: CardDef): string {
  if (def.sound && def.sound in CARD_SOUND_TO_ID) {
    return CARD_SOUND_TO_ID[def.sound as keyof typeof CARD_SOUND_TO_ID];
  }
  if (def.effectType === "healing") return "heal";
  if (def.effectType === "shield") return "shield";
  if (categoryOf(def) === "aceleracao") return "haste";
  return "attackBlast";
}
