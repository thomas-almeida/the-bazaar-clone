"use client";

// Aba SONS do painel de balanceamento.
//
// Duas listas, um patch de áudio só:
//  - Biblioteca: os arquivos (id, rótulo, caminho, categoria) e o upload local.
//  - Eventos: cada evento nomeado (jogo, interface e carta) com arquivo, volume,
//    intervalo mínimo entre repetições e um botão de teste.
//
// Tudo gravado em rascunho; nada vale no jogo até PUBLICAR PATCH.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AUDIO_EVENTS,
  SOUND_CATEGORY_LABEL,
  cardEvent,
  legacyCardSoundId,
  type AudioBinding,
  type AudioEventSpec,
  type SoundCategory,
  type SoundDef,
} from "@/lib/audio";
import { previewBinding, previewSound, playEvent, useAudioConfig } from "@/lib/sfx";
import type { CardDef } from "@/lib/types";
import { useSoundEvent } from "@/components/useSoundEvent";
import Spinner from "@/components/Spinner";
import { usePendingAction } from "@/components/usePendingAction";
import {
  Field,
  PublishDialog,
  readJson,
  SOUND_CATEGORY_KEYS,
  STATUS_LABEL,
  Toggle,
  type AdminPatch,
} from "./shared";

interface AudioPatchResponse {
  patches: AdminPatch[];
  selectedId: string | null;
  activePatchId: string | null;
  sounds: SoundDef[];
  bindings: AudioBinding[];
  readOnly?: boolean;
  warning?: string;
}

const BINDING_DEFAULTS = new Map(AUDIO_EVENTS.map((spec) => [spec.event, spec]));

function inheritedCardBinding(def: CardDef): AudioBinding {
  return {
    event: cardEvent(def.id),
    soundId: legacyCardSoundId(def),
    volume: 0.55,
    minIntervalMs: 120,
    enabled: true,
  };
}

