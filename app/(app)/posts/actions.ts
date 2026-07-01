"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  notifyNewPost,
  notifyAwaitingApproval,
  notifyStatusAlterar,
} from "@/lib/notifications";
import type { PostFormat, PostStatus } from "@/lib/types";

const GESTOR = ["admin", "social_media"] as const;

export async function createPost(formData: FormData) {
  const supabase = await createClient();

  const titulo = String(formData.get("titulo") || "").trim();
  const client_id = String(formData.get("client_id") || "");
  if (!titulo) return { error: "Título é obrigatório." };
  if (!client_id) return { error: "Cliente é obrigatório." };

  const responsavel = String(formData.get("responsavel_id") || "");
  const data = String(formData.get("data_publicacao_planejada") || "");

  const { data: row, error } = await supabase
    .from("posts")
    .insert({
      client_id,
      titulo,
      briefing: String(formData.get("briefing") || ""),
      caption: String(formData.get("caption") || ""),
      formato: (String(formData.get("formato") || "estatico")) as PostFormat,
      reference_link: String(formData.get("reference_link") || "") || null,
      delivered_link: String(formData.get("delivered_link") || "") || null,
      data_publicacao_planejada: data || null,
      status: (String(formData.get("status") || "a_produzir")) as PostStatus,
      responsavel_id: responsavel || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Notifica o responsável pelo novo post.
  await notifyNewPost(supabase, row.id as string);

  revalidatePath(`/clientes/${client_id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true, id: row.id as string };
}

export async function updatePost(id: string, formData: FormData) {
  const supabase = await createClient();

  const responsavel = String(formData.get("responsavel_id") || "");
  const data = String(formData.get("data_publicacao_planejada") || "");
  const novoStatus = (String(formData.get("status") || "a_produzir")) as PostStatus;

  // status anterior para detectar transições que disparam notificação
  const { data: anterior } = await supabase
    .from("posts").select("status").eq("id", id).single();

  const { data: row, error } = await supabase
    .from("posts")
    .update({
      titulo: String(formData.get("titulo") || "").trim(),
      briefing: String(formData.get("briefing") || ""),
      caption: String(formData.get("caption") || ""),
      formato: (String(formData.get("formato") || "estatico")) as PostFormat,
      reference_link: String(formData.get("reference_link") || "") || null,
      delivered_link: String(formData.get("delivered_link") || "") || null,
      data_publicacao_planejada: data || null,
      status: novoStatus,
      responsavel_id: responsavel || null,
    })
    .eq("id", id)
    .select("client_id")
    .single();

  if (error) return { error: error.message };

  if (anterior && anterior.status !== novoStatus) {
    if (novoStatus === "para_aprovacao") await notifyAwaitingApproval(supabase, id);
    else if (novoStatus === "alterar") await notifyStatusAlterar(supabase, id);
  }

  revalidatePath(`/posts/${id}`);
  revalidatePath(`/clientes/${row.client_id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true };
}

// Mudança rápida de status (usada no kanban)
export async function updatePostStatus(id: string, status: PostStatus) {
  const supabase = await createClient();

  const { data: anterior } = await supabase
    .from("posts").select("status").eq("id", id).single();

  const { data: row, error } = await supabase
    .from("posts")
    .update({ status })
    .eq("id", id)
    .select("client_id")
    .single();
  if (error) return { error: error.message };

  if (anterior && anterior.status !== status) {
    if (status === "para_aprovacao") await notifyAwaitingApproval(supabase, id);
    else if (status === "alterar") await notifyStatusAlterar(supabase, id);
  }

  revalidatePath(`/clientes/${row.client_id}`);
  revalidatePath(`/posts/${id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePost(id: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { data: row } = await supabase.from("posts").select("client_id").eq("id", id).single();
  const { error } = await supabase.from("posts").delete().eq("id", id);
  if (error) return { error: error.message };
  if (row) revalidatePath(`/clientes/${row.client_id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true };
}

// Exclusão em massa (tela "Todos os posts").
export async function deletePostsBulk(ids: string[]) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  if (!ids.length) return { error: "Nenhum post selecionado." };
  const supabase = await createClient();
  const { error } = await supabase.from("posts").delete().in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true, count: ids.length };
}

// Gera (ou retorna) o token público e move o post para "para_aprovacao"
export async function sendForApproval(id: string) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("posts")
    .select("public_token")
    .eq("id", id)
    .single();

  const token = existing?.public_token ?? crypto.randomUUID();

  const { data: row, error } = await supabase
    .from("posts")
    .update({ public_token: token, status: "para_aprovacao" })
    .eq("id", id)
    .select("client_id")
    .single();

  if (error) return { error: error.message };

  // Notifica o gestor do cliente que há post aguardando aprovação.
  await notifyAwaitingApproval(supabase, id);

  revalidatePath(`/posts/${id}`);
  revalidatePath(`/clientes/${row.client_id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true, token };
}

// ---------- Checklist de subtarefas ----------
export async function addChecklistItem(postId: string, texto: string) {
  const supabase = await createClient();
  const t = texto.trim();
  if (!t) return { error: "Item vazio." };
  const { error } = await supabase
    .from("post_checklist_items")
    .insert({ post_id: postId, texto: t });
  if (error) return { error: error.message };
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function toggleChecklistItem(itemId: string, postId: string, concluido: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("post_checklist_items")
    .update({ concluido })
    .eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function deleteChecklistItem(itemId: string, postId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("post_checklist_items").delete().eq("id", itemId);
  if (error) return { error: error.message };
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

// Comentário interno (chat de feedback da equipe)
export async function addInternalComment(postId: string, texto: string) {
  const supabase = await createClient();
  const trimmed = texto.trim();
  if (!trimmed) return { error: "Comentário vazio." };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    author_id: user?.id ?? null,
    texto: trimmed,
    tipo: "interno",
  });
  if (error) return { error: error.message };

  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}
