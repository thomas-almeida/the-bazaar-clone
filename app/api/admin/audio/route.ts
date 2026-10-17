// Patches de áudio (admin): lista/seleção e criação de rascunho, espelhando
// app/api/admin/patches. A diferença é que um rascunho de áudio copia os sons
// e os bindings do patch de áudio publicado.

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { buildDefaultAudioConfig, type AudioBinding, type SoundDef } from "@/lib/audio";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_PATCH = "local";
const READ_ONLY_WARNING =
  "Migration de áudio não aplicada no Supabase: mostrando a biblioteca local, somente leitura. " +
  "Rode supabase/migrations/20260601000001_audio_editor.sql no SQL Editor e recarregue a página.";

export interface AudioPatch {
  id: string;
  name: string;
  status: "draft" | "published" | "archived";
  created_at: string;
}

export interface AudioPatchResponse {
  patches: AudioPatch[];
  selectedId: string | null;
  activePatchId: string | null;
  sounds: SoundDef[];
  bindings: AudioBinding[];
  /** Modo leitura: a migration ainda não foi aplicada (somente desenvolvimento). */
  readOnly?: boolean;
  warning?: string;
}

export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    const [{ data: patches, error: patchError }, { data: activePatch, error: activeError }] = await Promise.all([
      supabase.from("audio_patches").select("id,name,status,created_at,published_at").order("created_at", { ascending: false }),
      supabase.from("audio_patches").select("id").eq("status", "published").maybeSingle(),
    ]);
    if (patchError) throw patchError;
    if (activeError) throw activeError;

    const requestedId = new URL(request.url).searchParams.get("patchId");
    const selectedId = requestedId ?? patches?.find((p) => p.status === "published")?.id ?? patches?.[0]?.id;
    let sounds: SoundDef[] = [];
    let bindings: AudioBinding[] = [];
    if (selectedId) {
      const [soundResult, bindingResult] = await Promise.all([
        supabase
          .from("audio_patch_sounds")
          .select("sound_id,label,path,category,enabled,sort_order")
          .eq("patch_id", selectedId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("audio_patch_bindings")
          .select("event,sound_id,volume,min_interval_ms,enabled,sort_order")
          .eq("patch_id", selectedId)
          .order("sort_order", { ascending: true }),
      ]);
      if (soundResult.error) throw soundResult.error;
      if (bindingResult.error) throw bindingResult.error;
      sounds = (soundResult.data ?? []).map((row) => ({
        id: row.sound_id,
        label: row.label,
        path: row.path,
        category: row.category,
        enabled: row.enabled,
      }));
      bindings = (bindingResult.data ?? []).map((row) => ({
        event: row.event,
        soundId: row.sound_id ?? null,
        volume: row.volume,
        minIntervalMs: row.min_interval_ms,
        enabled: row.enabled,
      }));
    }

    return NextResponse.json({
      patches: patches ?? [],
      selectedId: selectedId ?? null,
      activePatchId: activePatch?.id ?? null,
      sounds,
      bindings,
    } satisfies AudioPatchResponse);
  } catch (error) {
    console.error("Unable to load audio patches:", error);
    // Em desenvolvimento, tabelas ausentes não devem impedir o administrador de
    // ver e ouvir a biblioteca padrão. Em produção o erro é explícito.
    if (process.env.NODE_ENV !== "production") {
      const local = buildDefaultAudioConfig();
      return NextResponse.json({
        patches: [{ id: AUDIO_PATCH, name: "Biblioteca local", status: "published", created_at: "" }],
        selectedId: AUDIO_PATCH,
        activePatchId: AUDIO_PATCH,
        sounds: local.sounds,
        bindings: local.bindings,
        readOnly: true,
        warning: READ_ONLY_WARNING,
      } satisfies AudioPatchResponse);
    }
    return NextResponse.json(
      { error: "Não foi possível carregar os patches de áudio. Rode a migration de áudio e confira as credenciais." },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    const body = await request.json() as { name?: unknown };
    if (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 100) {
      return NextResponse.json({ error: "Informe um nome de patch entre 1 e 100 caracteres." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: active, error: activeError } = await supabase
      .from("audio_patches")
      .select("id")
      .eq("status", "published")
      .maybeSingle();
    if (activeError) throw activeError;
    if (!active) throw new Error("There is no published audio patch to clone.");

    const [soundResult, bindingResult] = await Promise.all([
      supabase.from("audio_patch_sounds").select("*").eq("patch_id", active.id),
      supabase.from("audio_patch_bindings").select("*").eq("patch_id", active.id),
    ]);
    if (soundResult.error) throw soundResult.error;
    if (bindingResult.error) throw bindingResult.error;

    const { data: patch, error: insertError } = await supabase
      .from("audio_patches")
      .insert({ name: body.name.trim(), status: "draft" })
      .select("id,name,status,created_at,published_at")
      .single();
    if (insertError) throw insertError;

    const { error: cloneError } = await supabase.from("audio_patch_sounds").insert(
      (soundResult.data ?? []).map((row) => ({
        patch_id: patch.id,
        sound_id: row.sound_id,
        label: row.label,
        path: row.path,
        category: row.category,
        enabled: row.enabled,
        sort_order: row.sort_order,
      })),
    );
    if (cloneError) {
      await supabase.from("audio_patches").delete().eq("id", patch.id);
      throw cloneError;
    }

    const { error: bindingCloneError } = await supabase.from("audio_patch_bindings").insert(
      (bindingResult.data ?? []).map((row) => ({
        patch_id: patch.id,
        event: row.event,
        sound_id: row.sound_id,
        volume: row.volume,
        min_interval_ms: row.min_interval_ms,
        enabled: row.enabled,
        sort_order: row.sort_order,
      })),
    );
    if (bindingCloneError) {
      await supabase.from("audio_patches").delete().eq("id", patch.id);
      throw bindingCloneError;
    }

    return NextResponse.json({ patch }, { status: 201 });
  } catch (error) {
    console.error("Unable to create audio patch:", error);
    return NextResponse.json({ error: "Não foi possível criar o rascunho de áudio." }, { status: 503 });
  }
}
