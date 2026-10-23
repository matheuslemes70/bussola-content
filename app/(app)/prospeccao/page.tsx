import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewProspeccao } from "@/lib/permissions";
import { PROSPECT_ETAPA_LABELS, PROSPECT_ETAPA_ORDER, PROSPECT_ORIGEM_LABELS } from "@/lib/status";
import type { Prospect, User } from "@/lib/types";
import { ProspectForm } from "@/components/prospeccao/ProspectForm";
import { ProspectCard } from "@/components/prospeccao/ProspectCard";

export const dynamic = "force-dynamic";

export default async function ProspeccaoPage() {
  const me = await getCurrentUser();
  if (!canViewProspeccao(me?.perfil)) {
    redirect("/");
  }

  const supabase = await createClient();
  const [{ data: prospects }, { data: users }] = await Promise.all([
    supabase.from("prospects").select("*").order("created_at", { ascending: false }),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
  ]);

  const allProspects = (prospects as Prospect[]) ?? [];
  const allUsers = (users as User[]) ?? [];
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  const totalAtivo = allProspects.filter((p) => p.etapa !== "fechado" && p.etapa !== "perdido").length;
  const totalFechado = allProspects.filter((p) => p.etapa === "fechado").length;
  const taxaConversao =
    allProspects.length > 0 ? Math.round((totalFechado / allProspects.length) * 100) : 0;

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Prospecção</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pipeline de novos clientes. Visível apenas para admin.
          </p>
        </div>
        <ProspectForm users={allUsers} />
      </div>

      <div className="mt-4 flex gap-4 text-sm text-slate-600">
        <span><strong>{totalAtivo}</strong> em negociação</span>
        <span><strong>{totalFechado}</strong> fechados</span>
        <span><strong>{taxaConversao}%</strong> taxa de conversão</span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {PROSPECT_ETAPA_ORDER.map((etapa) => {
          const items = allProspects.filter((p) => p.etapa === etapa);
          return (
            <div key={etapa} className="rounded-lg bg-slate-50 p-3">
              <h2 className="mb-3 text-xs font-semibold uppercase text-slate-500">
                {PROSPECT_ETAPA_LABELS[etapa]} ({items.length})
              </h2>
              <div className="space-y-2">
                {items.map((p) => (
                  <ProspectCard
                    key={p.id}
                    prospect={p}
                    respName={p.responsavel_id ? userMap.get(p.responsavel_id)?.nome : undefined}
                    users={allUsers}
                  />
                ))}
                {items.length === 0 && (
                  <p className="text-xs text-slate-400">Nenhum prospect aqui.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
