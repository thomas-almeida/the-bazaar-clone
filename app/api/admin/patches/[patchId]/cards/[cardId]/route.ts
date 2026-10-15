import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { isCardDefinition } from "@/lib/admin-cards";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ patchId: string; cardId: string }> },
) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    const { patchId, cardId } = await context.params;
    const definition: unknown = await request.json();
    if (!isCardDefinition(definition, cardId)) {
      return NextResponse.json({ error: "Os dados da carta são inválidos." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: patch, error: patchError } = await supabase
      .from("balance_patches")
      .select("status")
      .eq("id", patchId)
      .single();
    if (patchError) throw patchError;
    if (patch.status !== "draft") {
      return NextResponse.json({ error: "Somente um rascunho pode ser editado." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("balance_patch_cards")
      .update({ definition, enabled: definition.enabled !== false })
      .eq("patch_id", patchId)
      .eq("card_id", cardId)
      .select("card_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Carta não encontrada neste patch." }, { status: 404 });
    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Unable to save card definition:", error);
    return NextResponse.json({ error: "Não foi possível salvar a carta." }, { status: 503 });
  }
}
