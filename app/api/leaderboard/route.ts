// Placar de líderes.
// GET /api/leaderboard -> { entries: LeaderboardEntry[] }  (ordena: concluiu →
//   vitórias → mais recente).
// POST /api/leaderboard -> grava o resultado da última run (upsert por usuário).
//   O servidor valida o token do usuário e escreve com service role, evitando
//   problemas de RLS a partir do cliente.

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import type { SnapshotSlot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SLOTS = 4;
const MAX_TIER = 5;

function bearer(req: NextRequest): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

/**
 * Valida a build vinda do cliente. Descarta posição malformada em vez de
 * recusar a run inteira: perder um placar por um slot ruim é pior do que
 * mostrar um slot a menos. O cardId é confrontado com o catálogo na renderização.
 */
function parseSlots(value: unknown): (SnapshotSlot | null)[] {
  if (!Array.isArray(value)) return [];
  const slots: (SnapshotSlot | null)[] = [];
  for (const item of value.slice(0, MAX_SLOTS)) {
    if (item === null || item === undefined) {
      slots.push(null);
      continue;
    }
    if (typeof item !== "object") {
      slots.push(null);
      continue;
    }
    const { cardId, tier } = item as { cardId?: unknown; tier?: unknown };
    const validId = typeof cardId === "string" && /^[a-z0-9-]{1,64}$/.test(cardId);
    const validTier = Number.isInteger(tier) && (tier as number) >= 0 && (tier as number) <= MAX_TIER;
    slots.push(validId && validTier ? { cardId, tier: tier as number } : null);
  }
  while (slots.length < MAX_SLOTS) slots.push(null);
  return slots;
}

function parseSlotsColumn(value: unknown): (SnapshotSlot | null)[] {
  const slots = parseSlots(value);
  return slots.length > 0 ? slots : [];
}

/**
 * A coluna `slots` só existe depois da migration 20260601000002. Sem ela, tanto
 * a leitura quanto a gravação falham. Em vez de derrubar o placar inteiro
 * enquanto a migration não roda, caímos para a consulta antiga: o placar volta a
 * funcionar, só sem a build.
 */
function isMissingSlotsColumn(error: { code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42703" || error.code === "PGRST204";
}

interface LeaderboardRow {
  display_name: string;
  mage_id: string;
  victories: number;
  completed: boolean;
  slots?: unknown;
  updated_at: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = (await req.json()) as {
      name?: unknown;
      mageId?: unknown;
      victories?: unknown;
      completed?: unknown;
      slots?: unknown;
    };
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "JOGADOR";
    const mageId = typeof body.mageId === "string" ? body.mageId.slice(0, 40) : "";
    const victories = Number.isInteger(body.victories) ? (body.victories as number) : 0;
    const completed = body.completed === true;
    const slots = parseSlotsColumn(body.slots);

    const base = {
      user_id: userData.user.id,
      display_name: name,
      mage_id: mageId,
      victories: Math.max(0, Math.min(999, victories)),
      completed,
      updated_at: new Date().toISOString(),
    };
    // null (não []) quando não veio nada: distingue "sem build gravada" de
    // "build de 4 slots vazios".
    const withSlots = { ...base, slots: slots.length > 0 ? slots : null };

    let error = (await supabase.from("leaderboard").upsert(withSlots, { onConflict: "user_id" })).error;
    if (isMissingSlotsColumn(error)) {
      // Migration ainda não aplicada: grava o placar sem a build.
      console.warn("leaderboard.slots ausente: rode a migration 20260601000002 para gravar a build.");
      error = (await supabase.from("leaderboard").upsert(base, { onConflict: "user_id" })).error;
    }
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao gravar resultado no placar:", error);
    return NextResponse.json({ error: "Falha ao gravar." }, { status: 500 });
  }
}

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ entries: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const supabase = getSupabaseAdmin();
    const withBuild = await supabase
      .from("leaderboard")
      .select("display_name,mage_id,victories,completed,updated_at,slots")
      .order("completed", { ascending: false })
      .order("victories", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(100);

    let rows = withBuild.data as LeaderboardRow[] | null;
    let error = withBuild.error;
    let hasSlots = true;

    if (isMissingSlotsColumn(error)) {
      // Migration ainda não aplicada: lê sem a build, em vez de devolver vazio.
      console.warn("leaderboard.slots ausente: rode a migration 20260601000002 para ver a build.");
      hasSlots = false;
      const fallback = await supabase
        .from("leaderboard")
        .select("display_name,mage_id,victories,completed,updated_at")
        .order("completed", { ascending: false })
        .order("victories", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(100);
      rows = fallback.data as LeaderboardRow[] | null;
      error = fallback.error;
    }
    if (error) throw error;

    const entries: LeaderboardEntry[] = (rows ?? []).map((row) => ({
      displayName: row.display_name,
      mageId: row.mage_id,
      victories: row.victories,
      completed: row.completed,
      // Runs antigas não têm build: caem em array vazio e a tela não desenha
      // nada abaixo do jogador.
      slots: hasSlots ? parseSlotsColumn(row.slots) : [],
      updatedAt: row.updated_at,
    }));
    return NextResponse.json({ entries }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao carregar o placar:", error);
    return NextResponse.json({ entries: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
