import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrthographicCamera, OrbitControls, Billboard, Text } from '@react-three/drei';
import type { Mesh } from 'three';
import type { BoardCell, JungleMob } from '@/game/types';
import { ELEM_COLORS } from '@/game/data/constants';
import { Tile } from './Tile';
import { Scenery } from './Scenery';
import { BattleFx } from './Projectiles';
import type { BattleEvent } from '@/game/combat/simulate';

interface Props {
  playerBoard: BoardCell[];
  enemyBoard?: BoardCell[] | null;
  jungleMobs?: JungleMob[]; // mobs de jungle (fase de farm), renderizados no lado inimigo
  selectedCard: boolean; // há carta selecionada p/ jogar
  validCells?: number[]; // índices destacados
  onCellClick?: (index: number) => void;
  /** Eventos da batalha simulada; só passar durante a reprodução. Relógio próprio desde a montagem. */
  battleEvents?: BattleEvent[];
  /** Fator de velocidade do relógio de projéteis (default 1; 0.5 = câmera lenta). */
  battleSpeed?: number;
}

// Espaçamento das casas.
const COL_GAP = 1.05;
const FRONT_Z = 0.55;
const BACK_Z = 1.65;

// Centro (em z) de um lado isolado: média entre front e back.
const SIDE_CENTER_Z = (FRONT_Z + BACK_Z) / 2; // 1.1

// Layout: lado do player na frente (z positivo), inimigo ao fundo (z negativo).
function cellPos(cell: BoardCell, side: 'player' | 'enemy'): [number, number, number] {
  const x = (cell.col - 1) * COL_GAP;
  const rowOffset = cell.row === 'front' ? FRONT_Z : BACK_Z;
  const z = side === 'player' ? rowOffset : -rowOffset;
  return [x, 0, z];
}

// Posição no lado inimigo a partir de um índice 0..5 (3 colunas x 2 linhas).
function enemyIndexPos(index: number): [number, number, number] {
  const col = index % 3; // 0..2
  const row: 'front' | 'back' = index < 3 ? 'front' : 'back';
  return cellPos({ col, row } as BoardCell, 'enemy');
}

export function Board({ playerBoard, enemyBoard, jungleMobs, selectedCard, validCells = [], onCellClick, battleEvents, battleSpeed = 1 }: Props) {
  const hasEnemy = !!enemyBoard && enemyBoard.length > 0;
  const liveMobs = (jungleMobs ?? []).filter((m) => m.hp > 0);
  const hasJungle = !hasEnemy && liveMobs.length > 0;

  // Há oponente em cena (batalha OU jungle): mostramos os dois lados.
  const twoSided = hasEnemy || hasJungle;

  // Ancoragem: com oponente os dois lados já são simétricos em torno de z=0.
  // Sem oponente, deslocamos a cena para que o centro do board do player caia na origem.
  const anchorZ = twoSided ? 0 : -SIDE_CENTER_Z;

  // Zoom: com oponente cabe mais profundidade (lados opostos), então afastamos um pouco.
  // Valores maiores => board maior na tela (ocupa melhor o espaço).
  const zoom = twoSided ? 94 : 126;

  return (
    <Canvas shadows dpr={[1, 2]} style={{ width: '100%', height: '100%' }}>
      <color attach="background" args={['#cfe8b0']} />
      {/* Câmera ortográfica em ângulo ISOMÉTRICO inclinado (~50° da vertical),
          olhando para a origem — dá o look diorama com volume dos blocos. */}
      <OrthographicCamera makeDefault position={[0, 8.5, 11]} zoom={zoom} />
      <OrbitControls
        target={[0, 0, 0]}
        enablePan={false}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.4}
        minAzimuthAngle={-Math.PI / 8}
        maxAzimuthAngle={Math.PI / 8}
        minZoom={60}
        maxZoom={150}
      />

      <ambientLight intensity={0.75} />
      <directionalLight
        position={[5, 10, 6]}
        intensity={1.15}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      {/* fill suave para destacar o low-poly sem lavar as cores */}
      <directionalLight position={[-4, 4, -4]} intensity={0.3} />

      {/* Tudo que pertence ao tabuleiro vai no grupo ancorado. */}
      <group position={[0, 0, anchorZ]}>
        {/* chão base — acompanha o board para parecer "plantado", não flutuando.
            Os blocos agora têm base em y=0, então o chão fica logo abaixo. */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, SIDE_CENTER_Z * (twoSided ? 0 : 1)]} receiveShadow>
          <planeGeometry args={[22, 22]} />
          <meshStandardMaterial color="#8fc85c" roughness={0.95} />
        </mesh>

        {/* Entorno decorativo (props low-poly nas bordas/fundo, sem colisão). */}
        <Scenery />

        <BattleFx
          events={battleEvents}
          battleSpeed={battleSpeed}
          originY={1.0}
          getCellPos={(side, index) => {
            const board = side === 'player' ? playerBoard : enemyBoard;
            const cell = board?.find((c) => c.index === index);
            if (cell) return cellPos(cell, side);
            const col = index % 3;
            const row: 'front' | 'back' = index < 3 ? 'front' : 'back';
            return cellPos({ col, row } as BoardCell, side);
          }}
          getTargetPos={(side) => [0, 0.8, (side === 'player' ? 1 : -1) * SIDE_CENTER_Z]}
        >
          {playerBoard.map((cell) => (
            <Tile
              key={`p-${cell.index}`}
              cell={cell}
              position={cellPos(cell, 'player')}
              interactive={selectedCard}
              highlight={selectedCard && validCells.includes(cell.index)}
              onClick={onCellClick}
              side="player"
            />
          ))}

          {hasEnemy &&
            enemyBoard!.map((cell) => (
              <Tile
                key={`e-${cell.index}`}
                cell={cell}
                position={cellPos(cell, 'enemy')}
                interactive={false}
                highlight={false}
                side="enemy"
              />
            ))}

          {hasJungle &&
            liveMobs.map((mob) => (
              <JungleMobMesh key={`j-${mob.index}`} mob={mob} position={enemyIndexPos(mob.index)} />
            ))}
        </BattleFx>
      </group>
    </Canvas>
  );
}

/** Cubo low-poly de um mob de jungle, colorido pelo elemento, com HP flutuante. */
function JungleMobMesh({ mob, position }: { mob: JungleMob; position: [number, number, number] }) {
  const ref = useRef<Mesh>(null);
  const h = 0.5;
  const color = ELEM_COLORS[mob.elem];

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + h / 2 + Math.sin(state.clock.elapsedTime * 2) * 0.04;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref} position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[0.5, h, 0.5]} />
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* HP como texto nativo 3D (sem DOM), sempre virado para a câmera. */}
      <Billboard position={[0, h + 0.3, 0]}>
        <Text
          fontSize={0.22}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#000000"
        >
          {`${mob.hp} HP`}
        </Text>
      </Billboard>
    </group>
  );
}
