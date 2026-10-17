// Admin dos overrides de magos.
//   GET  /api/admin/mages -> { config } atual.
//   POST /api/admin/mages { config } -> valida e publica (upsert).

import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { mergeMageConfig } from "@/lib/mage-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ config: {}, readOnly: true });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("mage_config")
      .select("config")
      .eq("id", "published")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ config: data?.config ? mergeMageConfig(data.config) : {} });
  } catch (error) {
    console.error("Unable to read the mage config (usando padrões):", error);
    return NextResponse.json({ config: {}, readOnly: true });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorizedResponse();
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurado no servidor." }, { status: 503 });
  }
  try {
    const body = await request.json().catch(() => null);
    const config = mergeMageConfig(body?.config ?? null);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("mage_config")
      .upsert({ id: "published", config, updated_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ published: true, config });
  } catch (error) {
    console.error("Unable to publish the mage config:", error);
    const detail = error instanceof Error ? error.message : String(error);
    const hint = /mage_config|relation|does not exist|schema cache/i.test(detail)
      ? "Tabela mage_config ausente — rode a migration 20260601000004_mage_config.sql no Supabase."
      : detail;
    return NextResponse.json({ error: `Não foi possível publicar os magos: ${hint}` }, { status: 503 });
  }
}
