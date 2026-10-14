import type { ReactNode } from 'react';

// Meshes decorativos não devem capturar o pointer das casas jogáveis.
const noRaycast = () => {};

/**
 * Entorno puramente DECORATIVO do diorama (low-poly).
 * Nada aqui recebe clique nem interfere no gameplay: os meshes usam
 * `raycast={null}` para não capturar o pointer das casas jogáveis.
 *
 * Posicionamento: tudo fica nas BORDAS/FUNDO, fora da área das 6 casas
 * jogáveis (x ∈ [-1.5, 1.5], z ∈ [-2, 2]) para não cobrir mobs de jungle
 * nem atrapalhar a leitura do tabuleiro.
 */
export function Scenery() {
  return (
    <group>
      {/* Árvores low-poly nas laterais e fundo */}
      <Tree position={[-3.4, 0, 1.6]} scale={1.1} />
      <Tree position={[3.5, 0, 0.4]} scale={0.95} tone="#5fb847" />
      <Tree position={[-2.9, 0, -3.1]} scale={0.85} tone="#6fcf5a" />

      {/* Casinha decorativa num canto afastado */}
      <Cottage position={[3.3, 0, -2.8]} rotation={-0.5} />

      {/* Faixa de "caminho" de terra bege atravessando o gramado ao fundo */}
      <Path />
    </group>
  );
}

/** Árvore: tronco marrom fino + 1-2 blocos de folhagem verde arredondada. */
function Tree({
  position,
  scale = 1,
  tone = '#6abf4b',
}: {
  position: [number, number, number];
  scale?: number;
  tone?: string;
}) {
  return (
    <group position={position} scale={scale}>
      {/* tronco */}
      <mesh castShadow receiveShadow position={[0, 0.3, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.1, 0.14, 0.6, 6]} />
        <meshStandardMaterial color="#8a5a32" roughness={1} />
      </mesh>
      {/* folhagem inferior */}
      <mesh castShadow receiveShadow position={[0, 0.85, 0]} raycast={noRaycast}>
        <icosahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color={tone} roughness={0.9} flatShading />
      </mesh>
      {/* folhagem superior menor */}
      <mesh castShadow receiveShadow position={[0, 1.25, 0]} raycast={noRaycast}>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial color={tone} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

/** Casinha: cubo de parede claro + telhado prisma inclinado azul. */
function Cottage({
  position,
  rotation = 0,
}: {
  position: [number, number, number];
  rotation?: number;
}): ReactNode {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* parede */}
      <mesh castShadow receiveShadow position={[0, 0.35, 0]} raycast={noRaycast}>
        <boxGeometry args={[0.8, 0.7, 0.8]} />
        <meshStandardMaterial color="#f0e6d2" roughness={0.9} />
      </mesh>
      {/* telhado: prisma triangular (cilindro de 3 lados) azul */}
      <mesh castShadow receiveShadow position={[0, 0.85, 0]} rotation={[0, Math.PI / 2, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[0.62, 0.62, 0.84, 3, 1]} />
        <meshStandardMaterial color="#4a90d9" roughness={0.8} flatShading />
      </mesh>
      {/* portinha */}
      <mesh position={[0, 0.2, 0.41]} raycast={noRaycast}>
        <boxGeometry args={[0.24, 0.4, 0.02]} />
        <meshStandardMaterial color="#7a5433" roughness={1} />
      </mesh>
    </group>
  );
}

/** Caminho de terra bege: fino plano atravessando o gramado ao fundo. */
function Path() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0.35]} position={[-0.6, 0.01, -4.2]} receiveShadow raycast={noRaycast}>
      <planeGeometry args={[9, 0.9]} />
      <meshStandardMaterial color="#cdab73" roughness={1} />
    </mesh>
  );
}
