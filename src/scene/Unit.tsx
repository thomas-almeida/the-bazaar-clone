import { useContext, useRef } from 'react';
import { BattleFxContext, kickKey } from './Projectiles';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import type { Mesh } from 'three';
import type { CardDef } from '@/game/types';
import { ELEM_COLORS } from '@/game/data/constants';

interface Props {
  occupant: CardDef;
  position: [number, number, number];
  /** Opcionais: habilitam o "coice" ao atirar durante a batalha. */
  side?: 'player' | 'enemy';
  cellIndex?: number;
}

const KICK_DUR = 0.22;

/** Placeholder low-poly: cubo colorido por elemento (criatura) ou bloco alto (construção). */
export function Unit({ occupant, position, side, cellIndex }: Props) {
  const fx = useContext(BattleFxContext);
  const ref = useRef<Mesh>(null);
  const isBuilding = occupant.kind === 'building';
  const color = ELEM_COLORS[occupant.elem];
  const h = isBuilding ? 0.9 : 0.5;
  const label = isBuilding ? '[B]' : `${occupant.shotDamage ?? 0} dmg`;

  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    if (!isBuilding) {
      // leve "respiro" para parecer vivo
      m.position.y = position[1] + h / 2 + Math.sin(state.clock.elapsedTime * 2) * 0.04;
    }
    // coice ao atirar: recua para trás e volta + pulse de escala
    let k = 0;
    if (fx && side && cellIndex !== undefined) {
      const t0 = fx.kicks.current.get(kickKey(side, cellIndex));
      if (t0 !== undefined) {
        const age = fx.elapsed.current - t0;
        if (age >= 0 && age < KICK_DUR) k = Math.sin((Math.PI * age) / KICK_DUR);
      }
    }
    m.position.z = (side === 'enemy' ? -1 : 1) * 0.16 * k;
    m.scale.set(1 + 0.15 * k, 1 - 0.2 * k, 1 + 0.15 * k);
  });

  return (
    <group position={position}>
      <mesh ref={ref} position={[0, h / 2, 0]} castShadow>
        {isBuilding ? <boxGeometry args={[0.7, h, 0.7]} /> : <boxGeometry args={[0.5, h, 0.5]} />}
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      {/* Rótulo nativo 3D (sem DOM), sempre virado para a câmera. */}
      <Billboard position={[0, h + 0.3, 0]}>
        <Text
          fontSize={0.22}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#000000"
        >
          {label}
        </Text>
      </Billboard>
    </group>
  );
}
