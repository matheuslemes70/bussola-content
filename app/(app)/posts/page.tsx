import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canCreatePosts, canDeletePosts, canViewDataPublicacao } from "@/lib/permissions";
import { isAtrasado } from "@/lib/status";
import { PostFilters } from "@/components/posts/PostFilters";
import { PostFormModal } from "@/components/posts/PostFormModal";
import { PostsBulkTable, type PostRow } from "@/components/posts/PostsBulkTable";
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

  // Sem filtro de status, publicados há mais de 60 dias ficam de fora (lista leve).
  const corte60 = new Date(Date.now() - 60 * 86400000).toISOString();
  let consulta = supabase.from("posts").select("*").eq("arquivado", false);
  if (!sp.status) consulta = consulta.or(`status.neq.publicado,updated_at.gte.${corte60}`);
  const [{ data: posts }, { data: clients }, { data: users }] = await Promise.all([
    consulta.order("data_publicacao_planejada", { ascending: true, nullsFirst: false }),
    supabase.from("clients").select("*").order("nome"),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
  ]);

  const allClients = (clients as Client[]) ?? [];
  const allUsers = (users as User[]) ?? [];
  const clientMap = new Map(allClients.map((c) => [c.id, c]));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));

  // Clientes inativos (pausados) ficam fora da lista. Só aparecem se o
  // cliente for escolhido de propósito no filtro de cliente.
  const ativosIds = new Set(allClients.filter((c) => c.status === "ativo").map((c) => c.id));
  let rows = ((posts as Post[]) ?? []).filter((p) => ativosIds.has(p.client_id) || p.client_id === sp.client);
  if (sp.client) rows = rows.filter((p) => p.client_id === sp.client);
  if (sp.status) rows = rows.filter((p) => p.status === sp.status);
  if (sp.formato) rows = rows.filter((p) => p.formato === sp.formato);
  if (sp.resp) rows = rows.filter((p) => p.responsavel_id === sp.resp || p.dono_id === sp.resp);
  // Filtra pela mesma data que a tabela mostra (entrega), que todos os cargos veem.
  if (sp.de) rows = rows.filter((p) => (p.data_entrega ?? "") >= sp.de!);
  if (sp.ate) rows = rows.filter((p) => (p.data_entrega ?? "") <= sp.ate!);
  if (sp.atrasados === "1") rows = rows.filter(isAtrasado);

  const rowVMs: PostRow[] = rows.map((p) => {
    const cli = clientMap.get(p.client_id);
    const resp = p.responsavel_id ? userMap.get(p.responsavel_id) : null;
    return {
      id: p.id,
      titulo: p.titulo,
      clientId: cli?.id ?? null,
      clientNome: cli?.nome ?? null,
      formato: p.formato,
      status: p.status,
      respNome: resp?.nome || resp?.email || null,
      data: p.data_entrega,
      atrasado: isAtrasado(p),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Todos os posts</h1>
        {canCreatePosts(me?.perfil) && (
          <PostFormModal users={allUsers} clients={allClients} podeVerDataPublicacao={canViewDataPublicacao(me?.perfil)} triggerLabel="+ Novo post" />
        )}
      </div>

      <PostFilters clients={allClients.filter((c) => c.status === "ativo" || c.id === sp.client)} users={allUsers} meuId={me?.id ?? null} />

      <PostsBulkTable rows={rowVMs} canDelete={canDeletePosts(me?.perfil)} />
    </div>
  );
}
