"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPautaResponse } from "@/lib/notifications";
import type { PautaStatus } from "@/lib/types";

export async function submitPauta(
  token: string,
  decision: PautaStatus, // 'aprovada' | 'ajustes_solicitados'
  autor: string,
  comentarioGeral: string,
  postComments: { postId: string; texto: string }[]
) {
  const supabase = createAdminClient();

  const { data: pauta } = await supabase
    .from("pauta_approvals")
    .select("*")
    .eq("token", token)
    .single();
  if (!pauta) return { error: "Link inválido." };

  if (decision === "ajustes_solicitados" && !comentarioGeral.trim() &&
      !postComments.some((c) => c.texto.trim())) {
    return { error: "Descreva os ajustes desejados (geral ou em algum post)." };
  }

  // Comentários por post → tabela de comments (tipo cliente), visíveis no post.
  const nome = autor.trim() || "Cliente";
  const inserts = postComments
    .filter((c) => c.texto.trim())
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
