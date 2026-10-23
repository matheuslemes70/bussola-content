"use server";

import { createClient } from "@/lib/supabase/server";
import type { PostFormat, PostStatus } from "@/lib/types";

export type SearchResult = {
  posts: {
    id: string;
    titulo: string;
    clientNome: string | null;
    formato: PostFormat;
    status: PostStatus;
    arquivado: boolean;
  }[];
  clients: { id: string; nome: string }[];
};

// Busca global do topo. Usa o client com a sessão do usuário, então o RLS
// do banco decide o que cada perfil pode ver — a busca nunca mostra mais
// do que o resto da plataforma já mostra.
export async function searchGlobal(termo: string): Promise<SearchResult> {
  const q = termo.trim().replace(/[%,()"\\]/g, " ").slice(0, 80);
  if (q.length < 2) return { posts: [], clients: [] };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { posts: [], clients: [] };

  const like = `%${q}%`;

  const [{ data: clients }, { data: postsPorTexto }] = await Promise.all([
    supabase.from("clients").select("id, nome").ilike("nome", like).order("nome").limit(5),
    supabase
      .from("posts")
      .select("id, titulo, formato, status, arquivado, client_id, updated_at")
      .or(`titulo.ilike."${like}",briefing.ilike."${like}",ideia.ilike."${like}"`)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);

  const clientIds = (clients ?? []).map((c) => c.id);
  let postsDoCliente: typeof postsPorTexto = [];
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("posts")
      .select("id, titulo, formato, status, arquivado, client_id, updated_at")
      .in("client_id", clientIds)
      .eq("arquivado", false)
      .order("updated_at", { ascending: false })
      .limit(6);
    postsDoCliente = data ?? [];
  }

  // Junta sem repetir e prioriza posts ativos
  const vistos = new Set<string>();
  const posts = [...(postsPorTexto ?? []), ...(postsDoCliente ?? [])]
    .filter((p) => (vistos.has(p.id) ? false : (vistos.add(p.id), true)))
    .sort((a, b) => Number(a.arquivado) - Number(b.arquivado))
    .slice(0, 8);

  // Nome do cliente de cada post
  const idsFaltando = Array.from(new Set(posts.map((p) => p.client_id))).filter(Boolean);
  const nomes = new Map<string, string>();
  if (idsFaltando.length > 0) {
    const { data } = await supabase.from("clients").select("id, nome").in("id", idsFaltando);
    (data ?? []).forEach((c) => nomes.set(c.id, c.nome));
  }

  return {
    clients: (clients ?? []).map((c) => ({ id: c.id, nome: c.nome })),
    posts: posts.map((p) => ({
      id: p.id,
      titulo: p.titulo,
      clientNome: nomes.get(p.client_id) ?? null,
      formato: p.formato as PostFormat,
      status: p.status as PostStatus,
      arquivado: p.arquivado,
    })),
  };
}
