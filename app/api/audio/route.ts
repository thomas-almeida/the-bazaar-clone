// Backend de áudio — route handler do Next.js.
// Contrato: GET /api/audio -> AudioConfigResponse (ver src/lib/audio.ts).
// Serve o patch de áudio publicado. O cliente busca uma vez por página e usa
// como fallback a biblioteca local quando não há credencial server-only
// configurada (apenas em desenvolvimento).

import { NextResponse } from "next/server";
import { buildDefaultAudioConfig, type AudioBinding } from "@/lib/audio";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(buildDefaultAudioConfig(), { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: patch, error: patchError } = await supabase
      .from("audio_patches")
      .select("id,name")
      .eq("status", "published")
      .single();
    if (patchError) throw patchError;

    const [{ data: sounds, error: soundsError }, { data: bindings, error: bindingsError }] = await Promise.all([
      supabase
        .from("audio_patch_sounds")
        .select("sound_id,label,path,category,enabled,sort_order")
        .eq("patch_id", patch.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("audio_patch_bindings")
        .select("event,sound_id,volume,min_interval_ms,enabled")
        .eq("patch_id", patch.id)
        .order("sort_order", { ascending: true }),
    ]);
    if (soundsError) throw soundsError;
    if (bindingsError) throw bindingsError;
    if (!sounds?.length) throw new Error("The published audio patch contains no sounds.");

    return NextResponse.json(
      {
        version: patch.name,
        sounds: sounds.map((row) => ({
          id: row.sound_id,
          label: row.label,
          path: row.path,
          category: row.category,
          enabled: row.enabled,
        })),
        // Bindings cujo som não existe (ou está desativado) chegam aqui; o
        // runtime ignora e cai no valor padrão do evento.
        bindings: (bindings ?? []).map((row) => ({
          event: row.event,
          soundId: row.sound_id ?? null,
          volume: row.volume,
          minIntervalMs: row.min_interval_ms,
          enabled: row.enabled,
        })) satisfies AudioBinding[],
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load the published audio patch:", error);
    return NextResponse.json(
      { error: "Não foi possível carregar a configuração de áudio publicada do Supabase." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
