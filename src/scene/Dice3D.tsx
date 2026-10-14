import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { Group } from 'three';

interface Props {
  onRollComplete: (value: number) => void;
  disabled?: boolean;
  size?: number; // lado do widget em px (default 96)
}

type Vec3 = [number, number, number];

const BODY = '#f4ecd8';
const PIP = '#2b2b2b';
const S = 1; // lado do cubo em unidades de cena
const PIP_R = S * 0.085; // raio do pip
const O = S * 0.26; // espaçamento do grid de pips

// Padrões de pip em coordenadas de grid {-1,0,1}.
const PATTERNS: Record<number, Array<[number, number]>> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
  5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
  6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
};

// Mapeia (a,b) do grid para a posição 3D de um pip em cada face.
// Atribuição das faces (opostas somam 7):
//   +Y=1  -Y=6  +Z=2  -Z=5  +X=3  -X=4
function pipPos(face: number, a: number, b: number): Vec3 {
  const d = S / 2 + 0.01; // um tiquinho para fora da face
  const u = a * O;
  const v = b * O;
  switch (face) {
    case 1: return [u, d, v];
    case 6: return [u, -d, v];
    case 2: return [u, v, d];
    case 5: return [u, v, -d];
    case 3: return [d, u, v];
    case 4: return [-d, u, v];
    default: return [0, 0, 0];
  }
}

// Orientação base (euler) que coloca a face `value` virada para cima (+Y).
const FACE_UP_EULER: Record<number, Vec3> = {
  1: [0, 0, 0],
  6: [Math.PI, 0, 0],
  2: [-Math.PI / 2, 0, 0],
  5: [Math.PI / 2, 0, 0],
  3: [0, 0, Math.PI / 2],
  4: [0, 0, -Math.PI / 2],
};

function Pips() {
  const pips: Vec3[] = [];
  for (let face = 1; face <= 6; face++) {
    for (const [a, b] of PATTERNS[face]) pips.push(pipPos(face, a, b));
  }
  return (
    <>
      {pips.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[PIP_R, 10, 10]} />
          <meshStandardMaterial color={PIP} roughness={0.5} />
        </mesh>
      ))}
    </>
  );
}

const DURATION = 1.0; // segundos de rolagem
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function DiceCube({ onRollComplete, disabled }: Pick<Props, 'onRollComplete' | 'disabled'>) {
  const ref = useRef<Group>(null);
  const [hover, setHover] = useState(false);

  // Estado de animação mantido em refs (não re-renderiza por frame).
  const rolling = useRef(false);
  const t0 = useRef(0);
  const from = useRef<Vec3>([0, 0, 0]);
  const to = useRef<Vec3>([0, 0, 0]);
  const pending = useRef<number>(1);

  const startRoll = () => {
    if (disabled || rolling.current || !ref.current) return;
    const value = 1 + Math.floor(Math.random() * 6);
    pending.current = value;

    const cur = ref.current.rotation;
    from.current = [cur.x, cur.y, cur.z];

    const base = FACE_UP_EULER[value];
    // Giros inteiros (2π) preservam a face para cima mas fazem o cubo "tombar".
    const spinX = 2 + Math.floor(Math.random() * 2);
    const spinY = 2 + Math.floor(Math.random() * 3);
    const spinZ = 1 + Math.floor(Math.random() * 2);
    to.current = [
      base[0] + spinX * Math.PI * 2,
      base[1] + spinY * Math.PI * 2,
      base[2] + spinZ * Math.PI * 2,
    ];

    t0.current = 0;
    rolling.current = true;
  };

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;

    if (rolling.current) {
      t0.current += delta;
      const t = Math.min(t0.current / DURATION, 1);
      const e = easeOutCubic(t);
      g.rotation.x = from.current[0] + (to.current[0] - from.current[0]) * e;
      g.rotation.y = from.current[1] + (to.current[1] - from.current[1]) * e;
      g.rotation.z = from.current[2] + (to.current[2] - from.current[2]) * e;
      if (t >= 1) {
        rolling.current = false;
        // Normaliza para o euler base (face certa para cima) evitando acúmulo.
        const base = FACE_UP_EULER[pending.current];
        g.rotation.set(base[0], base[1], base[2]);
        onRollComplete(pending.current);
      }
    } else if (!disabled) {
      // leve balanço "respirando" quando ocioso
      g.rotation.y += delta * 0.25;
    }
  });

  const interactive = !disabled;

  return (
    <group
      ref={ref}
      onClick={(e) => {
        e.stopPropagation();
        startRoll();
      }}
      onPointerOver={() => interactive && setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      <mesh castShadow>
        <boxGeometry args={[S, S, S]} />
        <meshStandardMaterial
          color={BODY}
          roughness={0.55}
          metalness={0.05}
          emissive={hover && interactive ? '#ffe9a8' : '#000000'}
          emissiveIntensity={hover && interactive ? 0.25 : 0}
        />
      </mesh>
      <Pips />
    </group>
  );
}

/**
 * Widget de dado d6 autossuficiente (tem seu próprio <Canvas>).
 * A UI o posiciona como um elemento DOM de `size`×`size` px.
 */
export function Dice3D({ onRollComplete, disabled = false, size = 96 }: Props) {
  return (
    <div style={{ width: size, height: size, cursor: disabled ? 'default' : 'pointer' }}>
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true }}
        camera={{ position: [2.4, 2.4, 2.4], fov: 35 }}
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <directionalLight position={[-3, 2, -2]} intensity={0.35} />
        <DiceCube onRollComplete={onRollComplete} disabled={disabled} />
      </Canvas>
    </div>
  );
}
