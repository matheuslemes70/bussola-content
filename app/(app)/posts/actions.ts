"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import {
  notifyNewPost,
  notifyAwaitingApproval,
  notifyStatusAlterar,
  notifyEntregue,
} from "@/lib/notifications";
import type { PostFormat, PostStatus } from "@/lib/types";
import { notifyUser, detectarMencoes } from "@/lib/notify";

const GESTOR = ["admin", "social_media", "gestor_projetos"] as const;
// Etapas que quem executa (editor/designer) pode escolher: a produção e a entrega.
const ETAPAS_EXECUTOR: PostStatus[] = ["a_produzir", "em_producao", "pronto_pra_editar", "alterar", "revisao_interna"];
const ehGestaoPerfil = (perfil: string) => (GESTOR as readonly string[]).includes(perfil);

export async function createPost(formData: FormData) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const titulo = String(formData.get("titulo") || "").trim();
  const client_id = String(formData.get("client_id") || "");
  if (!titulo) return { error: "Título é obrigatório." };
  if (!client_id) return { error: "Cliente é obrigatório." };

  const responsavel = String(formData.get("responsavel_id") || "");
  if (!responsavel) return { error: "Escolha quem vai executar o post." };
  const dono = String(formData.get("dono_id") || "");
  const data = String(formData.get("data_publicacao_planejada") || "");
  const dataEntrega = String(formData.get("data_entrega") || "");
  const horario = String(formData.get("horario_publicacao_planejada") || "");

  const { data: row, error } = await supabase
    .from("posts")
    .insert({
      client_id,
      titulo,
      ideia: String(formData.get("ideia") || ""),
      briefing: String(formData.get("briefing") || ""),
      caption: String(formData.get("caption") || ""),
      formato: (String(formData.get("formato") || "estatico")) as PostFormat,
      delivered_link: String(formData.get("delivered_link") || "") || null,
      data_publicacao_planejada: data || null,
      data_entrega: dataEntrega || null,
      horario_publicacao_planejada: horario || null,
      status: (String(formData.get("status") || "a_produzir")) as PostStatus,
      responsavel_id: responsavel || null,
      dono_id: dono || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Notifica o responsável pelo novo post.
  await notifyNewPost(supabase, row.id as string);
  const postId = row.id as string;
  if (responsavel) {
    await notifyUser(supabase, responsavel, `Você foi definido como executor em "${titulo}".`, postId);
  }
  if (dono && dono !== responsavel) {
    await notifyUser(supabase, dono, `Você foi definido como dono da demanda "${titulo}".`, postId);
  }

  revalidatePath(`/clientes/${client_id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true, id: row.id as string };
}

export async function updatePost(id: string, formData: FormData) {
  const auth = await requireRole();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  // Editor e designer mexem só no andamento e no link de entrega.
  if (!ehGestaoPerfil(auth.user.perfil)) {
    const status = String(formData.get("status") || "") as PostStatus;
    if (!ETAPAS_EXECUTOR.includes(status)) return { error: "Essa etapa é com a social media." };
    const { data: antes } = await supabase.from("posts").select("status, client_id").eq("id", id).single();
    const { error } = await supabase
      .from("posts")
      .update({ status, delivered_link: String(formData.get("delivered_link") || "") || null })
      .eq("id", id);
    if (error) return { error: error.message };
    if (antes && antes.status !== status) {
      if (status === "revisao_interna") await notifyEntregue(supabase, id);
    }
    revalidatePath(`/posts/${id}`);
    if (antes?.client_id) revalidatePath(`/clientes/${antes.client_id}`);
    revalidatePath("/posts");
    revalidatePath("/");
    return { ok: true };
  }

  const responsavel = String(formData.get("responsavel_id") || "");
  if (!responsavel) return { error: "Escolha quem vai executar o post." };
  const dono = String(formData.get("dono_id") || "");
  const dataEntrega = String(formData.get("data_entrega") || "");
  const horario = String(formData.get("horario_publicacao_planejada") || "");
  const novoStatus = (String(formData.get("status") || "a_produzir")) as PostStatus;

  // status anterior para detectar transições que disparam notificação e para
  // preservar a data de publicação quando o formulário nao tem esse campo
  // (ex: editor/designer, que nao devem conseguir apagar essa data).
  const { data: anterior } = await supabase
    .from("posts").select("status, responsavel_id, dono_id, titulo, data_publicacao_planejada").eq("id", id).single();

  const data = formData.has("data_publicacao_planejada")
    ? String(formData.get("data_publicacao_planejada") || "")
    : (anterior?.data_publicacao_planejada ?? "");

  const { data: row, error } = await supabase
    .from("posts")
    .update({
      titulo: String(formData.get("titulo") || "").trim(),
      ideia: String(formData.get("ideia") || ""),
      briefing: String(formData.get("briefing") || ""),
      caption: String(formData.get("caption") || ""),
      formato: (String(formData.get("formato") || "estatico")) as PostFormat,
      delivered_link: String(formData.get("delivered_link") || "") || null,
      data_publicacao_planejada: data || null,
      data_entrega: dataEntrega || null,
      horario_publicacao_planejada: horario || null,
      status: novoStatus,
      responsavel_id: responsavel || null,
      dono_id: dono || null,
    })
    .eq("id", id)
    .select("client_id")
    .single();

  if (error) return { error: error.message };

    const tituloAtual = String(formData.get("titulo") || "").trim();
  if (anterior && responsavel && anterior.responsavel_id !== responsavel) {
    await notifyUser(supabase, responsavel, `Você foi definido como executor em "${tituloAtual}".`, id);
  }
  if (anterior && dono && dono !== responsavel && anterior.dono_id !== dono) {
    await notifyUser(supabase, dono, `Você foi definido como dono da demanda "${tituloAtual}".`, id);
  }
if (anterior && anterior.status !== novoStatus) {
    if (novoStatus === "para_aprovacao") await notifyAwaitingApproval(supabase, id);
    else if (novoStatus === "alterar") await notifyStatusAlterar(supabase, id);
    else if (novoStatus === "revisao_interna") await notifyEntregue(supabase, id);
  }

  revalidatePath(`/posts/${id}`);
  revalidatePath(`/clientes/${row.client_id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true };
}

// Mudança rápida de status (usada no kanban)
export async function updatePostStatus(id: string, status: PostStatus) {
  const auth = await requireRole();
  if ("error" in auth) return { error: auth.error };
  if (!ehGestaoPerfil(auth.user.perfil) && !ETAPAS_EXECUTOR.includes(status)) {
    return { error: "Essa etapa é com a social media." };
  }
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
    else if (status === "revisao_interna") await notifyEntregue(supabase, id);
  }

  revalidatePath(`/clientes/${row.client_id}`);
  revalidatePath(`/posts/${id}`);
  revalidatePath("/posts");
  revalidatePath("/");
  return { ok: true };
}

// Reordena manualmente uma coluna do kanban: grava `ordem` = índice para
// cada id, na ordem recebida. O client envia a lista já reordenada da coluna
// que está vendo (funciona tanto na visão por cliente quanto na agregada).
export async function reorderColumn(orderedIds: string[]) {
  const auth = await requireRole();
  if ("error" in auth) return { error: auth.error };
  if (!orderedIds.length) return { ok: true };

  const supabase = await createClient();
  const results = await Promise.all(
    orderedIds.map((id, i) => supabase.from("posts").update({ ordem: i }).eq("id", id))
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { error: failed.error.message };

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

  // Notifica quem foi mencionado com @nome (menos quem escreveu).
  const { data: postRowMencao } = await supabase.from("posts").select("titulo").eq("id", postId).single();
  const { data: usersAtivosMencao } = await supabase.from("users").select("id, nome").eq("ativo", true);
  const mencionados = detectarMencoes(trimmed, (usersAtivosMencao ?? []) as { id: string; nome: string }[]);
  for (const m of mencionados) {
    if (m.id === user?.id) continue;
    await notifyUser(
      supabase,
      m.id,
      `Você foi mencionado no post "${postRowMencao?.titulo ?? ""}": "${trimmed.slice(0, 120)}"`,
      postId
    );
  }
  if (error) return { error: error.message };

  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function addReferenceLink(postId: string, label: string, url: string) {
  const supabase = await createClient();
  const l = label.trim();
  const u = url.trim();
  if (!u) return { error: "Link é obrigatório." };
  const { error } = await supabase
    .from("post_reference_links")
    .insert({ post_id: postId, label: l || "Link", url: u });
  if (error) return { error: error.message };
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function deleteReferenceLink(postId: string, linkId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("post_reference_links").delete().eq("id", linkId);
  if (error) return { error: error.message };
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function addAttachment(postId: string, storagePath: string, nome: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("post_attachments")
    .insert({ post_id: postId, storage_path: storagePath, nome: nome || "" });
  if (error) return { error: error.message };
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function deleteAttachment(postId: string, attachmentId: string, storagePath: string) {
  const supabase = await createClient();
  await supabase.storage.from("post-attachments").remove([storagePath]);
  const { error } = await supabase.from("post_attachments").delete().eq("id", attachmentId);
  if (error) return { error: error.message };
  revalidatePath(`/posts/${postId}`);
  return { ok: true };
}

export async function updatePostDate(postId: string, novaData: string) {
  const supabase = await createClient();
  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("client_id")
    .eq("id", postId)
    .single();
  if (fetchError) return { error: fetchError.message };
  const { error } = await supabase
    .from("posts")
    .update({ data_publicacao_planejada: novaData })
    .eq("id", postId);
  if (error) return { error: error.message };
  if (post?.client_id) revalidatePath(`/clientes/${post.client_id}`);
  return { ok: true };
}

export async function createBulkPosts(
  clientId: string,
  executorId: string,
  rows: {
    titulo: string;
    briefing: string;
    caption: string;
    formato: string;
    status: string;
    data: string;
    horario: string | null;
  }[]
) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  if (!executorId) {
    return { error: "Selecione o executor." };
  }
  if (!rows || rows.length === 0) {
    return { error: "Nenhum post para criar." };
  }
  if (rows.length > 60) {
    return { error: "Máximo de 60 posts por lote." };
  }
  const semTitulo = rows.some((r) => !r.titulo || !r.titulo.trim());
  if (semTitulo) {
    return { error: "Preencha o título de todos os posts." };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("responsavel_id")
    .eq("id", clientId)
    .single();
  const respId = client?.responsavel_id ?? null;

  const inserts = rows.map((r) => ({
    client_id: clientId,
    titulo: r.titulo.trim(),
    briefing: r.briefing || "",
    caption: r.caption || "",
    formato: r.formato,
    data_entrega: r.data,
    horario_publicacao_planejada: r.horario,
    status: r.status,
    dono_id: respId,
    responsavel_id: executorId,
  }));

  const { error } = await supabase.from("posts").insert(inserts);
  if (error) return { error: error.message };

  if (executorId !== auth.user.id) {
    const { data: cli } = await supabase.from("clients").select("nome").eq("id", clientId).single();
    const n = inserts.length;
    await notifyUser(
      supabase,
      executorId,
      `${n} ${n === 1 ? "post novo" : "posts novos"}${cli?.nome ? ` de ${cli.nome}` : ""} ${n === 1 ? "foi atribuído" : "foram atribuídos"} a você.`
    );
  }

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, count: inserts.length };
}

// Muda o executor (arraste entre colunas de pessoa no Dashboard). Se o post
// estava numa etapa "final" (aprovacao/aprovado/publicado), volta pra
// "a_produzir" ao ser reatribuido, ja que esta reentrando em producao.
export async function updatePostPerson(id: string, novoExecutorId: string) {
  const supabase = await createClient();

  const { data: atual } = await supabase
    .from("posts")
    .select("status, client_id, titulo, responsavel_id")
    .eq("id", id)
    .single();
  if (!atual) return { error: "Post não encontrado." };

  const statusFinal = ["revisao_interna", "para_aprovacao", "aprovado", "agendado", "publicado"];
  const payload: { responsavel_id: string; status?: string } = {
    responsavel_id: novoExecutorId,
  };
  if (statusFinal.includes(atual.status)) {
    payload.status = "a_produzir";
  }

  const { error } = await supabase.from("posts").update(payload).eq("id", id);
  if (error) return { error: error.message };

  if (atual.responsavel_id !== novoExecutorId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.id !== novoExecutorId) {
      await notifyUser(supabase, novoExecutorId, `"${atual.titulo}" foi passado para você.`, id);
    }
  }

  revalidatePath("/");
  if (atual.client_id) revalidatePath(`/clientes/${atual.client_id}`);
  return { ok: true };
}

export async function archivePost(id: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("posts")
    .update({ arquivado: true })
    .eq("id", id)
    .select("client_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/posts");
  if (row?.client_id) revalidatePath(`/clientes/${row.client_id}`);
  return { ok: true };
}

export async function unarchivePost(id: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("posts")
    .update({ arquivado: false })
    .eq("id", id)
    .select("client_id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/");
  revalidatePath("/posts");
  if (row?.client_id) revalidatePath(`/clientes/${row.client_id}`);
  return { ok: true };
}

// ---------- Ações rápidas do fluxo (Minha mesa e página do post) ----------

function revalidarPost(id: string, clientId?: string | null) {
  revalidatePath(`/posts/${id}`);
  if (clientId) revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/posts");
  revalidatePath("/painel");
  revalidatePath("/");
}

// Executor entrega: grava o link e manda para a revisão interna.
export async function entregarPost(id: string, link: string) {
  const auth = await requireRole();
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("posts").select("responsavel_id, client_id, delivered_link").eq("id", id).single();
  if (!post) return { error: "Post não encontrado." };

  const ehGestao = (GESTOR as readonly string[]).includes(auth.user.perfil);
  if (post.responsavel_id !== auth.user.id && !ehGestao) {
    return { error: "Só o executor deste post pode entregar." };
  }

  const linkFinal = link.trim() || post.delivered_link || "";
  if (!linkFinal) return { error: "Cole o link da entrega antes de enviar." };

  const { error } = await supabase
    .from("posts")
    .update({ delivered_link: linkFinal, status: "revisao_interna" })
    .eq("id", id);
  if (error) return { error: error.message };

  await notifyEntregue(supabase, id);
  revalidarPost(id, post.client_id);
  return { ok: true };
}

// Revisão aprovada: gera o link de aprovação e manda para o cliente.
export async function enviarAoCliente(id: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  return sendForApproval(id);
}

// Revisão (ou qualquer etapa) volta para o executor com o pedido escrito.
export async function pedirAjuste(id: string, texto: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const pedido = texto.trim();
  if (!pedido) return { error: "Escreva o que precisa ser ajustado." };
  const supabase = await createClient();

  await supabase.from("comments").insert({
    post_id: id,
    author_id: auth.user.id,
    texto: `Ajuste pedido: ${pedido}`,
    tipo: "interno",
  });

  const { data: row, error } = await supabase
    .from("posts").update({ status: "alterar" }).eq("id", id).select("client_id").single();
  if (error) return { error: error.message };

  await notifyStatusAlterar(supabase, id);
  revalidarPost(id, row?.client_id);
  return { ok: true };
}

// Social media confirma que foi ao ar.
export async function marcarPublicado(id: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("posts").update({ status: "publicado" }).eq("id", id).select("client_id").single();
  if (error) return { error: error.message };
  revalidarPost(id, row?.client_id);
  return { ok: true };
}

// Social media cobra quem está com um post que publica em breve.
export async function cobrarExecutor(id: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts").select("titulo, responsavel_id, data_publicacao_planejada, data_entrega").eq("id", id).single();
  if (!post?.responsavel_id) return { error: "Este post não tem executor." };
  if (post.responsavel_id === auth.user.id) return { error: "Este post está com você." };

  const quem = (auth.user.nome || "A social media").split(" ")[0];
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const entrega = post.data_entrega?.slice(0, 10);
  const pub = post.data_publicacao_planejada?.slice(0, 10);
  const ddmm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  const motivo =
    entrega && entrega < hoje
      ? `a entrega era ${ddmm(entrega)}`
      : pub
      ? `publica ${pub < hoje ? `desde ${ddmm(pub)}` : pub === hoje ? "hoje" : "amanhã"}`
      : "está pendente";
  await notifyUser(supabase, post.responsavel_id, `${quem} está cobrando "${post.titulo}": ${motivo}.`, id);
  return { ok: true };
}

// Social media agendou na rede: o post sai da fila de "pra publicar" e vira
// "Publicado" sozinho no dia seguinte à data de publicação (rotina diária).
export async function marcarAgendado(id: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("posts").update({ status: "agendado" }).eq("id", id).select("client_id").single();
  if (error) return { error: error.message };
  revalidarPost(id, row?.client_id);
  return { ok: true };
}
