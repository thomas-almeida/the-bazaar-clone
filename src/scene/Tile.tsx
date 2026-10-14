import { useMemo, useState } from 'react';
import { Color } from 'three';
import type { BoardCell } from '@/game/types';
import { ELEM_COLORS } from '@/game/data/constants';
import { Unit } from './Unit';

interface Props {
  cell: BoardCell;
  position: [number, number, number];
  interactive: boolean;
  highlight: boolean;
  onClick?: (index: number) => void;
  side?: 'player' | 'enemy'; // opcional: usado p/ animações de combate
}

const EMPTY_COLOR = '#8fc85c'; // grama suave (casa vazia)

// Altura real do bloco: dá volume de "diorama" (não um plano fino).
const TILE_H = 0.44;
const TILE_W = 0.96;

// Escurece uma cor (multiplica o brilho) p/ a "terra" nas laterais/base.
function darken(hex: string, factor: number): Color {
  return new Color(hex).multiplyScalar(factor);
}

export function Tile({ cell, position, interactive, highlight, onClick, side }: Props) {
  const [hover, setHover] = useState(false);
  const base = cell.terrain ? ELEM_COLORS[cell.terrain] : EMPTY_COLOR;
  const emissive = highlight ? '#ffffff' : hover && interactive ? base : '#000000';

  // Cor de "terra" das laterais: base bem mais escura, puxando p/ marrom.
  const dirt = useMemo(() => darken(base, 0.45).lerp(new Color('#5a3d24'), 0.35), [base]);

  const emissiveIntensity = highlight ? 0.35 : hover ? 0.15 : 0;

  return (
    <group position={position}>
      {/* Bloco com volume: topo = grama/terreno, laterais e base = terra escura.
          Ordem de materiais do BoxGeometry: [+x, -x, +y(topo), -y(base), +z, -z]. */}
      <mesh
        castShadow
        receiveShadow
        position={[0, TILE_H / 2, 0]}
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          onClick?.(cell.index);
        }}
        onPointerOver={() => interactive && setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[TILE_W, TILE_H, TILE_W]} />
        {/* +x */}
        <meshStandardMaterial attach="material-0" color={dirt} roughness={1} />
        {/* -x */}
        <meshStandardMaterial attach="material-1" color={dirt} roughness={1} />
        {/* +y topo */}
        <meshStandardMaterial
          attach="material-2"
          color={base}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.85}
        />
        {/* -y base */}
        <meshStandardMaterial attach="material-3" color={darken(base, 0.3)} roughness={1} />
        {/* +z */}
        <meshStandardMaterial attach="material-4" color={dirt} roughness={1} />
        {/* -z */}
        <meshStandardMaterial attach="material-5" color={dirt} roughness={1} />
      </mesh>

      {/* camadas de terreno empilhado (bônus §4) */}
      {cell.terrainStack >= 2 && (
        <mesh position={[0.36, TILE_H + 0.1, 0.36]} castShadow>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshStandardMaterial color="#ffd54a" emissive="#ffb300" emissiveIntensity={0.4} />
        </mesh>
      )}

      {cell.occupant && <Unit occupant={cell.occupant} position={[0, TILE_H, 0]} side={side} cellIndex={cell.index} />}
    </group>
  );
}
