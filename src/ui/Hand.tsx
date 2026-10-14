import { motion } from 'framer-motion';
import type { CardInstance } from '@/game/types';
import { Card } from './Card';

interface Props {
  hand: CardInstance[];
  selectedUid: string | null;
  mana: number;
  onSelect: (uid: string) => void;
}

export function Hand({ hand, selectedUid, mana, onSelect }: Props) {
  if (hand.length === 0) return <div className="hand hand--empty">Mão vazia</div>;
  return (
    <div className="hand">
      {hand.map((c, i) => {
        const affordable = c.def.cost <= mana;
        const n = hand.length;
        const spread = Math.min(8, 60 / n);
        const rot = (i - (n - 1) / 2) * spread * 0.18;
        return (
          <motion.div
            key={c.uid}
            className="hand__slot"
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1, rotate: rot }}
            transition={{ delay: i * 0.03 }}
            style={{ marginLeft: i === 0 ? 0 : -34, zIndex: selectedUid === c.uid ? 100 : i }}
            whileHover={{ y: -24, zIndex: 200, rotate: 0 }}
          >
            <Card
              def={c.def}
              selected={selectedUid === c.uid}
              disabled={!affordable && c.def.kind !== 'terrain' && c.def.kind !== 'item'}
              onClick={() => onSelect(c.uid)}
            />
          </motion.div>
        );
      })}
    </div>
  );
}
