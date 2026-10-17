// PVP assíncrono.
// GET /api/snapshots?pass=N&exclude=<uid> -> { snapshot: BuildSnapshot | null }
//   Usa service role (ignora RLS) e sorteia uma build recente do mesmo "pass".
//   Retorna null quando o pool está vazio — o cliente cai nos rivais estáticos.
// POST /api/snapshots -> grava a build do jogador. O servidor valida o token e
//   escreve com service role (evita problemas de RLS a partir do cliente).

import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import type { BuildSnapshot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const empty = () =>
  NextResponse.json({ snapshot: null }, { headers: { "Cache-Control": "no-store" } });

function bearer(req: NextRequest): string {
  return (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase não configurado." }, { status: 503 });
  }
  const token = bearer(req);
  if (!token) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  try {
    const supabase = getSupabaseAdmin();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const body = (await req.json()) as Partial<BuildSnapshot> & { catalogVersion?: string };
    const pass = Number.isInteger(body.pass) && (body.pass as number) >= 1 && (body.pass as number) <= 3
      ? (body.pass as number)
      : null;
    if (pass === null || typeof body.mageId !== "string" || !Array.isArray(body.slots)) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const { error } = await supabase.from("build_snapshots").insert({
      user_id: userData.user.id,
      display_name: typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 80) : "JOGADOR",
      mage_id: body.mageId.slice(0, 40),
      pass,
      max_health: Number.isFinite(body.maxHealth) ? Math.round(body.maxHealth as number) : 50,
      slots: body.slots.slice(0, 4),
      catalog_version: typeof body.catalogVersion === "string" ? body.catalogVersion.slice(0, 80) : null,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Falha ao gravar snapshot da build:", error);
    return NextResponse.json({ error: "Falha ao gravar." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return empty();

  const passParam = Number(req.nextUrl.searchParams.get("pass"));
  const pass = Number.isInteger(passParam) && passParam >= 1 && passParam <= 3 ? passParam : 1;
  const excludeRaw = req.nextUrl.searchParams.get("exclude") ?? "";
  // Só filtra por um UUID válido; qualquer outra coisa é ignorada (evita erro de
  // tipo no Postgres, que derrubaria a query e devolveria null sem necessidade).
  const exclude = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(excludeRaw)
    ? excludeRaw
    : "";

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from("build_snapshots")
      .select("display_name,mage_id,max_health,pass,slots")
      .eq("pass", pass)
      .order("created_at", { ascending: false })
      .limit(50);
    if (exclude) query = query.neq("user_id", exclude);

    const { data, error } = await query;
    if (error) throw error;
    if (!data?.length) return empty();

    const row = data[Math.floor(Math.random() * data.length)];
    const snapshot: BuildSnapshot = {
      name: row.display_name,
      mageId: row.mage_id,
      maxHealth: row.max_health,
      pass: row.pass,
      slots: row.slots,
    };
    return NextResponse.json({ snapshot }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Falha ao buscar snapshot de oponente:", error);
    return empty();
  }
}
