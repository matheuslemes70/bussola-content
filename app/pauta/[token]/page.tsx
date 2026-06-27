import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { MESES_PT, PAUTA_STATUS_LABELS } from "@/lib/status";
import { PautaForm } from "@/components/pauta/PautaForm";
import type { Post, Client, PautaApproval } from "@/lib/types";

export const dynamic = "force-dynamic";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export default async function PautaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: pautaRow } = await supabase
    .from("pauta_approvals")
    .select("*")
    .eq("token", token)
    .single();

  if (!pautaRow) notFound();
  const pauta = pautaRow as PautaApproval;

  const [{ data: client }, { data: posts }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", pauta.client_id).single(),
    supabase
      .from("posts")
      .select("*")
      .eq("client_id", pauta.client_id)
      .gte("data_publicacao_planejada", `${pauta.ano}-${pad(pauta.mes)}-01`)
      .lte("data_publicacao_planejada", `${pauta.ano}-${pad(pauta.mes)}-31`)
      .order("data_publicacao_planejada"),
  ]);

  const c = client as Client | null;
  // DTO mínimo: nunca enviar briefing (a menos que liberado), reference_link,
  // delivered_link, public_token, responsavel_id, etc. para a página pública.
  const monthPosts = ((posts as Post[]) ?? []).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    formato: p.formato,
    data_publicacao_planejada: p.data_publicacao_planejada,
    briefing: pauta.incluir_briefing ? p.briefing : "",
  }));
  const respondida = pauta.status !== "pendente";

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-black py-5">
        <div className="mx-auto max-w-2xl px-4">
          <p className="text-2xl font-extrabold tracking-tight text-bussola-yellow">
            Bússola <span className="font-light text-white">Media</span>
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">
            Pauta de {MESES_PT[pauta.mes - 1]} {pauta.ano}
            {c ? ` — ${c.nome}` : ""}
          </h1>
          {respondida && (
            <p className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-medium ${
              pauta.status === "aprovada" ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
            }`}>
              {PAUTA_STATUS_LABELS[pauta.status]}
            </p>
          )}
        </div>

        {monthPosts.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
            Nenhum post planejado para este mês.
          </p>
        ) : (
          <PautaForm
            token={token}
            posts={monthPosts}
            incluirBriefing={pauta.incluir_briefing}
            jaRespondida={respondida}
          />
        )}
      </div>
    </div>
  );
}
