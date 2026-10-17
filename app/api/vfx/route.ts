// Backend de VFX — GET /api/vfx -> { config: VfxConfig }.
// Serve a configuração de VFX publicada. O cliente busca uma vez por página e
// cai nos padrões locais quando não há credencial server-only (desenvolvimento).

import { NextResponse } from "next/server";
import { DEFAULT_VFX, mergeVfxConfig } from "@/lib/vfx";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    // Sem backend configurado: devolve os padrões (dev).
    return NextResponse.json({ config: DEFAULT_VFX }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vfx_config")
      .select("config")
      .eq("id", "published")
      .maybeSingle();
    if (error) throw error;
    const config = data?.config ? mergeVfxConfig(data.config) : DEFAULT_VFX;
    return NextResponse.json({ config }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Unable to load the published VFX config:", error);
    // VFX não deve derrubar a página: devolve os padrões.
    return NextResponse.json({ config: DEFAULT_VFX }, { headers: { "Cache-Control": "no-store" } });
  }
}
