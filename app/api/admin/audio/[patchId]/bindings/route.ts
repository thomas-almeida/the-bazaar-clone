// Binding de um patch de áudio: PUT grava/atualiza o volume, o intervalo
// mínimo e a escolha de som de um evento nomeado.

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { isAudioBinding } from "@/lib/admin-audio";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ patchId: string }> },
) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    const { patchId } = await context.params;
    const binding: unknown = await request.json();
    if (!isAudioBinding(binding)) {
      return NextResponse.json({ error: "Os dados do evento de som são inválidos." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: patch, error: patchError } = await supabase
      .from("audio_patches")
      .select("status")
      .eq("id", patchId)
      .single();
    if (patchError) throw patchError;
    if (patch.status !== "draft") {
      return NextResponse.json({ error: "Somente um rascunho pode ser editado." }, { status: 409 });
    }

    // sound_id precisa existir no mesmo patch; caso contrário o binding ficaria
    // apontando para o vazio silenciosamente.
    if (binding.soundId) {
      const { data: sound } = await supabase
        .from("audio_patch_sounds")
        .select("sound_id")
        .eq("patch_id", patchId)
        .eq("sound_id", binding.soundId)
        .maybeSingle();
      if (!sound) {
        return NextResponse.json({ error: "O som escolhido não existe neste patch." }, { status: 400 });
      }
    }

    const { data: existing } = await supabase
      .from("audio_patch_bindings")
      .select("sort_order")
      .eq("patch_id", patchId)
      .eq("event", binding.event)
      .maybeSingle();

    let sortOrder = existing?.sort_order ?? 0;
    if (!existing) {
      const { count } = await supabase
        .from("audio_patch_bindings")
        .select("event", { count: "exact", head: true })
        .eq("patch_id", patchId);
      sortOrder = count ?? 0;
    }

    const { error } = await supabase.from("audio_patch_bindings").upsert(
      {
        patch_id: patchId,
        event: binding.event,
        sound_id: binding.soundId,
        volume: binding.volume,
        min_interval_ms: binding.minIntervalMs,
        enabled: binding.enabled,
        sort_order: sortOrder,
      },
      { onConflict: "patch_id,event" },
    );
    if (error) throw error;
    return NextResponse.json({ saved: true, binding });
  } catch (error) {
    console.error("Unable to save audio binding:", error);
    return NextResponse.json({ error: "Não foi possível salvar o evento de som." }, { status: 503 });
  }
}
