"use client";

// Aba VFX do painel de balanceamento. Para cada estilo de projétil (pistola,
// blast, espada) edita COR, TRAJETÓRIA, TAMANHO, ESPESSURA, VELOCIDADE, além de
// BLUR, BRILHO, RASTRO e CURVATURA. Tudo em rascunho, com preview ao vivo; nada
// vale no jogo até PUBLICAR.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_VFX,
  VFX_LIMITS,
  VFX_MOTION_LABEL,
  VFX_SHAPES,
  VFX_SHAPE_LABEL,
  VFX_STYLE_KEYS,
  VFX_STYLE_LABEL,
  mergeVfxConfig,
  useVfxConfig,
  type VfxConfig,
  type VfxMotion,
  type VfxShape,
  type VfxStyle,
  type VfxStyleKey,
} from "@/lib/vfx";
import type { Projectile } from "@/lib/projectiles";
import { ProjectileView } from "@/components/ProjectileLayer";
import { playEvent } from "@/lib/sfx";
import { usePendingAction } from "@/components/usePendingAction";
import { Field, PublishDialog, readJson } from "./shared";

type NumKey = keyof typeof VFX_LIMITS;
const NUM_FIELDS: { key: NumKey; label: string }[] = [
  { key: "size", label: "Tamanho (px)" },
  { key: "thickness", label: "Espessura (px)" },
  { key: "speed", label: "Velocidade — duração (ms)" },
  { key: "blur", label: "Blur (px)" },
  { key: "glow", label: "Brilho (px)" },
  { key: "trail", label: "Rastro (nº de fantasmas)" },
  { key: "bow", label: "Curvatura do arco" },
];

let previewCounter = 0;

/** Preview ao vivo: dispara o projétil do estilo em loop usando o rascunho. */
function VfxPreview({ styleKey, style }: { styleKey: VfxStyleKey; style: VfxStyle }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const [shots, setShots] = useState<Projectile[]>([]);
  // `latest` guarda o estilo atual para o loop sempre usar o rascunho vigente.
  const latest = useRef(style);
  latest.current = style;

  const fire = useCallback(() => {
    const cardEl = cardRef.current;
    const badgeEl = badgeRef.current;
    if (!cardEl || !badgeEl) return;
    const c = cardEl.getBoundingClientRect();
    const b = badgeEl.getBoundingClientRect();
    const vfx = latest.current;
    const x1 = b.left + b.width / 2;
    const y1 = b.top + b.height / 2;
    const base = {
      id: `preview-${(previewCounter += 1)}`,
      targetSide: "opponent" as const,
      duration: vfx.speed,
      style: styleKey,
      motion: vfx.motion,
      vfx,
    };
    const p: Projectile =
      vfx.motion === "melee"
        ? { ...base, x0: x1, y0: y1, x1, y1 }
        : { ...base, x0: c.left + c.width / 2, y0: c.top + c.height / 2, x1, y1 };
    setShots((s) => [...s, p]);
  }, [styleKey]);

  // Loop: redispara pouco depois de cada impacto.
  useEffect(() => {
    const id = window.setInterval(fire, Math.max(600, style.speed + 650));
    fire();
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fire, style.speed]);

  const onDone = (shot: Projectile) => {
    const badge = badgeRef.current;
    if (badge) {
      badge.classList.remove("is-hit");
      void badge.offsetWidth;
      badge.classList.add("is-hit");
    }
    setShots((s) => s.filter((x) => x.id !== shot.id));
  };

  return (
    <div className="vfx-preview">
      <div className="vfx-preview-card" ref={cardRef}>CARTA</div>
      <div className="vfx-preview-badge board-owner-badge" ref={badgeRef} aria-hidden="true">
        <span>ALVO</span>
      </div>
      {shots.map((p) => (
        <ProjectileView key={p.id} p={p} onDone={() => onDone(p)} />
      ))}
      <button type="button" className="balance-button vfx-fire" onClick={fire}>DISPARAR</button>
    </div>
  );
}