export default function SoundsTab({ onNotice }: { onNotice: (message: string) => void }) {
  const [data, setData] = useState<AudioPatchResponse | null>(null);
  const [cards, setCards] = useState<CardDef[]>([]);
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [soundForm, setSoundForm] = useState<SoundDef | null>(null);
  const [newSoundId, setNewSoundId] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"event" | "ui" | "card">("event");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newPatchName, setNewPatchName] = useState("");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);

  const selectedPatch = data?.patches.find((patch) => patch.id === data.selectedId) ?? null;
  // Sem a migration aplicada, a rota devolve a biblioteca local em modo leitura.
  const readOnly = data?.readOnly === true;
  const editable = selectedPatch?.status === "draft" && !readOnly;
  const { is: isPending, run: runPending } = usePendingAction();

  const soundSave = useSoundEvent("ui:admin.save");
  const soundPublish = useSoundEvent("ui:admin.publish");
  const soundNewPatch = useSoundEvent("ui:admin.newPatch");

  const load = useCallback(async (patchId?: string) => {
    const query = patchId ? `?patchId=${encodeURIComponent(patchId)}` : "";
    const response = await fetch(`/api/admin/audio${query}`, { cache: "no-store" });
    const result = await readJson(response) as AudioPatchResponse;
    setData(result);
    setSelectedSoundId((current) =>
      result.sounds.some((sound) => sound.id === current) ? current : result.sounds[0]?.id ?? null,
    );
    setError("");
  }, []);

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Falha ao carregar os sons."));
  }, [load]);

  // A lista de cartas vem do patch de cartas publicado: é a fonte da verdade
  // do que existe no jogo, então a aba de Sons sempre acompanha o catálogo.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/catalog", { cache: "no-store" })
      .then((response) => readJson(response) as Promise<{ cards: CardDef[] }>)
      .then((body) => {
        if (!cancelled) setCards(body.cards ?? []);
      })
      .catch(() => {
        if (!cancelled) setCards([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (message) onNotice(message);
  }, [message, onNotice]);

  const selectedSound = data?.sounds.find((sound) => sound.id === selectedSoundId) ?? null;
  const filteredSounds = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.sounds ?? []).filter(
      (sound) => !query || [sound.label, sound.id, sound.path].some((f) => f.toLowerCase().includes(query)),
    );
  }, [data?.sounds, search]);

  useEffect(() => {
    setSoundForm(selectedSound ? structuredClone(selectedSound) : null);
  }, [selectedSound]);

  const bindingsByEvent = useMemo(
    () => new Map((data?.bindings ?? []).map((binding) => [binding.event, binding])),
    [data?.bindings],
  );

  // Valor efetivo de um evento: binding salvo, senão o padrão do registro.
  const effectiveBinding = useCallback(
    (event: string, fallback?: AudioBinding): AudioBinding => {
      const saved = bindingsByEvent.get(event);
      if (saved) return saved;
      const spec = BINDING_DEFAULTS.get(event);
      if (spec) {
        return {
          event,
          soundId: spec.defaultSoundId,
          volume: spec.defaultVolume,
          minIntervalMs: spec.defaultMinIntervalMs,
          enabled: true,
        };
      }
      return fallback ?? { event, soundId: null, volume: 0.6, minIntervalMs: 0, enabled: true };
    },
    [bindingsByEvent],
  );

  async function saveBinding(binding: AudioBinding) {
    if (!selectedPatch || !editable) return;
    setBusy(true);
    setError("");
    try {
      soundSave();
      await readJson(await fetch(`/api/admin/audio/${selectedPatch.id}/bindings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(binding),
      }));
      setData((current) => {
        if (!current) return current;
        const next = current.bindings.filter((b) => b.event !== binding.event);
        next.push(binding);
        return { ...current, bindings: next };
      });
      setMessage(`Evento “${binding.event}” salvo no rascunho.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o evento.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSound() {
    if (!soundForm || !selectedPatch || !editable) return;
    setBusy(true);
    setError("");
    try {
      soundSave();
      const result = await readJson(await fetch(`/api/admin/audio/${selectedPatch.id}/sounds/${soundForm.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(soundForm),
      })) as { sound: SoundDef };
      setData((current) => current ? {
        ...current,
        sounds: current.sounds.some((s) => s.id === soundForm.id)
          ? current.sounds.map((s) => (s.id === soundForm.id ? result.sound : s))
          : [...current.sounds, result.sound],
      } : current);
      setMessage(`Som “${result.sound.label}” salvo no rascunho.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o som.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSound() {
    if (!soundForm || !selectedPatch || !editable) return;
    setBusy(true);
    setError("");
    try {
      soundSave();
      await readJson(await fetch(`/api/admin/audio/${selectedPatch.id}/sounds/${soundForm.id}`, { method: "DELETE" }));
      setData((current) => current ? {
        ...current,
        sounds: current.sounds.filter((s) => s.id !== soundForm.id),
        bindings: current.bindings.map((b) => (b.soundId === soundForm.id ? { ...b, soundId: null } : b)),
      } : current);
      setSelectedSoundId(null);
      setMessage(`Som “${soundForm.label}” removido. Os eventos que o usavam ficaram mudos.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover o som.");
    } finally {
      setBusy(false);
    }
  }

  async function createSound() {
    const id = newSoundId.trim().toLowerCase();
    if (!selectedPatch || !editable || !/^[a-z0-9-]+$/.test(id)) return;
    const sound: SoundDef = { id, label: id, path: "", category: "ui", enabled: false };
    setBusy(true);
    setError("");
    try {
      const result = await readJson(await fetch(`/api/admin/audio/${selectedPatch.id}/sounds/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sound),
      })) as { sound: SoundDef };
      setData((current) => current ? { ...current, sounds: [...current.sounds, result.sound] } : current);
      setSelectedSoundId(id);
      setNewSoundId("");
      setSoundForm(result.sound);
      setMessage("Som criado. Ajuste o caminho do arquivo e ative.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o som.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSound(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const result = await readJson(await fetch("/api/admin/audio/upload", { method: "POST", body })) as { path: string };
      setSoundForm((current) => (current ? { ...current, path: result.path, enabled: true } : current));
      setMessage("Arquivo enviado para public/sounds/upload. Salve o som e faça commit do arquivo no Git.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar o arquivo.");
    } finally {
      setBusy(false);
    }
  }

  async function createPatch() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      soundNewPatch();
      const result = await readJson(await fetch("/api/admin/audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPatchName }),
      })) as { patch: AdminPatch };
      setNewPatchName("");
      await load(result.patch.id);
      setMessage("Novo rascunho de áudio criado com uma cópia do publicado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o rascunho de áudio.");
    } finally {
      setBusy(false);
    }
  }

  async function publishPatch() {
    if (!selectedPatch || selectedPatch.status !== "draft") return;
    setPublishConfirmOpen(false);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      soundPublish();
      await readJson(await fetch(`/api/admin/audio/${selectedPatch.id}/publish`, { method: "POST" }));
      await load(selectedPatch.id);
      // O cliente já tem a config antiga em memória; recarrega para o admin
      // ouvir exatamente o que o jogo vai tocar.
      await useAudioConfig.getState().refresh();
      setMessage("Patch de áudio publicado. O jogo já usa esta configuração.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar.");
    } finally {
      setBusy(false);
    }
  }

  const specs: AudioEventSpec[] = useMemo(
    () => AUDIO_EVENTS.filter((spec) => spec.scope === scope),
    [scope],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, AudioEventSpec[]>();
    for (const spec of specs) {
      const list = map.get(spec.group) ?? [];
      list.push(spec);
      map.set(spec.group, list);
    }
    return [...map.entries()];
  }, [specs]);

  const cardRows = useMemo(
    () => cards.map((card) => {
      const event = cardEvent(card.id);
      const saved = bindingsByEvent.get(event);
      return {
        card,
        inherited: !saved,
        binding: effectiveBinding(event, inheritedCardBinding(card)),
      };
    }),
    [cards, bindingsByEvent, effectiveBinding],
  );

  if (error && !data) {
    return (
      <section className="balance-workspace">
        <p className="balance-error" role="alert">{error}</p>
      </section>
    );
  }

  return (
    <>
      {data?.warning && <p className="balance-warning balance-notice" role="alert">{data.warning}</p>}

      <section className="balance-patch-bar panel-glass">
        <Field label="Patch de áudio">
          <select
            value={data?.selectedId ?? ""}
            onChange={(event) => {
              setError("");
              load(event.target.value).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Falha ao trocar patch."));
            }}
          >
            {(data?.patches ?? []).map((patch) => (
              <option key={patch.id} value={patch.id}>
                {patch.name} · {STATUS_LABEL[patch.status]}
              </option>
            ))}
          </select>
        </Field>
        <form className="balance-new-patch" onSubmit={(event) => { event.preventDefault(); void runPending("newPatch", createPatch); }}>
          <Field label="Novo rascunho">
            <input value={newPatchName} maxLength={100} placeholder="Ex.: Mix de áudio v2" onChange={(event) => setNewPatchName(event.target.value)} />
          </Field>
          <button
            className={`home-item balance-button${isPending("newPatch") ? " is-loading" : ""}`}
            disabled={busy || !newPatchName.trim()}
            aria-busy={isPending("newPatch") || undefined}
          >
            CRIAR CÓPIA
            {isPending("newPatch") && <Spinner />}
          </button>
        </form>
        <div className="balance-patch-state">
          <span>{selectedPatch ? STATUS_LABEL[selectedPatch.status] : "Sem patch"}</span>
          {selectedPatch?.id === data?.activePatchId && <small>VERSÃO EM USO</small>}
          {editable && <button className="home-item balance-button balance-publish" disabled={busy} onClick={() => setPublishConfirmOpen(true)}>PUBLICAR PATCH</button>}
        </div>
      </section>

      {error && <p className="balance-error balance-notice" role="alert">{error}</p>}

      <section className="balance-audio-workspace">
        <aside className="balance-sound-list panel-glass">
          <div className="balance-list-head">
            <h2>Biblioteca <span>{filteredSounds.length}</span></h2>
            <input aria-label="Buscar sons" value={search} placeholder="Nome, ID ou caminho…" onChange={(event) => setSearch(event.target.value)} />
            <form className="balance-new-sound" onSubmit={(event) => { event.preventDefault(); void runPending("createSound", createSound); }}>
              <input
                value={newSoundId}
                placeholder="novo-som-id"
                aria-label="ID do novo som"
                onChange={(event) => setNewSoundId(event.target.value)}
              />
              <button
                className={`home-item balance-button${isPending("createSound") ? " is-loading" : ""}`}
                disabled={busy || !editable || !/^[a-z0-9-]+$/.test(newSoundId.trim().toLowerCase())}
                aria-busy={isPending("createSound") || undefined}
                title="Criar um som novo na biblioteca"
              >
                +
                {isPending("createSound") && <Spinner />}
              </button>
            </form>
          </div>
          <div className="balance-card-items">
            {filteredSounds.map((sound) => (
              <button
                type="button"
                key={sound.id}
                className={`balance-card-row ${sound.id === selectedSoundId ? "is-selected" : ""} ${sound.enabled === false ? "is-disabled" : ""}`}
                onClick={() => setSelectedSoundId(sound.id)}
              >
                <span className="balance-sound-thumb" aria-hidden="true">♪</span>
                <span className="balance-card-row-copy">
                  <strong>{sound.label}</strong>
                  <small>{SOUND_CATEGORY_LABEL[sound.category]} · {sound.id}</small>
                </span>
                {sound.enabled === false && <small className="balance-archived">DESATIVADO</small>}
              </button>
            ))}
            {filteredSounds.length === 0 && <p className="balance-empty">Nenhum som encontrado.</p>}
          </div>
        </aside>

        <section className="balance-editor panel-glass">
          {!soundForm ? <p className="balance-empty">Selecione um som para editar.</p> : (
            <>
              <div className="balance-editor-heading">
                <div><span className="balance-kicker">{soundForm.id}</span><h2>{soundForm.label}</h2></div>
                <div className="balance-editor-heading-actions">
                  <button
                    type="button"
                    className="home-item balance-button"
                    disabled={busy || !soundForm.path}
                    onClick={() => previewSound(soundForm.id, 1)}
                    title="Ouve o arquivo cru, sem a mixagem de nenhum evento"
                  >
                    OUVIR ARQUIVO
                  </button>
                  <Toggle
                    checked={soundForm.enabled !== false}
                    disabled={!editable}
                    onChange={(next) => setSoundForm({ ...soundForm, enabled: next })}
                    on="Ativo"
                    off="Desativado"
                  />
                </div>
              </div>

              <div className="balance-editor-grid">
                <Field label="Rótulo">
                  <input disabled={!editable} maxLength={80} value={soundForm.label} onChange={(event) => setSoundForm({ ...soundForm, label: event.target.value })} />
                </Field>
                <Field label="Categoria">
                  <select disabled={!editable} value={soundForm.category} onChange={(event) => setSoundForm({ ...soundForm, category: event.target.value as SoundCategory })}>
                    {SOUND_CATEGORY_KEYS.map((key) => (
                      <option key={key} value={key}>{SOUND_CATEGORY_LABEL[key]}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Caminho do arquivo">
                  <input
                    disabled={!editable}
                    value={soundForm.path}
                    placeholder="/sounds/ui/buy_sound.mp3"
                    onChange={(event) => setSoundForm({ ...soundForm, path: event.target.value })}
                  />
                </Field>
                <Field label="Enviar áudio (somente desenvolvimento)">
                  <input
                    disabled={!editable || busy}
                    type="file"
                    accept="audio/mpeg,audio/wav,audio/ogg,audio/flac,audio/mp4"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadSound(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </Field>
              </div>

              <div className="balance-sound-audio">
                {soundForm.path && soundForm.path.startsWith("/sounds/") ? (
                  <audio key={soundForm.path} controls preload="none" src={soundForm.path} />
                ) : (
                  <p className="balance-empty">Defina um caminho em /public para ouvir o arquivo aqui.</p>
                )}
              </div>
              <small className="balance-editor-hint">
                O banco guarda apenas o caminho. O arquivo precisa estar no Git para existir no deploy.
              </small>

              <footer className="balance-editor-footer">
                {selectedPatch?.status !== "draft" && !readOnly && <span>Este patch é somente leitura. Crie um rascunho para editar.</span>}
                {readOnly && <span>Somente leitura: a migration de áudio ainda não foi aplicada.</span>}
                <button
                  type="button"
                  className={`home-item balance-button balance-danger${isPending("delete") ? " is-loading" : ""}`}
                  disabled={busy || !editable}
                  aria-busy={isPending("delete") || undefined}
                  onClick={() => void runPending("delete", deleteSound)}
                >
                  REMOVER
                  {isPending("delete") && <Spinner />}
                </button>
                <button
                  className={`home-item balance-button balance-save${isPending("save") ? " is-loading" : ""}`}
                  disabled={busy || !editable}
                  aria-busy={isPending("save") || undefined}
                  onClick={() => void runPending("save", saveSound)}
                >
                  {busy ? "SALVANDO…" : "SALVAR SOM"}
                  {isPending("save") && <Spinner />}
                </button>
              </footer>
            </>
          )}
        </section>
      </section>

      <section className="balance-bindings panel-glass">
        <div className="balance-list-head">
          <h2>Eventos de som</h2>
          <div className="balance-scope-tabs" role="tablist" aria-label="Escopo dos eventos">
            {([["event", "Jogo"], ["ui", "Interface"], ["card", "Cartas"]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={scope === key}
                className={`balance-scope-tab ${scope === key ? "is-selected" : ""}`}
                onClick={() => { playEvent("ui:admin.tab"); setScope(key); }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="balance-editor-hint">
            O volume aqui é a mixagem do evento. O slider de AJUSTES do jogador multiplica este valor.
            O intervalo mínimo evita que o mesmo efeito se repita em rajada.
          </p>
        </div>

        {scope === "card" ? (
          <div className="balance-binding-items">
            {cardRows.length === 0 && <p className="balance-empty">Catálogo indisponível. Verifique o patch de cartas publicado.</p>}
            {cardRows.map(({ card, binding, inherited }) => (
              <BindingRow
                key={card.id}
                editable={editable && !!selectedPatch}
                title={card.name}
                subtitle={inherited ? `${card.id} · herdado do efeito da carta` : card.id}
                sounds={data?.sounds ?? []}
                binding={binding}
                onChange={(next) => void saveBinding(next)}
              />
            ))}
          </div>
        ) : (
          grouped.map(([group, items]) => (
            <div key={group} className="balance-binding-group">
              <h3>{group}</h3>
              <div className="balance-binding-items">
                {items.map((spec) => (
                  <BindingRow
                    key={spec.event}
                    editable={editable && !!selectedPatch}
                    title={spec.label}
                    subtitle={spec.trigger}
                    sounds={data?.sounds ?? []}
                    binding={effectiveBinding(spec.event)}
                    onChange={(next) => void saveBinding(next)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      {publishConfirmOpen && selectedPatch && (
        <PublishDialog
          patchName={selectedPatch.name}
          busy={busy}
          pending={isPending("publish")}
          onConfirm={() => void runPending("publish", publishPatch)}
          onCancel={() => setPublishConfirmOpen(false)}
        />
      )}
    </>
  );
}

function soundLabel(sounds: SoundDef[], soundId: string | null): string {
  if (!soundId) return "—";
  return sounds.find((sound) => sound.id === soundId)?.label ?? soundId;
}

/**
 * Linha de binding. Exportada para teste: o drag do slider e o TESTAR só
 * podem ser regressions testados com o componente montado.
 */
export function BindingRow({
  title,
  subtitle,
  editable,
  sounds,
  binding,
  onChange,
}: {
  title: string;
  subtitle: string;
  editable: boolean;
  sounds: SoundDef[];
  binding: AudioBinding;
  onChange: (next: AudioBinding) => void;
}) {
  // Rascunho local da linha. O slider grava localmente a cada pixel do arrasto
  // e só chama onChange ao soltar: se gravasse direto, a requisição colocaria a
  // linha em busy e desabilitaria o próprio slider no meio do drag.
  const [draft, setDraft] = useState<AudioBinding>(binding);
  const { soundId, volume, minIntervalMs, enabled } = binding;

  // Sincroniza por valor, não por identidade: `binding` é um objeto novo a cada
  // render do pai, e depender dele apagaria o drag em andamento.
  useEffect(() => {
    setDraft({ event: binding.event, soundId, volume, minIntervalMs, enabled });
  }, [binding.event, soundId, volume, minIntervalMs, enabled]);

  const commit = () => {
    const unchanged =
      draft.soundId === soundId &&
      draft.volume === volume &&
      draft.minIntervalMs === minIntervalMs &&
      draft.enabled === enabled;
    if (unchanged) return;
    onChange(draft);
  };

  // Escolhas discretas (som, liga/desliga) valem uma ação só, sem rascunho.
  const choose = (changes: Partial<AudioBinding>) => {
    const next = { ...draft, ...changes };
    setDraft(next);
    onChange(next);
  };

  return (
    <div className={`balance-binding-row ${draft.enabled ? "" : "is-off"}`}>
      <div className="balance-binding-copy">
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </div>

      <select
        className="balance-binding-sound"
        aria-label={`Som de ${title}`}
        disabled={!editable}
        value={draft.soundId ?? ""}
        onChange={(event) => choose({ soundId: event.target.value || null })}
      >
        <option value="">Sem som</option>
        {sounds.map((sound) => (
          <option key={sound.id} value={sound.id} disabled={sound.enabled === false}>
            {sound.label} ({sound.id}){sound.enabled === false ? " — desativado" : ""}
          </option>
        ))}
      </select>

      <label className="balance-binding-slider">
        <span>VOL {Math.round(draft.volume * 100)}%</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(draft.volume * 100)}
          disabled={!editable}
          aria-label={`Volume de ${title}`}
          onChange={(event) => setDraft({ ...draft, volume: Number(event.target.value) / 100 })}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </label>

      <label className="balance-binding-slider">
        <span>MIN {draft.minIntervalMs}ms</span>
        <input
          type="range"
          min={0}
          max={600}
          step={10}
          value={draft.minIntervalMs}
          disabled={!editable}
          aria-label={`Intervalo mínimo de ${title}`}
          onChange={(event) => setDraft({ ...draft, minIntervalMs: Number(event.target.value) })}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
        />
      </label>

      <Toggle
        checked={draft.enabled}
        disabled={!editable}
        onChange={(next) => choose({ enabled: next })}
        on="ON"
        off="OFF"
      />

      <button
        type="button"
        className="home-item balance-button balance-test"
        onClick={() => previewBinding(draft)}
        disabled={!draft.soundId || draft.volume <= 0}
        title={
          !draft.soundId
            ? "Escolha um som antes"
            : draft.volume <= 0
              ? "Volume 0 — evento mudo"
              : `Ouvir ${soundLabel(sounds, draft.soundId)} a ${Math.round(draft.volume * 100)}%`
        }
      >
        TESTAR
      </button>
    </div>
  );
}
