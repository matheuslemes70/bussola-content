"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPautaResponse } from "@/lib/notifications";
import type { PautaStatus } from "@/lib/types";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export async function submitPauta(
  token: string,
  decision: PautaStatus, // 'aprovada' | 'ajustes_solicitados'
  autor: string,
  comentarioGeral: string,
  postComments: { postId: string; texto: string }[]
) {
  const supabase = createAdminClient();

  // Apenas decisões válidas para uma resposta do cliente.
  if (decision !== "aprovada" && decision !== "ajustes_solicitados") {
    return { error: "Ação inválida." };
  }

  const { data: pauta } = await supabase
    .from("pauta_approvals")
    .select("*")
    .eq("token", token)
    .single();
  if (!pauta) return { error: "Link inválido." };

  // Não permite sobrescrever uma pauta já respondida.
  if (pauta.status !== "pendente") {
    return { error: "Esta pauta já foi respondida." };
  }

  if (decision === "ajustes_solicitados" && !comentarioGeral.trim() &&
      !postComments.some((c) => c.texto.trim())) {
    return { error: "Descreva os ajustes desejados (geral ou em algum post)." };
  }

  // IMPORTANTE: o admin client ignora o RLS. Validamos que cada postId
  // pertence MESMO a esta pauta (cliente + mês) antes de inserir qualquer
  // comentário, evitando injeção de comentários em posts de outros clientes.
  const isPeriodo = Boolean(pauta.data_inicio && pauta.data_fim);
  const dataInicio = isPeriodo ? pauta.data_inicio : `${pauta.ano}-${pad(pauta.mes)}-01`;
  const dataFim = isPeriodo ? pauta.data_fim : `${pauta.ano}-${pad(pauta.mes)}-31`;
  const { data: validPosts } = await supabase
    .from("posts")
    .select("id")
    .eq("client_id", pauta.client_id)
    .gte("data_publicacao_planejada", dataInicio)
    .lte("data_publicacao_planejada", dataFim);
  const allowed = new Set((validPosts ?? []).map((p) => p.id));

  // Comentários por post → tabela de comments (tipo cliente), visíveis no post.
  const nome = autor.trim() || "Cliente";
  const inserts = postComments
    .filter((c) => c.texto.trim() && allowed.has(c.postId))
    .map((c) => ({
      post_id: c.postId,
      author_name: nome,
      texto: c.texto.trim(),
      tipo: "cliente" as const,
    }));
  if (inserts.length > 0) {
    await supabase.from("comments").insert(inserts);
  }

  const { error } = await supabase
    .from("pauta_approvals")
    .update({
      status: decision,
      comentario: comentarioGeral.trim() || null,
      autor_resposta: nome,
      responded_at: new Date().toISOString(),
    })
    .eq("id", pauta.id);
  if (error) return { error: error.message };

  await notifyPautaResponse(supabase, pauta.id);

  revalidatePath(`/pauta/${token}`);
  revalidatePath(`/clientes/${pauta.client_id}`);
  return { ok: true };
}
