"use client";

// PVP assíncrono: grava a build do jogador a cada confronto da fase player e
// busca builds reais de outros jogadores para servir como oponente.
// Escrita: cliente Supabase direto (RLS garante "só o próprio usuário").
// Leitura: via /api/snapshots (service role), que sorteia por "pass".

import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase-browser";
import type { BuildSnapshot } from "./types";

export async function recordBuildSnapshot(
  _user: User,
  snapshot: BuildSnapshot,
  catalogVersion?: string,
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;
    const res = await fetch("/api/snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ ...snapshot, catalogVersion }),
    });
    if (!res.ok) {
      console.error("Falha ao gravar snapshot da build:", res.status, await res.text());
    }
  } catch (error) {
    console.error("Falha ao gravar snapshot da build:", error);
  }
}

export async function fetchOpponentSnapshot(pass: number): Promise<BuildSnapshot | null> {
  const supabase = getSupabaseBrowserClient();
  let exclude = "";
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    exclude = data.session?.user?.id ?? "";
  }
  try {
    const res = await fetch(
      `/api/snapshots?pass=${pass}&exclude=${encodeURIComponent(exclude)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { snapshot: BuildSnapshot | null };
    return data?.snapshot ?? null;
  } catch {
    return null;
  }
}
