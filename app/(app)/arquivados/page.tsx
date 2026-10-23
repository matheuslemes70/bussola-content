import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canManagePosts } from "@/lib/permissions";
import { FORMAT_LABELS, STATUS_LABELS, formatDate } from "@/lib/status";
import { UnarchiveButton } from "@/components/posts/UnarchiveButton";
import type { Post, Client } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ArquivadosPage() {
  const me = await getCurrentUser();
  const pode = canManagePosts(me?.perfil);
  const supabase = await createClient();

  const [{ data: posts }, { data: clients }] = await Promise.all([
    supabase.from("posts").select("*").eq("arquivado", true).order("data_publicacao_planejada"),
    supabase.from("clients").select("*"),
  ]);

  const allPosts = (posts as Post[]) ?? [];
  const clientMap = new Map(((clients as Client[]) ?? []).map((c) => [c.id, c]));

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-slate-900">Arquivados</h1>
      <p className="mt-1 text-sm text-slate-500">
        Ideias e posts guardados fora do fluxo ativo. Podem ser desarquivados a qualquer momento.
      </p>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Formato</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Data planejada</th>
              {pode && <th className="px-4 py-3 text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allPosts.length === 0 && (
              <tr>
                <td colSpan={pode ? 6 : 5} className="px-4 py-6 text-center text-slate-400">
                  Nenhum post arquivado ainda.
                </td>
              </tr>
            )}
            {allPosts.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/posts/${p.id}`} className="font-medium text-slate-800 hover:text-bussola-blue hover:underline">
                    {p.titulo}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{clientMap.get(p.client_id)?.nome ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{FORMAT_LABELS[p.formato]}</td>
                <td className="px-4 py-3 text-slate-600">{STATUS_LABELS[p.status]}</td>
                <td className="px-4 py-3 text-slate-600">{formatDate(p.data_publicacao_planejada)}</td>
                {pode && (
                  <td className="px-4 py-3 text-right">
                    <UnarchiveButton postId={p.id} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
