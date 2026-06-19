"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  notifyClientApproved,
  notifyClientRequestedChanges,
} from "@/lib/notifications";

// A página pública não tem login. Usa o service-role no servidor,
// sempre filtrando pelo public_token (que funciona como segredo de acesso).

async function getPostByToken(token: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("posts")
    .select("id, public_token")
    .eq("public_token", token)
    .single();
  return data;
}

export async function clientApprove(token: string, authorName: string, comment: string) {
  const supabase = createAdminClient();
  const post = await getPostByToken(token);
  if (!post) return { error: "Link inválido." };

  if (comment.trim()) {
    await supabase.from("comments").insert({
      post_id: post.id,
      author_name: authorName.trim() || "Cliente",
      texto: comment.trim(),
      tipo: "cliente",
    });
  }

  const { error } = await supabase
    .from("posts")
    .update({ status: "aprovado" })
    .eq("id", post.id);
  if (error) return { error: error.message };

  // Notifica o responsável que o cliente aprovou.
  await notifyClientApproved(supabase, post.id);

  revalidatePath(`/aprovacao/${token}`);
  return { ok: true };
}

export async function clientRequestChanges(token: string, authorName: string, comment: string) {
  const supabase = createAdminClient();
  const post = await getPostByToken(token);
  if (!post) return { error: "Link inválido." };

  if (!comment.trim()) {
    return { error: "Descreva o ajuste desejado." };
  }

  await supabase.from("comments").insert({
    post_id: post.id,
    author_name: authorName.trim() || "Cliente",
    texto: comment.trim(),
    tipo: "cliente",
  });

  const { error } = await supabase
    .from("posts")
    .update({ status: "alterar" })
    .eq("id", post.id);
  if (error) return { error: error.message };

  // Notifica o responsável com o comentário do ajuste solicitado.
  await notifyClientRequestedChanges(supabase, post.id, comment.trim());

  revalidatePath(`/aprovacao/${token}`);
  return { ok: true };
}
