import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { parseCardDefinition } from "@/lib/admin-cards";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { CardDef } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    const supabase = getSupabaseAdmin();
    const [{ data: patches, error: patchError }, { data: activePatch, error: activeError }] = await Promise.all([
      supabase.from("balance_patches").select("id,name,status,created_at,published_at").order("created_at", { ascending: false }),
      supabase.from("balance_patches").select("id").eq("status", "published").maybeSingle(),
    ]);
    if (patchError) throw patchError;
    if (activeError) throw activeError;

    const requestedId = new URL(request.url).searchParams.get("patchId");
    const selectedId = requestedId ?? patches?.find((patch) => patch.status === "published")?.id ?? patches?.[0]?.id;
    let cards: CardDef[] = [];
    if (selectedId) {
      const { data, error } = await supabase
        .from("balance_patch_cards")
        .select("card_id,definition,enabled,sort_order")
        .eq("patch_id", selectedId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      cards = (data ?? []).map((row) => ({
        ...parseCardDefinition(row.definition),
        enabled: row.enabled,
      }));
    }

    return NextResponse.json({ patches: patches ?? [], selectedId: selectedId ?? null, activePatchId: activePatch?.id ?? null, cards });
  } catch (error) {
    console.error("Unable to load balance patches:", error);
    return NextResponse.json({ error: "Não foi possível carregar os patches. Confira a migration e as credenciais do Supabase." }, { status: 503 });
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
      .from("balance_patches")
      .select("id")
      .eq("status", "published")
      .single();
    if (activeError) throw activeError;

    const { data: sourceCards, error: sourceError } = await supabase
      .from("balance_patch_cards")
      .select("card_id,definition,enabled,sort_order")
      .eq("patch_id", active.id);
    if (sourceError) throw sourceError;
    if (!sourceCards?.length) throw new Error("The published balance patch contains no cards.");

    const { data: patch, error: insertError } = await supabase
      .from("balance_patches")
      .insert({ name: body.name.trim(), status: "draft" })
      .select("id,name,status,created_at,published_at")
      .single();
    if (insertError) throw insertError;

    const { error: cloneError } = await supabase.from("balance_patch_cards").insert(
      sourceCards.map((row) => ({
        ...row,
        patch_id: patch.id,
      })),
    );
    if (cloneError) {
      const { error: cleanupError } = await supabase.from("balance_patches").delete().eq("id", patch.id);
      if (cleanupError) console.error("Failed to clean up incomplete balance patch:", cleanupError);
      throw cloneError;
    }
    return NextResponse.json({ patch }, { status: 201 });
  } catch (error) {
    console.error("Unable to create balance patch:", error);
    return NextResponse.json({ error: "Não foi possível criar o rascunho do patch." }, { status: 503 });
  }
}
