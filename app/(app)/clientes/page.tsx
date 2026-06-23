import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageClients } from "@/lib/permissions";
import { isAtrasado, isAFazer, formatDate, CLIENT_STATUS_LABELS } from "@/lib/status";
import { ClientFormModal } from "@/components/clients/ClientFormModal";
import type { Client, Post, User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ inativos?: string }>;
}) {
  const { inativos } = await searchParams;
  const mostrarInativos = inativos === "1";

  const supabase = await createClient();
  const me = await getCurrentUser();

  const [{ data: clients }, { data: posts }, { data: users }] = await Promise.all([
    supabase.from("clients").select("*").order("nome"),
    supabase.from("posts").select("*"),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
  ]);

  const todosClients = (clients as Client[]) ?? [];
  // Por padrão só clientes ativos; pausados aparecem só com "Mostrar inativos".
  const allClients = mostrarInativos
    ? todosClients
    : todosClients.filter((c) => c.status === "ativo");
  const pausadosCount = todosClients.filter((c) => c.status === "pausado").length;
  const ativosCount = todosClients.length - pausadosCount;
  const allPosts = (posts as Post[]) ?? [];
  const allUsers = (users as User[]) ?? [];
  const podeGerir = canManageClients(me?.perfil);

  const respMap = new Map(allUsers.map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Clientes</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {ativosCount} {ativosCount === 1 ? "cliente ativo" : "clientes ativos"}
            {pausadosCount > 0 && (
              <span className="text-slate-400"> · {pausadosCount} inativo{pausadosCount > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={mostrarInativos ? "/clientes" : "/clientes?inativos=1"}
            className="text-sm font-medium text-bussola-blue hover:underline"
          >
            {mostrarInativos
              ? "Ocultar inativos"
              : `Mostrar inativos${pausadosCount ? ` (${pausadosCount})` : ""}`}
          </Link>
          {podeGerir && (
            <ClientFormModal users={allUsers} triggerLabel="+ Novo cliente" />
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="hidden px-4 py-3 md:table-cell">Responsável</th>
              <th className="hidden px-4 py-3 text-center sm:table-cell">Posts a fazer</th>
              <th className="px-4 py-3 text-center">Atrasados</th>
              <th className="hidden px-4 py-3 lg:table-cell">Último publicado</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allClients.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum cliente cadastrado.
                </td>
              </tr>
            )}
            {allClients.map((c) => {
              const cPosts = allPosts.filter((p) => p.client_id === c.id);
              const aFazer = cPosts.filter(isAFazer).length;
              const atrasados = cPosts.filter(isAtrasado).length;
              const publicados = cPosts
                .filter((p) => p.status === "publicado" && p.data_publicacao_planejada)
                .sort((a, b) =>
                  (b.data_publicacao_planejada ?? "").localeCompare(a.data_publicacao_planejada ?? "")
                );
              const ultimo = publicados[0]?.data_publicacao_planejada ?? null;
              const resp = c.responsavel_id ? respMap.get(c.responsavel_id) : null;

              return (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    <Link href={`/clientes/${c.id}`} className="hover:text-bussola-blue hover:underline">
                      {c.nome}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{resp?.nome || resp?.email || "—"}</td>
                  <td className="hidden px-4 py-3 text-center text-slate-600 sm:table-cell">{aFazer}</td>
                  <td className="px-4 py-3 text-center">
                    {atrasados > 0 ? (
                      <span className="font-semibold text-red-600">{atrasados}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{formatDate(ultimo)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${
                      c.status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {CLIENT_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
