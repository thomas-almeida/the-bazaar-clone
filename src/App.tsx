import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/game/store';
import type { Elem } from '@/game/types';
import { ELEM_LABEL, ELEM_COLORS } from '@/game/data/constants';
import { Board } from '@/scene/Board';
import { Dice3D } from '@/scene/Dice3D';
import { Hand } from '@/ui/Hand';
import { Shop } from '@/ui/Shop';
import { HUD } from '@/ui/HUD';
import { BattleView } from '@/ui/BattleView';
import './app.css';

export default function App() {
  const g = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [battleHP, setBattleHP] = useState<{ p: number; e: number } | null>(null);
  const [shopOpen, setShopOpen] = useState(true);

  const selectedCard = g.hand.find((c) => c.uid === selected) ?? null;

  // Sempre que a fase de loja (re)inicia, a loja volta a abrir.
  useEffect(() => {
    if (g.phase === 'shop') setShopOpen(true);
  }, [g.phase]);

  // A loja recolhe (libera o board) quando há carta selecionada para jogar,
  // ou quando o jogador a fecha manualmente.
  const shopMinimized = !!selectedCard || !shopOpen;

  // Casas válidas para a carta selecionada.
  const validCells = useMemo(() => {
    if (!selectedCard) return [];
    const def = selectedCard.def;
    return g.board
      .filter((cell) => {
        if (def.kind === 'terrain') return true;
        if (def.kind === 'item') return !!cell.occupant || cell.terrain !== null;
        if (cell.occupant) return false;
        if (def.kind === 'creature') return cell.terrain === def.elem;
        return true; // construção em qualquer casa vazia
      })
      .map((c) => c.index);
  }, [selectedCard, g.board]);

  const handleCellClick = (index: number) => {
    if (!selected) return;
    const ok = g.playCard(selected, index);
    if (ok) setSelected(null);
  };

  // ---- Telas ----
  if (g.phase === 'menu') {
    return (
      <div className="menu">
        <h1>Bazaar Clone</h1>
        <p className="menu__sub">Auto-battler de Elementos</p>
        <p className="menu__hint">Escolha seu elemento. Vença 3 batalhas contra players para completar a run.</p>
        <div className="menu__chars">
          {(['fire', 'water', 'grass'] as Elem[]).map((e) => (
            <button
              key={e}
              className="menu__char"
              style={{ borderColor: ELEM_COLORS[e], boxShadow: `0 0 20px ${ELEM_COLORS[e]}` }}
              onClick={() => g.startRun(e)}
            >
              <span className="menu__char-icon">{e === 'fire' ? '🔥' : e === 'water' ? '💧' : '🌿'}</span>
              {ELEM_LABEL[e]}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (g.phase === 'gameover') {
    const won = g.wins >= 3;
    return (
      <div className="menu">
        <h1>{won ? '🏆 Run Vencida!' : '💀 Fim da Run'}</h1>
        <p className="menu__sub">Vitórias: {g.wins}/3</p>
        <button className="btn-primary" onClick={() => g.reset()}>Voltar ao menu</button>
      </div>
    );
  }

  const inBattle = g.phase === 'battle';
  const enemy = g.currentEnemy;

  return (
    <div className="game">
      <HUD
        character={g.character}
        playerHP={battleHP ? battleHP.p : g.playerHP}
        enemyHP={inBattle ? (battleHP ? battleHP.e : enemy?.hp) : undefined}
        mana={g.mana}
        round={g.round}
        wins={g.wins}
        phase={g.phase}
        lastDice={g.lastDice}
      />

      <div className="board-wrap">
        <Board
          playerBoard={g.board}
          enemyBoard={inBattle ? enemy?.board : null}
          selectedCard={!!selectedCard}
          validCells={validCells}
          onCellClick={handleCellClick}
          jungleMobs={g.phase === 'farm' ? g.jungle : undefined}
          battleEvents={inBattle && g.lastBattle ? g.lastBattle.events : undefined}
          battleSpeed={0.5}
        />

        {/* Overlay de fase */}
        <AnimatePresence>
          {g.phase === 'dice' && (
            <motion.div
              className="absolute left-1/2 top-[18%] z-[15] -translate-x-1/2 pointer-events-none"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div className="panel">
                <h2>🎲 Role o dado</h2>
                <p>Clique no dado 3D (canto inferior direito) para ganhar mana e abrir a loja.</p>
              </div>
            </motion.div>
          )}

          {g.phase === 'farm' && (
            <motion.div
              className="pointer-events-none absolute bottom-6 left-1/2 z-[15] w-[min(560px,92vw)] -translate-x-1/2"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            >
              <div className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-[#3a4150] bg-[#0d1017]/90 px-5 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.6)] backdrop-blur-sm">
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-base font-bold text-[#f0e6c8]">🌾 Farm</h2>
                  <p className="mt-0.5 text-[12px] leading-snug text-[#9aa3b2]">
                    Suas criaturas abatem os mobs de jungle (ao fundo do tabuleiro) por mana e bônus elementais.
                  </p>
                </div>
                <FarmPanel />
              </div>
            </motion.div>
          )}

          {inBattle && g.lastBattle && (
            <BattleView
              key={enemy?.id}
              result={g.lastBattle}
              startPlayerHP={g.playerHP}
              startEnemyHP={enemy?.hp ?? 100}
              onHP={(p, e) => setBattleHP({ p, e })}
              onDone={() => { setBattleHP(null); g.resolveBattle(g.lastBattle!); }}
            />
          )}

          {g.phase === 'result' && (
            <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="panel">
                <h2>Vitória! ({g.wins}/3)</h2>
                <p>Prepare-se para o próximo adversário.</p>
                <button className="btn-primary" onClick={() => g.nextRound()}>Próxima rodada</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Loja como DRAWER lateral esquerdo. Recolhe para uma aba fina ao selecionar
          carta (libera o board central) ou ao recolher manualmente; hover na aba reabre. */}
      <AnimatePresence>
        {g.phase === 'shop' && (
          <Shop
            offers={g.shopOffers}
            mana={g.mana}
            minimized={shopMinimized}
            onBuy={(uid) => g.buyOffer(uid)}
            onReroll={() => g.rerollShop()}
            onExpand={() => { setSelected(null); setShopOpen(true); }}
            onCollapse={() => setShopOpen(false)}
            onDone={() => { setSelected(null); g.endShop(); }}
          />
        )}
      </AnimatePresence>

      {/* Barra inferior-direita: DADO 3D à esquerda, MÃO à direita.
          z-50 garante que a mão fique acima do modal da loja (z-40). */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-50 flex items-end gap-6 p-4">
        {/* Dado 3D — só na fase 'dice' */}
        <AnimatePresence>
          {g.phase === 'dice' && (
            <motion.div
              className="pointer-events-auto mb-2 flex flex-col items-center gap-1"
              initial={{ opacity: 0, scale: 0.6, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 40 }}
              transition={{ type: 'spring', stiffness: 240, damping: 20 }}
            >
              {/* Fundo escuro arredondado atrás do dado: o corpo do dado (creme) some
                  contra o tabuleiro bege sem contraste. */}
              <div className="rounded-2xl border border-[#333c4d] bg-[#0d1017]/80 p-2 shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
                <Dice3D size={130} onRollComplete={(v) => g.rollDice(v)} />
              </div>
              <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] text-[#9aa3b2]">
                Clique para rolar
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mão — ancorada à direita; acessível durante a loja */}
        {g.phase === 'shop' && (
          <div className="pointer-events-none flex flex-col items-end">
            <Hand
              hand={g.hand}
              selectedUid={selected}
              mana={g.mana}
              onSelect={(uid) => setSelected(uid === selected ? null : uid)}
            />
            {selectedCard && (
              <div className="hand-hint pointer-events-none mt-1">
                Clique numa casa destacada para jogar <b>{selectedCard.def.name}</b>
              </div>
            )}
          </div>
        )}
      </div>

      <LogPanel log={g.log} />
    </div>
  );
}

function FarmPanel() {
  const g = useGame();
  const [done, setDone] = useState(false);
  return (
    <div className="shrink-0">
      {!done ? (
        <button className="btn-primary whitespace-nowrap" onClick={() => { g.runFarm(); setDone(true); }}>Farmar</button>
      ) : (
        <button className="btn-primary whitespace-nowrap" onClick={() => g.endFarm()}>Continuar ▶</button>
      )}
    </div>
  );
}

function LogPanel({ log }: { log: string[] }) {
  return (
    <div className="log">
      {log.slice(-5).reverse().map((l, i) => (
        <div key={i} className="log__line">{l}</div>
      ))}
    </div>
  );
}
