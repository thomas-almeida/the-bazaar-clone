import { createContext, useMemo, useRef } from 'react';
import type { MutableRefObject, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Vector3 } from 'three';
import type { Mesh, MeshStandardMaterial } from 'three';
import type { BattleEvent } from '@/game/combat/simulate';
import { ELEM_COLORS } from '@/game/data/constants';

type Side = 'player' | 'enemy';

/** Estado compartilhado de FX de batalha (lido pelas Units para o "coice"). */
export interface BattleFxState {
  /** Tempo decorrido (s) do relógio da batalha. */
  elapsed: MutableRefObject<number>;
  /** Último instante de disparo por casa: chave `${side}-${cellIndex}`. */
  kicks: MutableRefObject<Map<string, number>>;
}

/** null quando não há batalha em reprodução. */
export const BattleFxContext = createContext<BattleFxState | null>(null);

export const kickKey = (side: Side, index: number) => `${side}-${index}`;

const FLIGHT = 0.28; // s
const ARC = 0.7; // altura do arco
const FLASH = 0.2; // s
const POOL = 32;
const FLASH_POOL = 16;
const FALLBACK = '#ffffff';

interface Shot {
  active: boolean;
  t0: number;
  from: Vector3;
  to: Vector3;
  side: Side;
  elem: string;
}
interface Flash {
  active: boolean;
  t0: number;
  pos: Vector3;
}

interface Props {
  events?: BattleEvent[];
  /** Posição local (já no grupo ancorado) da casa de origem. */
  getCellPos: (side: Side, index: number) => [number, number, number];
  /** Ponto-alvo (base/HP) do lado ATINGIDO. */
  getTargetPos: (side: Side) => [number, number, number];
  /** Altura em que o projétil sai (topo do tile + meia criatura). */
  originY: number;
  children: ReactNode;
  /** Fator de velocidade do relógio (1 = tempo real, 0.5 = câmera lenta). Default 1. */
  battleSpeed?: number;
}

/**
 * Provider + sistema de projéteis. Deve ficar DENTRO do <Canvas>, envolvendo
 * os tiles (para que Units leiam o contexto) e dentro do grupo ancorado.
 * Roda um relógio próprio desde a montagem; dispara cada evento quando elapsed >= event.t.
 */
export function BattleFx({ events, getCellPos, getTargetPos, originY, children, battleSpeed = 1 }: Props) {
  const active = !!events && events.length > 0;
  const elapsed = useRef(0);
  const kicks = useRef(new Map<string, number>());
  const cursor = useRef(0);

  const sorted = useMemo(() => {
    elapsed.current = 0;
    cursor.current = 0;
    kicks.current.clear();
    return events ? [...events].sort((a, b) => a.t - b.t) : [];
  }, [events]);

  const shots = useRef<Shot[]>(
    Array.from({ length: POOL }, () => ({
      active: false, t0: 0, from: new Vector3(), to: new Vector3(), side: 'player' as Side, elem: '',
    })),
  );
  const flashes = useRef<Flash[]>(
    Array.from({ length: FLASH_POOL }, () => ({ active: false, t0: 0, pos: new Vector3() })),
  );
  const shotMeshes = useRef<(Mesh | null)[]>([]);
  const flashMeshes = useRef<(Mesh | null)[]>([]);
  const tmpColor = useMemo(() => new Color(), []);

  const fx = useMemo<BattleFxState>(() => ({ elapsed, kicks }), []);

  useFrame((_, delta) => {
    if (!active) return;
    elapsed.current += Math.min(delta, 0.1) * battleSpeed;
    const now = elapsed.current;

    // dispara eventos cujo tempo já passou
    while (cursor.current < sorted.length && sorted[cursor.current].t <= now) {
      const ev = sorted[cursor.current++];
      kicks.current.set(kickKey(ev.side, ev.from), ev.t);
      const slot = shots.current.find((s) => !s.active);
      if (!slot) continue;
      const [fx0, , fz0] = getCellPos(ev.side, ev.from);
      const target = getTargetPos(ev.side === 'player' ? 'enemy' : 'player');
      slot.active = true;
      slot.t0 = ev.t;
      slot.side = ev.side;
      slot.elem = ev.elem;
      slot.from.set(fx0, originY, fz0);
      slot.to.set(target[0], target[1], target[2]);
    }

    // projéteis
    shots.current.forEach((s, i) => {
      const m = shotMeshes.current[i];
      if (!m) return;
      if (!s.active) {
        m.visible = false;
        return;
      }
      const u = (now - s.t0) / FLIGHT;
      if (u >= 1) {
        s.active = false;
        m.visible = false;
        const f = flashes.current.find((x) => !x.active);
        if (f) {
          f.active = true;
          f.t0 = now;
          f.pos.copy(s.to);
          const fm = flashMeshes.current[flashes.current.indexOf(f)];
          if (fm) {
            const mat = fm.material as MeshStandardMaterial;
            tmpColor.set(ELEM_COLORS[s.elem as keyof typeof ELEM_COLORS] ?? FALLBACK);
            mat.color.copy(tmpColor);
            mat.emissive.copy(tmpColor);
          }
        }
        return;
      }
      m.visible = true;
      m.position.lerpVectors(s.from, s.to, u);
      m.position.y += Math.sin(Math.PI * u) * ARC;
      const sc = 0.7 + 0.5 * Math.sin(Math.PI * u);
      m.scale.set(sc, sc, sc * 1.5); // leve esticada
      m.lookAt(s.to);
      const mat = m.material as MeshStandardMaterial;
      tmpColor.set(ELEM_COLORS[s.elem as keyof typeof ELEM_COLORS] ?? FALLBACK);
      mat.color.copy(tmpColor);
      mat.emissive.copy(tmpColor);
    });

    // flashes de impacto
    flashes.current.forEach((f, i) => {
      const m = flashMeshes.current[i];
      if (!m) return;
      if (!f.active) {
        m.visible = false;
        return;
      }
      const u = (now - f.t0) / FLASH;
      if (u >= 1) {
        f.active = false;
        m.visible = false;
        return;
      }
      m.visible = true;
      m.position.copy(f.pos);
      const sc = 0.2 + 0.9 * u;
      m.scale.setScalar(sc);
      (m.material as MeshStandardMaterial).opacity = 1 - u;
    });
  });

  return (
    <BattleFxContext.Provider value={active ? fx : null}>
      {children}
      {active && (
        <>
          {shots.current.map((_, i) => (
            <mesh key={`s${i}`} ref={(el) => { shotMeshes.current[i] = el; }} visible={false} castShadow>
              <sphereGeometry args={[0.13, 12, 12]} />
              <meshStandardMaterial color={FALLBACK} emissive={FALLBACK} emissiveIntensity={2.5} roughness={0.3} />
            </mesh>
          ))}
          {flashes.current.map((_, i) => (
            <mesh key={`f${i}`} ref={(el) => { flashMeshes.current[i] = el; }} visible={false}>
              <sphereGeometry args={[0.5, 14, 14]} />
              <meshStandardMaterial
                color={FALLBACK}
                emissive={FALLBACK}
                emissiveIntensity={3}
                transparent
                opacity={1}
                depthWrite={false}
              />
            </mesh>
          ))}
        </>
      )}
    </BattleFxContext.Provider>
  );
}
