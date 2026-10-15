// Backend de cartas — route handler do Next.js.
// Contrato: GET /api/catalog -> CatalogResponse (ver src/lib/types.ts).
// O catálogo é servido a partir de src/lib/catalog.ts; o cliente consome este
// endpoint ao iniciar uma run, em vez de embutir os dados no bundle.

import { NextResponse } from "next/server";
import { parseCardDefinition } from "@/lib/admin-cards";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  CATALOG_VERSION,
  CONFIG,
  FARM_BOTS,
  RIVAL_BUILDS,
  SHOP_DECK,
} from "@/lib/catalog";
import type { CatalogResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let cards = SHOP_DECK;
  let version = CATALOG_VERSION;

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const supabase = getSupabaseAdmin();
      const { data: patch, error: patchError } = await supabase
        .from("balance_patches")
        .select("id,name")
        .eq("status", "published")
        .single();
      if (patchError) throw patchError;

      const { data, error } = await supabase
        .from("balance_patch_cards")
        .select("definition,enabled,sort_order")
        .eq("patch_id", patch.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      if (!data?.length) throw new Error("The published balance patch contains no cards.");
      cards = data.map((row) => ({
        ...parseCardDefinition(row.definition),
        enabled: row.enabled,
      }));
      version = patch.name;
    } catch (error) {
      console.error("Unable to load the published balance patch:", error);
      return NextResponse.json(
        { error: "Não foi possível carregar o catálogo publicado do Supabase." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured on the server." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body: CatalogResponse = {
    version,
    config: CONFIG,
    cards,
    farmBots: FARM_BOTS,
    rivalBuilds: RIVAL_BUILDS,
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
