"use client";

// Aba CARTAS do painel de balanceamento: editor de cartas em patches
// versionados. Extraído de app/admin/page.tsx quando a aba de Sons entrou.

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CardDef, CardKind, CardSound, EffectType } from "@/lib/types";
import { slugifyCardId } from "@/lib/admin-cards";
import { useSoundEvent } from "@/components/useSoundEvent";
import Spinner from "@/components/Spinner";
import { usePendingAction } from "@/components/usePendingAction";
import {
  Field,
  KIND_LABEL,
  PublishDialog,
  readJson,
  STATUS_LABEL,
  Toggle,
  type AdminPatch,
} from "./shared";

interface PatchResponse {
  patches: AdminPatch[];
  selectedId: string | null;
  activePatchId: string | null;
  cards: CardDef[];
}

export default function CardsTab({ onNotice }: { onNotice: (message: string) => void }) {
  const [data, setData] = useState<PatchResponse | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [form, setForm] = useState<CardDef | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newPatchName, setNewPatchName] = useState("");
  const [newCardName, setNewCardName] = useState("");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const selectedPatch = data?.patches.find((patch) => patch.id === data.selectedId) ?? null;
  const editable = selectedPatch?.status === "draft";
  const { is: isPending, run: runPending } = usePendingAction();

  const soundSave = useSoundEvent("ui:admin.save");
  const soundPublish = useSoundEvent("ui:admin.publish");
  const soundNewPatch = useSoundEvent("ui:admin.newPatch");

  const load = useCallback(async (patchId?: string) => {
    const query = patchId ? `?patchId=${encodeURIComponent(patchId)}` : "";
    const response = await fetch(`/api/admin/patches${query}`, { cache: "no-store" });
    const result = await readJson(response) as PatchResponse;
    setData(result);
    setSelectedCardId((current) =>
      result.cards.some((card) => card.id === current) ? current : result.cards[0]?.id ?? null,
    );
    setError("");
  }, []);

  useEffect(() => {
    load().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Falha ao carregar o painel."));
  }, [load]);

  // Propaga mensagens para o shell (que mostra a barra de status do admin).
  useEffect(() => {
    if (message) onNotice(message);
  }, [message, onNotice]);

  const selectedCard = data?.cards.find((card) => card.id === selectedCardId) ?? null;
  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.cards ?? []).filter((card) => {
      const matchesSearch = !query || [card.name, card.id, card.art?.src ?? ""]
        .some((field) => field.toLowerCase().includes(query));
      return matchesSearch && (kindFilter === "all" || card.kind === kindFilter);
    });
  }, [data?.cards, kindFilter, search]);

  useEffect(() => {
    setForm(selectedCard ? structuredClone(selectedCard) : null);
  }, [selectedCard]);

  async function createPatch() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      soundNewPatch();
      const result = await readJson(await fetch("/api/admin/patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPatchName }),
      })) as { patch: AdminPatch };
      setNewPatchName("");
      await load(result.patch.id);
      setMessage("Novo rascunho criado com uma cópia do patch publicado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o rascunho.");
    } finally {
      setBusy(false);
    }
  }

  async function createCard() {
    if (!selectedPatch || !editable) return;
    const name = newCardName.trim();
    const id = slugifyCardId(name);
    if (!name || !id) {
      setError("Dê um nome que gere um id válido (letras/números).");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      soundSave();
      // Carta nova em branco; todos os efeitos/mecânicas são ajustados no
      // formulário logo após a criação.
      const definition: CardDef = {
        id,
        name,
        kind: "spell",
        cost: 1,
        cooldown: 2,
        effectType: "damage",
        effectValue: 1,
        description: "",
      };
      await readJson(await fetch(`/api/admin/patches/${selectedPatch.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition }),
      }));
      setNewCardName("");
      setSelectedCardId(id); // abre a carta nova no editor
      await load(selectedPatch.id);
      setMessage(`Carta "${name}" criada no rascunho. Ajuste os campos e publique.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a carta.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCard() {
    if (!data || !form || !selectedPatch || !editable) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      soundSave();
      await readJson(await fetch(`/api/admin/patches/${selectedPatch.id}/cards/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }));
      setData({ ...data, cards: data.cards.map((card) => card.id === form.id ? structuredClone(form) : card) });
      setMessage(`${form.name} salvo no rascunho.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a carta.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadArt(file: File) {
    if (!form) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const result = await readJson(await fetch("/api/admin/art", { method: "POST", body })) as { art: CardDef["art"] };
      setForm({ ...form, art: result.art });
      setMessage("Arte enviada para public/card-art. Inclua o arquivo no Git para disponibilizá-la no deploy.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a arte.");
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
      await readJson(await fetch(`/api/admin/patches/${selectedPatch.id}/publish`, { method: "POST" }));
      await load(selectedPatch.id);
      setMessage("Patch publicado. As novas runs já usarão este catálogo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <section className="balance-workspace">
        <p className="balance-error" role="alert">{error}</p>
      </section>
    );
  }

  return (
    <>
      <section className="balance-patch-bar panel-glass">
        <Field label="Patch selecionado">
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
            <input value={newPatchName} maxLength={100} placeholder="Ex.: Balanceamento de junho" onChange={(event) => setNewPatchName(event.target.value)} />
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
          {editable && (
            <button
              className="home-item balance-button balance-publish"
              disabled={busy}
              onClick={() => setPublishConfirmOpen(true)}
            >
              PUBLICAR PATCH
            </button>
          )}
        </div>
      </section>

      {error && <p className="balance-error balance-notice" role="alert">{error}</p>}

      <section className="balance-workspace">
        <aside className="balance-card-list panel-glass">
          <div className="balance-list-head">
            <h2>Cartas <span>{filteredCards.length}</span></h2>
            <input aria-label="Buscar cartas" value={search} placeholder="Nome, ID ou arte…" onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filtrar por tipo" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
              <option value="all">Todos os tipos</option>
              {Object.entries(KIND_LABEL).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select>
            {editable && (
              <form
                className="balance-new-card"
                onSubmit={(event) => { event.preventDefault(); void createCard(); }}
              >
                <input
                  aria-label="Nome da nova carta"
                  value={newCardName}
                  maxLength={80}
                  placeholder="Nova carta: nome…"
                  onChange={(event) => setNewCardName(event.target.value)}
                />
                <button
                  type="submit"
                  className="home-item balance-button"
                  disabled={busy || !slugifyCardId(newCardName)}
                >
                  CRIAR CARTA
                </button>
                {newCardName.trim() && (
                  <small className="balance-new-card-id">
                    id: {slugifyCardId(newCardName) || "—"}
                  </small>
                )}
              </form>
            )}
          </div>
          <div className="balance-card-items">
            {filteredCards.map((card) => (
              <button
                type="button"
                key={card.id}
                className={`balance-card-row ${card.id === selectedCardId ? "is-selected" : ""} ${card.enabled === false ? "is-disabled" : ""}`}
                onClick={() => setSelectedCardId(card.id)}
              >
                <span className="balance-card-thumb">
                  {card.art?.kind === "image" ? <img src={card.art.src} alt="" /> : <span>{card.kind === "spell" ? "✦" : "◇"}</span>}
                </span>
                <span className="balance-card-row-copy">
                  <strong>{card.name}</strong>
                  <small>{KIND_LABEL[card.kind]} · {card.id}</small>
                </span>
                {card.enabled === false && <small className="balance-archived">ARQUIVADA</small>}
              </button>
            ))}
            {filteredCards.length === 0 && <p className="balance-empty">Nenhuma carta encontrada.</p>}
          </div>
        </aside>

        <section className="balance-editor panel-glass">
          {!form ? <p className="balance-empty">Selecione uma carta para editar.</p> : (
            <>
              <div className="balance-editor-heading">
                <div><span className="balance-kicker">{form.id}</span><h2>{form.name}</h2></div>
                <Toggle
                  checked={form.enabled !== false}
                  disabled={!editable}
                  onChange={(next) => setForm({ ...form, enabled: next })}
                  on="Disponível"
                  off="Arquivada"
                />
              </div>

              <div className="balance-editor-grid">
                <Field label="Nome"><input disabled={!editable} maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
                <Field label="Tipo">
                  <select disabled={!editable} value={form.kind} onChange={(event) => {
                    const kind = event.target.value as CardKind;
                    if (kind === "creature") {
                      setForm({ ...form, kind, effectType: undefined, effectValue: undefined, target: undefined, valueHaste: undefined, cooldownHaste: undefined });
                    } else if (kind === "spell") {
                      setForm({ ...form, kind, level: undefined, damage: undefined, target: undefined, valueHaste: undefined, cooldownHaste: undefined, effectType: form.effectType ?? "damage", effectValue: form.effectValue ?? 0 });
                    } else {
                      setForm({ ...form, kind, level: undefined, damage: undefined, effectType: undefined, effectValue: undefined, target: form.target ?? "self" });
                    }
                  }}>
                    {Object.entries(KIND_LABEL).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Custo"><input disabled={!editable} type="number" min="0" step="1" value={form.cost} onChange={(event) => setForm({ ...form, cost: Number(event.target.value) })} /></Field>
                <Field label="Cooldown (s)"><input disabled={!editable || form.kind === "equipment"} type="number" min="0" step="0.1" value={form.cooldown} onChange={(event) => setForm({ ...form, cooldown: Number(event.target.value) })} /></Field>
                <Field label="Som (cooldown)">
                  <select
                    disabled={!editable}
                    value={form.sound ?? ""}
                    onChange={(event) => setForm({ ...form, sound: event.target.value ? (event.target.value as CardSound) : undefined })}
                  >
                    <option value="">Automático (pelo efeito)</option>
                    <option value="sword">Espada (sword)</option>
                    <option value="pistol">Pistola (pistol)</option>
                    <option value="blast">Explosão (blast)</option>
                    <option value="heal">Cura (heal)</option>
                    <option value="shield">Escudo (shield)</option>
                    <option value="haste">Aceleração (haste)</option>
                  </select>
                </Field>
                <Field label="Peça (sem dano)">
                  <Toggle
                    checked={!!form.piece}
                    disabled={!editable}
                    onChange={(next) => setForm({ ...form, piece: next || undefined })}
                    on="Peça"
                    off="Normal"
                  />
                </Field>
                {form.piece && (
                  <Field label="Sangramento/s (passo)">
                    <input
                      disabled={!editable}
                      type="number"
                      min="0"
                      step="0.5"
                      value={form.bleed ?? 0}
                      onChange={(event) => setForm({ ...form, bleed: Number(event.target.value) || undefined })}
                    />
                  </Field>
                )}
                <small className="balance-editor-hint">
                  Este campo é o padrão herdado. Para escolher arquivo, volume e intervalo por carta, use a aba <strong>SONS</strong>.
                </small>
                {form.kind === "creature" && <Field label="Nível"><input disabled={!editable} type="number" min="1" step="1" value={form.level ?? 1} onChange={(event) => setForm({ ...form, level: Number(event.target.value) })} /></Field>}
                {form.kind === "creature" && <Field label="Dano"><input disabled={!editable} type="number" min="0" step="1" value={form.damage ?? 0} onChange={(event) => setForm({ ...form, damage: Number(event.target.value) })} /></Field>}
                {form.kind === "spell" && (
                  <>
                    <Field label="Efeito">
                      <select disabled={!editable} value={form.effectType ?? "damage"} onChange={(event) => setForm({ ...form, effectType: event.target.value as EffectType })}>
                        <option value="damage">Dano</option><option value="healing">Cura</option><option value="shield">Escudo</option>
                      </select>
                    </Field>
                    <Field label="Valor do efeito"><input disabled={!editable} type="number" min="0" step="1" value={form.effectValue ?? 0} onChange={(event) => setForm({ ...form, effectValue: Number(event.target.value) })} /></Field>
                  </>
                )}
                {form.kind === "equipment" && (
                  <>
                    <Field label="Alvo">
                      <select disabled={!editable} value={form.target ?? "self"} onChange={(event) => setForm({ ...form, target: event.target.value as "self" | "enemy" })}>
                        <option value="self">Próprio lado</option>
                        <option value="enemy">Adversário</option>
                      </select>
                    </Field>
                    <Field label="Haste de valor"><input disabled={!editable} type="number" min="0" step="0.01" value={form.valueHaste ?? 0} onChange={(event) => setForm({ ...form, valueHaste: Number(event.target.value) })} /></Field>
                    <Field label="Haste de cooldown"><input disabled={!editable} type="number" min="0" step="0.01" value={form.cooldownHaste ?? 0} onChange={(event) => setForm({ ...form, cooldownHaste: Number(event.target.value) })} /></Field>
                  </>
                )}
                <Field label="Descrição"><textarea disabled={!editable} rows={3} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
              </div>

              <div className="balance-art-section">
                <div className="balance-art-preview">
                  {form.art?.kind === "image" ? <img src={form.art.src} alt={`Arte de ${form.name}`} /> : form.art?.kind === "video" ? <video src={form.art.src} poster={form.art.poster} muted loop autoPlay playsInline /> : <span>ARTE PADRÃO DO JOGO</span>}
                </div>
                <div className="balance-art-fields">
                  <h3>Arte</h3>
                  <Field label="URL ou caminho público">
                    <input disabled={!editable} value={form.art?.src ?? ""} placeholder="/card-art/minha-arte.png ou https://…" onChange={(event) => setForm({ ...form, art: event.target.value ? { kind: form.art?.kind ?? "image", src: event.target.value, ...(form.art?.poster ? { poster: form.art.poster } : {}) } : undefined })} />
                  </Field>
                  <Field label="Formato">
                    <select disabled={!editable} value={form.art?.kind ?? "image"} onChange={(event) => setForm({ ...form, art: form.art ? { ...form.art, kind: event.target.value as "image" | "video" } : undefined })}>
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                    </select>
                  </Field>
                  <Field label="Enviar imagem (somente desenvolvimento)">
                    <input disabled={!editable || busy} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadArt(file);
                      event.currentTarget.value = "";
                    }} />
                  </Field>
                  <small>Envios locais ficam em public/card-art. Faça commit do arquivo para incluí-lo no deploy.</small>
                </div>
              </div>

              {form.synergy && (
                <div className="balance-synergy">
                  <h3>Sinergia</h3>
                  <Field label="Texto da sinergia"><input disabled={!editable} value={form.synergy.label} onChange={(event) => setForm({ ...form, synergy: { ...form.synergy!, label: event.target.value } })} /></Field>
                  <div className="balance-editor-grid">
                    <Field label="Direção">
                      <select disabled={!editable} value={form.synergy.dir} onChange={(event) => setForm({ ...form, synergy: { ...form.synergy!, dir: event.target.value as "left" | "right" | "both" } })}>
                        <option value="left">Esquerda</option><option value="right">Direita</option><option value="both">Ambos os lados</option>
                      </select>
                    </Field>
                    <Field label="Requisito">
                      <select disabled={!editable} value={form.synergy.requires ?? ""} onChange={(event) => setForm({ ...form, synergy: { ...form.synergy!, requires: event.target.value ? event.target.value as NonNullable<CardDef["synergy"]>["requires"] : undefined } })}>
                        <option value="">Qualquer carta</option>
                        <option value="creature">Criatura</option><option value="spell">Feitiço</option><option value="equipment">Equipamento</option>
                        <option value="damage">Dano</option><option value="healing">Cura</option><option value="shield">Escudo</option>
                      </select>
                    </Field>
                    <Field label="Bônus de valor"><input disabled={!editable} type="number" step="1" value={form.synergy.bonusValue ?? 0} onChange={(event) => setForm({ ...form, synergy: { ...form.synergy!, bonusValue: Number(event.target.value) } })} /></Field>
                    <Field label="Multiplicador de cooldown"><input disabled={!editable} type="number" min="0" step="0.05" value={form.synergy.cooldownMult ?? 1} onChange={(event) => setForm({ ...form, synergy: { ...form.synergy!, cooldownMult: Number(event.target.value) } })} /></Field>
                  </div>
                </div>
              )}

              <footer className="balance-editor-footer">
                {selectedPatch?.status !== "draft" && <span>Este patch é somente leitura. Crie um rascunho para editar.</span>}
                <button
                  className={`home-item balance-button balance-save${isPending("save") ? " is-loading" : ""}`}
                  disabled={busy || !editable}
                  aria-busy={isPending("save") || undefined}
                  onClick={() => void runPending("save", saveCard)}
                >
                  {busy ? "SALVANDO…" : "SALVAR CARTA"}
                  {isPending("save") && <Spinner />}
                </button>
              </footer>
            </>
          )}
        </section>
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
