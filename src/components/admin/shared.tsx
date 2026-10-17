"use client";

// Peças compartilhadas entre as abas Cartas e Sons do painel de balanceamento.

import type { SoundCategory } from "@/lib/audio";
import type { CardKind } from "@/lib/types";
import Spinner from "@/components/Spinner";

export const SOUND_CATEGORY_KEYS: SoundCategory[] = ["dado", "item", "ui"];

export interface AdminPatch {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  created_at: string;
}

export const STATUS_LABEL: Record<AdminPatch["status"], string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export const KIND_LABEL: Record<CardKind, string> = {
  creature: "Herói",
  spell: "Feitiço",
  equipment: "Equipamento",
};

export async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Erro ${response.status}`);
  return body;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="balance-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Toggle({
  checked,
  disabled,
  onChange,
  on,
  off,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  on: string;
  off: string;
}) {
  return (
    <label className={`balance-toggle ${checked ? "" : "is-off"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{checked ? on : off}</span>
    </label>
  );
}

export function PublishDialog({
  patchName,
  busy,
  pending = false,
  onConfirm,
  onCancel,
}: {
  patchName: string;
  busy: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
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
          “{patchName}” passará a valer para todas as novas runs.
          O patch publicado anteriormente será preservado no histórico.
        </p>
        <div className="fullscreen-prompt-actions">
          <button
            type="button"
            className={`home-item home-item--play fullscreen-prompt-action${pending ? " is-loading" : ""}`}
            disabled={busy}
            aria-busy={pending || undefined}
            onClick={onConfirm}
          >
            <span className="home-item-label">{busy ? "PUBLICANDO…" : "CONFIRMAR PUBLICAÇÃO"}</span>
            <span className="home-item-tag" aria-hidden="true">✓</span>
            {pending && <Spinner />}
          </button>
          <button
            type="button"
            className="home-item fullscreen-prompt-action"
            disabled={busy}
            onClick={onCancel}
          >
            <span className="home-item-label">CANCELAR</span>
            <span className="home-item-sub">voltar ao editor</span>
          </button>
        </div>
      </div>
    </section>
  );
}
