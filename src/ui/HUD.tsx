import { ELEM_LABEL, WINS_TO_COMPLETE_RUN, PLAYER_START_HP } from '@/game/data/constants';
import type { Elem, Phase } from '@/game/types';

interface Props {
  character: Elem;
  playerHP: number;
  enemyHP?: number | null;
  mana: number;
  round: number;
  wins: number;
  phase: Phase;
  lastDice: number | null;
}

const PHASE_LABEL: Record<Phase, string> = {
  menu: 'Menu',
  dice: 'Rolar Dado',
  shop: 'Loja',
  farm: 'Farm',
  battle: 'Batalha',
  result: 'Resultado',
  gameover: 'Fim',
};

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="bar">
      <div className="bar__fill" style={{ width: `${Math.max(0, (value / max) * 100)}%`, background: color }} />
      <span className="bar__label">{Math.max(0, Math.round(value))}</span>
    </div>
  );
}

export function HUD({ character, playerHP, enemyHP, mana, round, wins, phase, lastDice }: Props) {
  return (
    <div className="hud">
      <div className="hud__block">
        <span className="hud__k">{ELEM_LABEL[character]}</span>
        <Bar value={playerHP} max={PLAYER_START_HP} color="#4ad66d" />
      </div>
      <div className="hud__stats">
        <span>💧 Mana <b>{mana}</b></span>
        <span>🎲 {lastDice ?? '-'}</span>
        <span>Rodada <b>{round}</b></span>
        <span>🏆 {wins}/{WINS_TO_COMPLETE_RUN}</span>
        <span className="hud__phase">{PHASE_LABEL[phase]}</span>
      </div>
      {enemyHP != null && (
        <div className="hud__block hud__block--enemy">
          <span className="hud__k">Inimigo</span>
          <Bar value={enemyHP} max={PLAYER_START_HP} color="#ff6b6b" />
        </div>
      )}
    </div>
  );
}
