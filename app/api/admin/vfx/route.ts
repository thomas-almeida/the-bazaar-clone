// Admin do editor de VFX.
//  GET  /api/admin/vfx  -> { config } atual (padrões se nada publicado).
//  POST /api/admin/vfx  { config } -> valida, normaliza e publica (upsert).

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_VFX, mergeVfxConfig } from "@/lib/vfx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ config: DEFAULT_VFX, readOnly: true });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("vfx_config")
      .select("config")
      .eq("id", "published")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ config: data?.config ? mergeVfxConfig(data.config) : DEFAULT_VFX });
  } catch (error) {
    // Tabela ausente (migration não aplicada) ou indisponível: o editor ainda
    // abre com os padrões; só a publicação exige a tabela.
    console.error("Unable to read the VFX config (usando padrões):", error);
    return NextResponse.json({ config: DEFAULT_VFX, readOnly: true });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY não configurado no servidor." },
      { status: 503 },
    );
  }
  try {
    const body = await request.json().catch(() => null);
    // Normaliza/valida/clampa tudo antes de gravar — nada de valores fora da faixa.
    const config = mergeVfxConfig(body?.config ?? null);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("vfx_config")
      .upsert({ id: "published", config, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ published: true, config });
  } catch (error) {
    console.error("Unable to publish the VFX config:", error);
    const detail = error instanceof Error ? error.message : String(error);
    // Causa mais comum: a migration não foi aplicada (tabela vfx_config ausente).
    const hint = /vfx_config|relation|does not exist|schema cache/i.test(detail)
      ? "Tabela vfx_config ausente — rode a migration 20260601000003_vfx_editor.sql no Supabase."
      : detail;
    return NextResponse.json({ error: `Não foi possível publicar o VFX: ${hint}` }, { status: 503 });
  }
}
