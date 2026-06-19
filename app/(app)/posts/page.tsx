import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canManagePosts } from "@/lib/permissions";
import { FORMAT_LABELS, formatDate, isAtrasado } from "@/lib/status";
import { StatusBadge, AtrasadoBadge } from "@/components/ui/Badge";
import { PostFilters } from "@/components/posts/PostFilters";
import { PostFormModal } from "@/components/posts/PostFormModal";
import type { Client, Post, User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const me = await getCurrentUser();

  const [{ data: posts }, { data: clients }, { data: users }] = await Promise.all([
    supabase.from("posts").select("*").order("data_publicacao_planejada", { ascending: true, nullsFirst: false }),
    supabase.from("clients").select("*").order("nome"),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
  ]);

  const allClients = (clients as Client[]) ?? [];
  const allUsers = (users as User[]) ?? [];
  const clientMap = new Map(allClients.map((c) => [c.id, c]));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  let rows = (posts as Post[]) ?? [];
  if (sp.client) rows = rows.filter((p) => p.client_id === sp.client);
  if (sp.status) rows = rows.filter((p) => p.status === sp.status);
  if (sp.formato) rows = rows.filter((p) => p.formato === sp.formato);
  if (sp.resp) rows = rows.filter((p) => p.responsavel_id === sp.resp);
  if (sp.de) rows = rows.filter((p) => (p.data_publicacao_planejada ?? "") >= sp.de!);
  if (sp.ate) rows = rows.filter((p) => (p.data_publicacao_planejada ?? "") <= sp.ate!);
  if (sp.atrasados === "1") rows = rows.filter(isAtrasado);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Todos os posts</h1>
        {canManagePosts(me?.perfil) && (
          <PostFormModal users={allUsers} clients={allClients} triggerLabel="+ Novo post" />
        )}
      </div>

      <PostFilters clients={allClients} users={allUsers} />

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Formato</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Responsável</th>
              <th className="px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nenhum post encontrado.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const atrasado = isAtrasado(p);
              const cli = clientMap.get(p.client_id);
              const resp = p.responsavel_id ? userMap.get(p.responsavel_id) : null;
              return (
                <tr key={p.id} className={atrasado ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/posts/${p.id}`} className="text-slate-800 hover:text-bussola-blue hover:underline">
                      {p.titulo}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {cli ? (
                      <Link href={`/clientes/${cli.id}`} className="hover:underline">{cli.nome}</Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{FORMAT_LABELS[p.formato]}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <StatusBadge status={p.status} />
                      {atrasado && <AtrasadoBadge />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{resp?.nome || resp?.email || "—"}</td>
                  <td className={`px-4 py-3 ${atrasado ? "font-semibold text-red-600" : "text-slate-600"}`}>
                    {formatDate(p.data_publicacao_planejada)}
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
