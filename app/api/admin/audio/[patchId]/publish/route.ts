import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
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
    const { error } = await getSupabaseAdmin().rpc("publish_audio_patch", { p_patch_id: patchId });
    if (error) throw error;
    return NextResponse.json({ published: true });
  } catch (error) {
    console.error("Unable to publish audio patch:", error);
    return NextResponse.json({ error: "Não foi possível publicar o patch de áudio." }, { status: 503 });
  }
}
