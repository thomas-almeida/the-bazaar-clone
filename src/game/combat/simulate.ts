import type { BoardCell } from '../types';
import { creaturesOnBoard } from '../board';
import { BATTLE_MAX_SECONDS } from '../data/constants';

export interface Shooter {
  side: 'player' | 'enemy';
  cellIndex: number;
  elem: string;
  shotDamage: number;
  cooldown: number;
  cooldownRemaining: number;
}

export interface BattleEvent {
  t: number; // segundos
  side: 'player' | 'enemy'; // quem atirou
  from: number; // cellIndex de origem
  elem: string;
  damage: number;
}

export interface BattleResult {
  events: BattleEvent[];
  playerHP: number;
  enemyHP: number;
  winner: 'player' | 'enemy' | 'draw';
  duration: number;
}

const TICK = 0.05; // 20 Hz lógico

/** Dano efetivo de uma criatura, somando bônus de construção adjacente (+DEF→ignorado p/ tiro)
 *  e itens equipados. Aqui aplicamos bônus de ATK de Lâmina. */
function effectiveShotDamage(cell: BoardCell): number {
  let dmg = cell.occupant?.shotDamage ?? 0;
  for (const it of cell.items) {
    if (it.defId === 'blade') dmg += cell.occupant?.elem === 'fire' ? 2 : 1;
  }
  // Muralha adjacente não afeta tiro (é DEF defensivo); mantido simples no MVP.
  return dmg;
}

function buildShooters(board: BoardCell[], side: 'player' | 'enemy'): Shooter[] {
  return creaturesOnBoard(board).map((cell) => ({
    side,
    cellIndex: cell.index,
    elem: cell.occupant!.elem,
    shotDamage: effectiveShotDamage(cell),
    cooldown: cell.occupant!.cooldown ?? 3,
    cooldownRemaining: 0, // todas começam prontas (§7)
  }));
}

/** Escudo do jogador a partir de itens de Escudo equipados no board. */
function shieldFor(board: BoardCell[]): number {
  let shield = 0;
  for (const cell of board) {
    for (const it of cell.items) {
      if (it.defId === 'shield') shield += cell.occupant?.elem === 'water' ? 5 : 3;
    }
  }
  return shield;
}

/**
 * Simula a batalha (§7): cada criatura atira direto no HP inimigo a cada cooldown.
 * Determinístico — mesma entrada, mesmo resultado (replay de snapshots).
 */
export function simulateBattle(
  playerBoard: BoardCell[],
  enemyBoard: BoardCell[],
  playerHP: number,
  enemyHP: number,
): BattleResult {
  const events: BattleEvent[] = [];
  const pShooters = buildShooters(playerBoard, 'player');
  const eShooters = buildShooters(enemyBoard, 'enemy');

  let pHP = playerHP + shieldFor(playerBoard);
  let eHP = enemyHP + shieldFor(enemyBoard);

  let t = 0;
  while (t < BATTLE_MAX_SECONDS && pHP > 0 && eHP > 0) {
    t += TICK;
    for (const s of [...pShooters, ...eShooters]) {
      s.cooldownRemaining -= TICK;
      if (s.cooldownRemaining <= 0) {
        s.cooldownRemaining = s.cooldown;
        if (s.side === 'player') eHP -= s.shotDamage;
        else pHP -= s.shotDamage;
        events.push({
          t: Math.round(t * 100) / 100,
          side: s.side,
          from: s.cellIndex,
          elem: s.elem,
          damage: s.shotDamage,
        });
        if (pHP <= 0 || eHP <= 0) break;
      }
    }
  }

  let winner: BattleResult['winner'];
  if (eHP <= 0 && pHP > 0) winner = 'player';
  else if (pHP <= 0 && eHP > 0) winner = 'enemy';
  else if (pHP === eHP) winner = 'draw';
  else winner = pHP > eHP ? 'player' : 'enemy'; // desempate por HP no timeout (§1)

  return { events, playerHP: Math.max(0, pHP), enemyHP: Math.max(0, eHP), winner, duration: t };
}
