import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminPanels } from "@/lib/permissions";
import { isAtrasado, isAFazer } from "@/lib/status";
import type { Post, User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function VisaoEquipePage() {
  const me = await getCurrentUser();
  if (!canViewAdminPanels(me?.perfil)) {
    redirect("/");
  }

  const supabase = await createClient();
  const [{ data: posts }, { data: users }] = await Promise.all([
    supabase.from("posts").select("*").eq("arquivado", false),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
  ]);

  const allPosts = (posts as Post[]) ?? [];
  const allUsers = (users as User[]) ?? [];

  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
  const trintaDiasAtrasStr = trintaDiasAtras.toISOString().slice(0, 10);

  function calcular(campo: "responsavel_id" | "dono_id") {
    return allUsers.map((u) => {
      const meusPosts = allPosts.filter((p) => p[campo] === u.id);
      const emAberto = meusPosts.filter(isAFazer).length;
      const atrasados = meusPosts.filter(isAtrasado).length;
      const publicadosRecentes = meusPosts.filter(
        (p) =>
          p.status === "publicado" &&
          p.data_publicacao_planejada &&
          p.data_publicacao_planejada >= trintaDiasAtrasStr
      ).length;
      const total = meusPosts.length;
      return { user: u, emAberto, atrasados, publicadosRecentes, total };
    });
  }

  const comoExecutor = calcular("responsavel_id");
  const comoDono = calcular("dono_id");

  function Tabela({ titulo, linhas }: { titulo: string; linhas: ReturnType<typeof calcular> }) {
    return (
      <div className="mt-6">
        <h2 className="text-sm font-semibold uppercase text-slate-500">{titulo}</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Colaborador</th>
                <th className="px-4 py-3 text-center">Total de posts</th>
                <th className="px-4 py-3 text-center">Em aberto</th>
                <th className="px-4 py-3 text-center">Atrasados</th>
                <th className="px-4 py-3 text-center">Publicados (30 dias)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map(({ user, emAberto, atrasados, publicadosRecentes, total }) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{user.nome || user.email}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{total}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{emAberto}</td>
                  <td className={`px-4 py-3 text-center font-semibold ${atrasados > 0 ? "text-red-600" : "text-slate-400"}`}>
                    {atrasados}
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-600">{publicadosRecentes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-slate-900">Visão da equipe</h1>
      <p className="mt-1 text-sm text-slate-500">
        Carga de trabalho e produtividade por colaborador. Visível para admin e gestão de projetos.
      </p>

      <Tabela titulo="Como executor (quem produz)" linhas={comoExecutor} />
      <Tabela titulo="Como dono da demanda (quem solicitou)" linhas={comoDono} />
    </div>
  );
}
