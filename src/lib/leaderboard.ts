"use client";

// Placar de líderes: grava o resultado da ÚLTIMA run de cada jogador (upsert em
// user_id) e lê o ranking via backend (service role).

import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase-browser";
import type { SnapshotSlot } from "./types";

export interface LeaderboardEntry {
  displayName: string;
  mageId: string;
  victories: number;
  completed: boolean;
  /** Build final da run: 4 posições, null no slot vazio. */
  slots: (SnapshotSlot | null)[];
  updatedAt: string;
}

export interface RunResult {
  name: string;
  mageId: string;
  victories: number;
  completed: boolean;
  slots: (SnapshotSlot | null)[];
}

/** Converte o tabuleiro do jogador no formato guardado no placar. */
export function toSnapshotSlots(
  slots: ({ id: string; def: { id: string }; tier: number } | null)[],
): (SnapshotSlot | null)[] {
  return slots.map((card) => (card ? { cardId: card.def.id, tier: card.tier } : null));
}

export async function recordRunResult(_user: User, result: RunResult): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(result),
    });
    if (!res.ok) {
      console.error("Falha ao gravar resultado no placar:", res.status, await res.text());
    }
  } catch (error) {
    console.error("Falha ao gravar resultado no placar:", error);
  }
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch("/api/leaderboard", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { entries: LeaderboardEntry[] };
    return data?.entries ?? [];
  } catch {
    return [];
  }
}
