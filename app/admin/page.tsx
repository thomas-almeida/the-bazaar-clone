"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CardDef, CardKind, EffectType } from "@/lib/types";
import AppBackground from "@/components/AppBackground";

interface Patch {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  created_at: string;
}

interface PatchResponse {
  patches: Patch[];
  selectedId: string | null;
  activePatchId: string | null;
  cards: CardDef[];
}

const KIND_LABEL: Record<CardKind, string> = {
  creature: "Criatura",
  spell: "Feitiço",
  equipment: "Equipamento",
};

const STATUS_LABEL: Record<Patch["status"], string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Erro ${response.status}`);
  return body;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="balance-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<"checking" | "login" | "ready">("checking");
  const [password, setPassword] = useState("");
  const [data, setData] = useState<PatchResponse | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [form, setForm] = useState<CardDef | null>(null);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newPatchName, setNewPatchName] = useState("");
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const selectedPatch = data?.patches.find((patch) => patch.id === data.selectedId) ?? null;
  const editable = selectedPatch?.status === "draft";

  const load = useCallback(async (patchId?: string) => {
    const query = patchId ? `?patchId=${encodeURIComponent(patchId)}` : "";
    const response = await fetch(`/api/admin/patches${query}`, { cache: "no-store" });
    if (response.status === 401) {
      setSession("login");
      setData(null);
      return;
    }
    const result = await readJson(response) as PatchResponse;
    setData(result);
    setSelectedCardId((current) =>
      result.cards.some((card) => card.id === current) ? current : result.cards[0]?.id ?? null,
    );
    setSession("ready");
    setError("");
  }, []);

  useEffect(() => {
    load().catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Falha ao carregar o painel.");
      setSession("ready");
    });
  }, [load]);

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

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await readJson(await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      }));
      setPassword("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function createPatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await readJson(await fetch("/api/admin/patches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPatchName }),
      })) as { patch: Patch };
      setNewPatchName("");
      await load(result.patch.id);
      setMessage("Novo rascunho criado com uma cópia do patch publicado.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o rascunho.");
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
      setMessage("Arte enviada para public/card-art. Inclua o arquivo no Git para disponibilizá-lo no deploy.");
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
      await readJson(await fetch(`/api/admin/patches/${selectedPatch.id}/publish`, { method: "POST" }));
      await load(selectedPatch.id);
      setMessage("Patch publicado. As novas runs já usarão este catálogo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível publicar.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    setData(null);
    setSession("login");
  }

  if (session === "checking") {
    return <main className="balance-admin"><AppBackground /><p className="balance-loading">Carregando painel…</p></main>;
  }

  if (session === "login") {
    return (
      <main className="balance-admin balance-login-wrap">
        <AppBackground />
        <form className="balance-login fullscreen-prompt-panel" onSubmit={login}>
          <span className="balance-kicker">MAGGI · FERRAMENTAS</span>
          <h1>Balanceamento</h1>
          <p>Acesso restrito. Entre com a senha administrativa.</p>
          <Field label="Senha administrativa">
            <input autoFocus type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          {error && <p className="balance-error" role="alert">{error}</p>}
          <button className="home-item balance-button" disabled={busy || !password}>
            {busy ? "ENTRANDO…" : "ENTRAR"}
          </button>
          <a href="/" className="balance-back">← Voltar ao jogo</a>
        </form>
      </main>
    );
  }

  return (
    <main className="balance-admin">
      <AppBackground />
      <header className="balance-header">
        <div>
          <img className="balance-brand-logo" src="/boargame/img/logo-game.png" alt="MAGGI" />
          <span className="balance-kicker">MAGGI · FERRAMENTAS</span>
          <h1>Editor de cartas</h1>
          <p>Edite os dados do catálogo em rascunhos versionados.</p>
        </div>
        <nav className="balance-header-actions">
          <a className="home-item balance-button" href="/">VOLTAR AO JOGO</a>
          <button className="home-item balance-button" onClick={logout}>SAIR</button>
        </nav>
      </header>

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
        <form className="balance-new-patch" onSubmit={createPatch}>
          <Field label="Novo rascunho">
            <input value={newPatchName} maxLength={100} placeholder="Ex.: Balanceamento de junho" onChange={(event) => setNewPatchName(event.target.value)} />
          </Field>
          <button className="home-item balance-button" disabled={busy || !newPatchName.trim()}>CRIAR CÓPIA</button>
        </form>
        <div className="balance-patch-state">
          <span>{selectedPatch ? STATUS_LABEL[selectedPatch.status] : "Sem patch"}</span>
          {selectedPatch?.id === data?.activePatchId && <small>VERSÃO EM USO</small>}
          {editable && <button className="home-item balance-button balance-publish" disabled={busy} onClick={() => setPublishConfirmOpen(true)}>PUBLICAR PATCH</button>}
        </div>
      </section>

      {(error || message) && (
        <p className={error ? "balance-error balance-notice" : "balance-success balance-notice"} role="status">
          {error || message}
        </p>
      )}

      <section className="balance-workspace">
        <aside className="balance-card-list panel-glass">
          <div className="balance-list-head">
            <h2>Cartas <span>{filteredCards.length}</span></h2>
            <input aria-label="Buscar cartas" value={search} placeholder="Nome, ID ou arte…" onChange={(event) => setSearch(event.target.value)} />
            <select aria-label="Filtrar por tipo" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
              <option value="all">Todos os tipos</option>
              {Object.entries(KIND_LABEL).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}
            </select>
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
                <label className={`balance-toggle ${form.enabled === false ? "is-off" : ""}`}>
                  <input type="checkbox" checked={form.enabled !== false} disabled={!editable} onChange={(event) => setForm({ ...form, enabled: event.target.checked })} />
                  <span>{form.enabled === false ? "Arquivada" : "Disponível"}</span>
                </label>
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
                        <option value="self">Próprio lado</option><option value="enemy">Adversário</option>
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
                      <option value="image">Imagem</option><option value="video">Vídeo</option>
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
                <button className="home-item balance-button balance-save" disabled={busy || !editable} onClick={saveCard}>
                  {busy ? "SALVANDO…" : "SALVAR CARTA"}
                </button>
              </footer>
            </>
          )}
        </section>
      </section>
      {publishConfirmOpen && selectedPatch && (
        <section
          className="fullscreen-prompt"
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-patch-title"
          aria-describedby="publish-patch-description"
        >
          <div className="fullscreen-prompt-panel">
            <p className="fullscreen-prompt-eyebrow">MAGGI · BALANCEAMENTO</p>
            <h2 id="publish-patch-title">PUBLICAR PATCH?</h2>
            <p id="publish-patch-description" className="fullscreen-prompt-copy">
              “{selectedPatch.name}” passará a valer para todas as novas runs.
              O patch publicado anteriormente será preservado no histórico.
            </p>
            <div className="fullscreen-prompt-actions">
              <button
                type="button"
                className="home-item home-item--play fullscreen-prompt-action"
                disabled={busy}
                onClick={() => void publishPatch()}
              >
                <span className="home-item-label">{busy ? "PUBLICANDO…" : "CONFIRMAR PUBLICAÇÃO"}</span>
                <span className="home-item-tag" aria-hidden="true">✓</span>
              </button>
              <button
                type="button"
                className="home-item fullscreen-prompt-action"
                disabled={busy}
                onClick={() => setPublishConfirmOpen(false)}
              >
                <span className="home-item-label">CANCELAR</span>
                <span className="home-item-sub">voltar ao editor</span>
              </button>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
