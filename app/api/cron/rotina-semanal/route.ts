import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarSemana } from "@/lib/rotina";
import { hojeBrasilia } from "@/lib/status";

// Roda todo domingo à noite (ver vercel.json) e cria os posts da rotina
// semanal de todos os clientes ativos, para a semana seguinte.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const res = await gerarSemana(createAdminClient(), { hoje: hojeBrasilia() });
  if (res.erro) {
    console.error("[cron/rotina-semanal]", res.erro);
    return NextResponse.json({ error: res.erro }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...res });
}
