import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { CardInstance } from '@/game/types';
import { Card } from './Card';

interface Props {
  offers: CardInstance[];
  mana: number;
  minimized: boolean;
  onBuy: (uid: string) => void;
  onReroll: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  onDone: () => void;
}

/**
 * Loja como DRAWER (sidebar) lateral ESQUERDO deslizante.
 *
 * Estados:
 *  - Aberto: barra vertical ancorada à esquerda (abaixo do HUD) com as 3 ofertas
 *    empilhadas, título "LOJA · Mana N", botões Reroll e Continuar. Entra deslizando
 *    da esquerda (x: -100% → 0).
 *  - Recolhido (`minimized`): some para fora da tela, restando apenas uma ABA FINA
 *    ("handle") na beira esquerda.
 *  - Hover-reabre: passar o mouse na aba (ou no próprio drawer) desliza-o de volta;
 *    ao tirar o mouse ele recolhe novamente. Clicar na aba FIXA o drawer aberto
 *    (via onExpand, que também limpa a carta selecionada e libera o board).
 *
 * Fica à esquerda e estreito, então nunca cobre a mão (canto inferior direito) nem
 * o dado 3D. Ao selecionar uma carta, o App marca `minimized` e o board central
 * fica livre para cliques.
 */
export function Shop({ offers, mana, minimized, onBuy, onReroll, onExpand, onCollapse, onDone }: Props) {
  // Reabertura temporária por hover enquanto está recolhido.
  const [hovering, setHovering] = useState(false);
  const visible = !minimized || hovering;

  return (
    <>
      {/* ABA FINA (handle) na beira esquerda — visível quando recolhido */}
      <AnimatePresence>
        {minimized && (
          <motion.div
            className="fixed left-0 top-[64px] bottom-0 z-40 flex items-center"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
          >
            <button
              onClick={onExpand}
              title="Abrir a loja (ou passe o mouse para espiar)"
              className="group flex h-44 w-8 flex-col items-center justify-center gap-2
                         rounded-r-xl border border-l-0 border-[#f5b301]/60
                         bg-panel/95 text-[#f5b301] shadow-[0_8px_30px_rgba(0,0,0,0.5)]
                         transition-colors hover:bg-[#f5b301]/15"
            >
              <span className="text-lg">🛒</span>
              <span
                className="text-[11px] font-bold tracking-[2px]"
                style={{ writingMode: 'vertical-rl' }}
              >
                LOJA · {mana}
              </span>
              <span className="text-[#9aa3b2] transition-transform group-hover:translate-x-0.5">▶</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DRAWER / sidebar */}
      <motion.aside
        className="fixed left-0 top-[56px] bottom-0 z-40 flex w-[236px] flex-col
                   border-r border-[#333c4d] bg-panel/95
                   shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-sm"
        initial={{ x: '-100%' }}
        animate={{ x: visible ? 0 : '-100%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <span className="text-sm font-bold tracking-[2px] text-[#f5b301]">LOJA · Mana {mana}</span>
          <button
            className="px-2 py-1 text-xs"
            onClick={onCollapse}
            title="Recolher a loja para a aba lateral"
          >
            ◀
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto px-3 py-2">
          {offers.map((o) => {
            const price = o.def.cost + 1;
            return (
              <Card
                key={o.uid}
                def={o.def}
                price={price}
                disabled={mana < price}
                onClick={() => onBuy(o.uid)}
              />
            );
          })}
          {offers.length === 0 && (
            <span className="mt-6 text-sm text-[#6b7480]">Tudo comprado.</span>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-[#333c4d] px-3 py-3">
          <button onClick={onReroll} disabled={mana < 1} className="w-full">
            🎲 Reroll (-1)
          </button>
          <button className="btn-primary w-full" onClick={onDone}>
            Continuar ▶
          </button>
          <p className="text-center text-[10px] leading-snug text-[#6b7480]">
            Selecione uma carta na mão (direita) para liberar o tabuleiro — a loja
            recolhe sozinha. Passe o mouse na aba para espiá-la de volta.
          </p>
        </div>
      </motion.aside>
    </>
  );
}
