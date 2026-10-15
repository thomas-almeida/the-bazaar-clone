import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  createAdminSession,
  SESSION_LIFETIME_SECONDS,
  verifyAdminPassword,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  if (!process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Admin password is not configured on the server." }, { status: 503 });
  }
  try {
    if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
      return NextResponse.json({ error: "Admin session secret is not configured correctly." }, { status: 503 });
    }
    if (!verifyAdminPassword(body.password)) {
      return NextResponse.json({ error: "Senha incorreta." }, { status: 401 });
    }

    const response = NextResponse.json({ authenticated: true });
    response.cookies.set(ADMIN_COOKIE, createAdminSession(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_LIFETIME_SECONDS,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    console.error("Admin session creation failed:", error);
    return NextResponse.json({ error: "Não foi possível iniciar a sessão administrativa." }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(ADMIN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
