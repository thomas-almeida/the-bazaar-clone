"use client";

// Aba MAGOS do painel: edita a apresentação de cada mago (retrato, vídeo de
// fundo e música). Os caminhos são de arquivos em /public. Edição em rascunho,
// com preview ao vivo; só vale no jogo ao PUBLICAR.

import { useEffect, useMemo, useState } from "react";
import { MAGES } from "@/lib/mages";
import { mergeMageConfig, useMageConfig, type MageConfig } from "@/lib/mage-config";
import { playEvent } from "@/lib/sfx";
import { usePendingAction } from "@/components/usePendingAction";
import { Field, PublishDialog, readJson } from "./shared";

type Draft = Record<string, { portrait: string; cutout: string; background: string; music: string }>;

function draftFromConfig(config: MageConfig): Draft {
  const d: Draft = {};
  for (const m of MAGES) {
    const o = config[m.id] ?? {};
    d[m.id] = {
      portrait: o.portrait ?? m.portrait,
      cutout: o.cutout ?? m.cutout ?? "",
      background: o.background ?? m.background,
      music: o.music ?? m.music,
    };
  }
  return d;
}

// Config a publicar: só os campos que diferem do padrão do código.
function configFromDraft(draft: Draft): MageConfig {
  const config: MageConfig = {};
  for (const m of MAGES) {
    const d = draft[m.id];
    if (!d) continue;
    const over: Record<string, string> = {};
    if (d.portrait && d.portrait !== m.portrait) over.portrait = d.portrait;
    if (d.cutout && d.cutout !== (m.cutout ?? "")) over.cutout = d.cutout;
    if (d.background && d.background !== m.background) over.background = d.background;
    if (d.music && d.music !== m.music) over.music = d.music;
    if (Object.keys(over).length) config[m.id] = over;
  }
  return config;
}

export default function MagesTab({ onNotice }: { onNotice: (message: string) => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftFromConfig({}));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const applyConfig = useMageConfig((s) => s.set);
  const publish = usePendingAction();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/mages", { cache: "no-store" })
      .then(readJson)
      .then((body: { config: MageConfig }) => !cancelled && setDraft(draftFromConfig(mergeMageConfig(body.config))))
      .catch((reason: unknown) => !cancelled && setError(reason instanceof Error ? reason.message : "Falha ao carregar magos."))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  const dirty = useMemo(() => Object.keys(configFromDraft(draft)).length > 0, [draft]);

  const setField = (id: string, key: "portrait" | "cutout" | "background" | "music", value: string) =>
    setDraft((d) => ({ ...d, [id]: { ...d[id], [key]: value } }));

  const doPublish = async () => {
    await publish.run("mages", async () => {
      const config = configFromDraft(draft);
      const body = await readJson(
        await fetch("/api/admin/mages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ config }),
        }),
      );
      const saved = mergeMageConfig(body.config);
      applyConfig(saved); // passa a valer no modal/jogo desta sessão
      onNotice("Magos publicados.");
      setDialogOpen(false);
    });
  };

  if (loading) return <p className="balance-loading">Carregando magos…</p>;

  return (
    <div className="mages-editor">
      <div className="vfx-editor-intro">
        <p>Edite retrato, vídeo de fundo e música de cada mago (caminhos em /public). Publique para valer no jogo.</p>
        <div className="vfx-editor-actions">
          <button
            type="button"
            className="home-item balance-button"
            onClick={() => setDraft(draftFromConfig({}))}
            disabled={!dirty}
          >
            RESTAURAR PADRÃO
          </button>
          <button
            type="button"
            className="home-item balance-button is-primary"
            onClick={() => { playEvent("ui:admin.tab"); setDialogOpen(true); }}
          >
            PUBLICAR MAGOS
          </button>
        </div>
      </div>

      {error && <p className="balance-error" role="alert">{error}</p>}

      {MAGES.map((mage) => {
        const d = draft[mage.id];
        return (
          <section key={mage.id} className="vfx-style-card mage-row" style={{ ["--profile-accent" as string]: mage.accent }}>
            <header className="vfx-style-head"><h3>{mage.name}</h3></header>
            <div className="mage-row-grid">
              <div className="vfx-controls">
                <Field label="Retrato (imagem)">
                  <input value={d.portrait} spellCheck={false} onChange={(e) => setField(mage.id, "portrait", e.target.value)} />
                </Field>
                <Field label="Recorte sem fundo (PNG)">
                  <input value={d.cutout} spellCheck={false} placeholder="opcional — efeito pop-out" onChange={(e) => setField(mage.id, "cutout", e.target.value)} />
                </Field>
                <Field label="Vídeo de fundo">
                  <input value={d.background} spellCheck={false} onChange={(e) => setField(mage.id, "background", e.target.value)} />
                </Field>
                <Field label="Música">
                  <input value={d.music} spellCheck={false} onChange={(e) => setField(mage.id, "music", e.target.value)} />
                </Field>
              </div>

              <div className="mage-row-preview">
                <video className="mage-picker-bg" src={d.background} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
                <span className="mage-picker-grad" aria-hidden="true" />
                {d.cutout
                  ? <img className="mage-row-cutout" src={d.cutout} alt={`Recorte de ${mage.name}`} />
                  : <img className="mage-picker-portrait" src={d.portrait} alt={`Retrato de ${mage.name}`} />}
                <audio controls src={d.music} className="mage-row-audio" preload="none" />
              </div>
            </div>
          </section>
        );
      })}

      {dialogOpen && (
        <PublishDialog
          patchName="Apresentação dos magos"
          busy={publish.is("mages")}
          pending={publish.is("mages")}
          onConfirm={() => void doPublish()}
          onCancel={() => setDialogOpen(false)}
        />
      )}
    </div>
  );
}
