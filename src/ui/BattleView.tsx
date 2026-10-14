import { useEffect, useRef, useState } from 'react';
import type { BattleResult } from '@/game/combat/simulate';

interface Props {
  result: BattleResult;
  startPlayerHP: number;
  startEnemyHP: number;
  onHP: (player: number, enemy: number) => void;
  onDone: () => void;
}

const PLAYBACK_SPEED = 0.5; // 1 = tempo real, 0.5 = camera lenta

/** Reproduz os eventos da simulação em tempo real, atualizando os HPs mostrados. */
export function BattleView({ result, startPlayerHP, startEnemyHP, onHP, onDone }: Props) {
  const [idx, setIdx] = useState(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
    let i = 0;
    let p = startPlayerHP;
    let e = startEnemyHP;

    const loop = (now: number) => {
      const elapsed = ((now - startRef.current) / 1000) * PLAYBACK_SPEED;
      while (i < result.events.length && result.events[i].t <= elapsed) {
        const ev = result.events[i];
        if (ev.side === 'player') e -= ev.damage;
        else p -= ev.damage;
        i++;
      }
      setIdx(i);
      onHP(Math.max(0, p), Math.max(0, e));
      if (i < result.events.length && elapsed < result.duration + 0.5) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        onHP(result.playerHP, result.enemyHP);
        setTimeout(onDone, 800);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recent = result.events.slice(Math.max(0, idx - 4), idx).reverse();

  return (
    <div className="battle-feed">
      <div className="battle-feed__title">⚔ BATALHA</div>
      {recent.map((ev, k) => (
        <div key={k} className={`battle-feed__line battle-feed__line--${ev.side}`}>
          {ev.side === 'player' ? '▶ Você' : '◀ Inimigo'} atira {ev.damage} ({ev.elem})
        </div>
      ))}
    </div>
  );
}
