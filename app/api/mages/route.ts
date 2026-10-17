// GET /api/mages -> { config: MageConfig } (overrides publicados dos magos).
// Em dev sem backend, devolve {} (vale o padrão do código).

import { NextResponse } from "next/server";
import { mergeMageConfig } from "@/lib/mage-config";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ config: {} }, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("mage_config")
      .select("config")
      .eq("id", "published")
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json(
      { config: data?.config ? mergeMageConfig(data.config) : {} },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to load the mage config:", error);
    return NextResponse.json({ config: {} }, { headers: { "Cache-Control": "no-store" } });
  }
}
