// Cria uma carta nova dentro de um rascunho de balanceamento.
//   POST /api/admin/patches/{patchId}/cards  { definition: CardDef }
// Valida a definição, confere que o patch é rascunho e que o id é único, e
// insere a carta no fim da lista (sort_order = maior + 1).

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { isCardDefinition, normalizeCardArt } from "@/lib/admin-cards";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ patchId: string }> },
) {
  try {
    if (!isAdminRequest(request)) return unauthorizedResponse();
    const { patchId } = await context.params;

    const body = await request.json().catch(() => null);
    const definition: unknown = body?.definition;
    const id = typeof definition === "object" && definition !== null
      ? (definition as { id?: unknown }).id
      : undefined;
    if (typeof id !== "string" || !isCardDefinition(definition, id)) {
      return NextResponse.json({ error: "Os dados da carta são inválidos." }, { status: 400 });
    }
    const normalizedDefinition = normalizeCardArt(definition);

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

    // Próximo sort_order: fim da lista do rascunho.
    const { data: last, error: lastError } = await supabase
      .from("balance_patch_cards")
      .select("sort_order")
      .eq("patch_id", patchId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError) throw lastError;
    const sortOrder = (last?.sort_order ?? -1) + 1;

    const { error } = await supabase
      .from("balance_patch_cards")
      .insert({
        patch_id: patchId,
        card_id: id,
        definition: normalizedDefinition,
        enabled: normalizedDefinition.enabled !== false,
        sort_order: sortOrder,
      });
    if (error) {
      // 23505 = violação de PK (patch_id, card_id): id já existe no rascunho.
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ error: `Já existe uma carta com o id "${id}" neste patch.` }, { status: 409 });
      }
      throw error;
    }
    return NextResponse.json({ created: true, id });
  } catch (error) {
    console.error("Unable to create card definition:", error);
    return NextResponse.json({ error: "Não foi possível criar a carta." }, { status: 503 });
  }
}
