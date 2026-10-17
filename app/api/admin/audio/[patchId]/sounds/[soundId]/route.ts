// Som de um patch de áudio: PUT grava/atualiza, DELETE remove. Ao remover um
// som, os bindings que apontam para ele vão para sound_id null (evento
// silencioso) em vez de sumirem — é reversível ao religar o som.

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { isSoundDefinition, normalizeSoundDefinition } from "@/lib/admin-audio";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireDraft(patchId: string) {
  const supabase = getSupabaseAdmin();
  const { data: patch, error } = await supabase.from("audio_patches").select("status").eq("id", patchId).single();
  if (error) throw error;
  return { supabase, status: patch.status as string };
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ patchId: string; soundId: string }> },
) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    const { patchId, soundId } = await context.params;
    const definition: unknown = await request.json();
    if (!isSoundDefinition(definition, soundId)) {
      return NextResponse.json({ error: "Os dados do som são inválidos." }, { status: 400 });
    }
    const normalized = normalizeSoundDefinition(definition);

    const { supabase, status } = await requireDraft(patchId);
    if (status !== "draft") {
      return NextResponse.json({ error: "Somente um rascunho pode ser editado." }, { status: 409 });
    }

    const { data: existing } = await supabase
      .from("audio_patch_sounds")
      .select("sort_order")
      .eq("patch_id", patchId)
      .eq("sound_id", soundId)
      .maybeSingle();

    const { error } = await supabase.from("audio_patch_sounds").upsert(
      {
        patch_id: patchId,
        sound_id: soundId,
        label: normalized.label,
        path: normalized.path,
        category: normalized.category,
        enabled: normalized.enabled !== false,
        sort_order: existing?.sort_order ?? 0,
      },
      { onConflict: "patch_id,sound_id" },
    );
    if (error) throw error;
    return NextResponse.json({ saved: true, sound: { ...normalized, enabled: normalized.enabled !== false } });
  } catch (error) {
    console.error("Unable to save audio sound:", error);
    return NextResponse.json({ error: "Não foi possível salvar o som." }, { status: 503 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ patchId: string; soundId: string }> },
) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    const { patchId, soundId } = await context.params;
    const { supabase, status } = await requireDraft(patchId);
    if (status !== "draft") {
      return NextResponse.json({ error: "Somente um rascunho pode ser editado." }, { status: 409 });
    }

    const { error } = await supabase
      .from("audio_patch_bindings")
      .update({ sound_id: null, enabled: false })
      .eq("patch_id", patchId)
      .eq("sound_id", soundId);
    if (error) throw error;

    const { error: deleteError } = await supabase
      .from("audio_patch_sounds")
      .delete()
      .eq("patch_id", patchId)
      .eq("sound_id", soundId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Unable to delete audio sound:", error);
    return NextResponse.json({ error: "Não foi possível remover o som." }, { status: 503 });
  }
}