function StyleEditor({
  styleKey,
  style,
  onChange,
}: {
  styleKey: VfxStyleKey;
  style: VfxStyle;
  onChange: (next: VfxStyle) => void;
}) {
  const set = <K extends keyof VfxStyle>(key: K, value: VfxStyle[K]) => onChange({ ...style, [key]: value });

  return (
    <section className="vfx-style-card">
      <header className="vfx-style-head">
        <h3>{VFX_STYLE_LABEL[styleKey]}</h3>
      </header>

      <div className="vfx-style-grid">
        <div className="vfx-controls">
          <Field label="Cor">
            <span className="vfx-color-row">
              <input
                type="color"
                value={style.color}
                onChange={(e) => set("color", e.target.value)}
                aria-label={`Cor de ${VFX_STYLE_LABEL[styleKey]}`}
              />
              <input
                type="text"
                className="vfx-color-hex"
                value={style.color}
                onChange={(e) => set("color", e.target.value)}
                spellCheck={false}
              />
            </span>
          </Field>

          <Field label="Trajetória">
            <select value={style.motion} onChange={(e) => set("motion", e.target.value as VfxMotion)}>
              {(["shot", "arc", "melee"] as VfxMotion[]).map((m) => (
                <option key={m} value={m}>{VFX_MOTION_LABEL[m]}</option>
              ))}
            </select>
          </Field>

          {style.motion !== "melee" && (
            <Field label="Forma da ponta">
              <select value={style.shape} onChange={(e) => set("shape", e.target.value as VfxShape)}>
                {VFX_SHAPES.map((s) => (
                  <option key={s} value={s}>{VFX_SHAPE_LABEL[s]}</option>
                ))}
              </select>
            </Field>
          )}

          {NUM_FIELDS.map(({ key, label }) => {
            const lim = VFX_LIMITS[key];
            return (
              <Field key={key} label={label}>
                <span className="vfx-slider-row">
                  <input
                    type="range"
                    min={lim.min}
                    max={lim.max}
                    step={lim.step}
                    value={style[key]}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                  <input
                    type="number"
                    className="vfx-num"
                    min={lim.min}
                    max={lim.max}
                    step={lim.step}
                    value={style[key]}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                </span>
              </Field>
            );
          })}
        </div>

        <VfxPreview styleKey={styleKey} style={style} />
      </div>
    </section>
  );
}

export default function VfxTab({ onNotice }: { onNotice: (message: string) => void }) {
  const [config, setConfig] = useState<VfxConfig>(DEFAULT_VFX);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const applyConfig = useVfxConfig((s) => s.set);
  const publish = usePendingAction();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/vfx", { cache: "no-store" })
      .then(readJson)
      .then((body: { config: VfxConfig }) => !cancelled && setConfig(mergeVfxConfig(body.config)))
      .catch((reason: unknown) => !cancelled && setError(reason instanceof Error ? reason.message : "Falha ao carregar VFX."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(DEFAULT_VFX), [config]);

  const updateStyle = (key: VfxStyleKey, next: VfxStyle) => setConfig((c) => ({ ...c, [key]: next }));

  const doPublish = async () => {
    await publish.run("vfx", async () => {
      const body = await readJson(
        await fetch("/api/admin/vfx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        }),
      );
      const saved = mergeVfxConfig(body.config);
      setConfig(saved);
      applyConfig(saved); // passa a valer no jogo desta sessão imediatamente
      onNotice("VFX publicado.");
      setDialogOpen(false);
    });
  };

  if (loading) return <p className="balance-loading">Carregando VFX…</p>;

  return (
    <div className="vfx-editor">
      <div className="vfx-editor-intro">
        <p>
          Ajuste os projéteis com sliders e veja no preview ao vivo. Publique para
          valer em todas as novas runs.
        </p>
        <div className="vfx-editor-actions">
          <button
            type="button"
            className="home-item balance-button"
            onClick={() => setConfig(DEFAULT_VFX)}
            disabled={!dirty}
          >
            RESTAURAR PADRÃO
          </button>
          <button
            type="button"
            className="home-item balance-button is-primary"
            onClick={() => { playEvent("ui:admin.tab"); setDialogOpen(true); }}
          >
            PUBLICAR VFX
          </button>
        </div>
      </div>

      {error && <p className="balance-error" role="alert">{error}</p>}

      {VFX_STYLE_KEYS.map((key) => (
        <StyleEditor key={key} styleKey={key} style={config[key]} onChange={(next) => updateStyle(key, next)} />
      ))}

      {dialogOpen && (
        <PublishDialog
          patchName="VFX dos projéteis"
          busy={publish.is("vfx")}
          pending={publish.is("vfx")}
          onConfirm={() => void doPublish()}
          onCancel={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
