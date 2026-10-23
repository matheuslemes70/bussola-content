"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";

const GESTOR = ["admin", "social_media"] as const;

export async function updateBrandCore(clientId: string, formData: FormData) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const payload = {
    persona: String(formData.get("persona") || ""),
    diagnostico: String(formData.get("diagnostico") || ""),
    concorrencia: String(formData.get("concorrencia") || ""),
    posicionamento: String(formData.get("posicionamento") || ""),
    esteira_produtos: String(formData.get("esteira_produtos") || ""),
  };

  // upsert por client_id (caso o registro não exista ainda)
  const { error } = await supabase
    .from("brand_core")
    .upsert({ client_id: clientId, ...payload }, { onConflict: "client_id" });

  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

// Cria (ou reusa) a aprovação de pauta para um mês e devolve o token.
export async function sendPautaForApproval(
  clientId: string,
  ano: number,
  mes: number,
  incluirBriefing: boolean,
  dataInicio?: string | null,
  dataFim?: string | null
) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const isPeriodo = Boolean(dataInicio && dataFim);

  const query = supabase
    .from("pauta_approvals")
    .select("id, token")
    .eq("client_id", clientId)
    .eq("ano", ano)
    .eq("mes", mes);

  const { data: existing } = isPeriodo
    ? await query.eq("data_inicio", dataInicio!).eq("data_fim", dataFim!).maybeSingle()
    : await query.is("data_inicio", null).maybeSingle();

  if (existing) {
    // Reenviar: volta para pendente e atualiza a opção de briefing.
    const { error } = await supabase
      .from("pauta_approvals")
      .update({ status: "pendente", incluir_briefing: incluirBriefing, comentario: null, autor_resposta: null, responded_at: null })
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath(`/clientes/${clientId}`);
    return { ok: true, token: existing.token as string };
  }

  const { data, error } = await supabase
    .from("pauta_approvals")
    .insert({
      client_id: clientId,
      ano,
      mes,
      incluir_briefing: incluirBriefing,
      data_inicio: isPeriodo ? dataInicio : null,
      data_fim: isPeriodo ? dataFim : null,
    })
    .select("token")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, token: data.token as string };
}

export async function createAccess(
  clientId: string,
  plataforma: string,
  usuario: string,
  senha: string
) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const p = plataforma.trim();
  if (!p) return { error: "Plataforma é obrigatória." };
  const { error } = await supabase
    .from("client_accesses")
    .insert({ client_id: clientId, plataforma: p, usuario: usuario.trim(), senha: encryptSecret(senha) });
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function updateAccess(
  clientId: string,
  accessId: string,
  plataforma: string,
  usuario: string,
  senha: string
) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const p = plataforma.trim();
  if (!p) return { error: "Plataforma é obrigatória." };
  const { error } = await supabase
    .from("client_accesses")
    .update({ plataforma: p, usuario: usuario.trim(), senha: encryptSecret(senha) })
    .eq("id", accessId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function deleteAccess(clientId: string, accessId: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("client_accesses").delete().eq("id", accessId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function createFolder(clientId: string, nome: string, parentId: string | null) {
  const supabase = await createClient();
  const trimmed = nome.trim();
  if (!trimmed) return { error: "Nome da pasta é obrigatório." };
  const { error } = await supabase
    .from("file_folders")
    .insert({ client_id: clientId, nome: trimmed, parent_id: parentId });
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function deleteFolder(clientId: string, folderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("file_folders").delete().eq("id", folderId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function createFile(
  clientId: string,
  folderId: string | null,
  nome: string,
  driveLink: string
) {
  const supabase = await createClient();
  const n = nome.trim();
  const link = driveLink.trim();
  if (!n) return { error: "Nome do arquivo é obrigatório." };
  if (!link) return { error: "Link do Drive é obrigatório." };
  const { error } = await supabase
    .from("files")
    .insert({ client_id: clientId, folder_id: folderId, nome: n, drive_link: link });
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function deleteFile(clientId: string, fileId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("files").delete().eq("id", fileId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

// Gera um link COMPLETAMENTE NOVO (novo token) para a pauta do periodo,
// descartando o anterior (que passa a ser invalido).
export async function regenerarLinkPauta(
  clientId: string,
  ano: number,
  mes: number,
  incluirBriefing: boolean,
  dataInicio?: string | null,
  dataFim?: string | null
) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const isPeriodo = Boolean(dataInicio && dataFim);

  const deleteQuery = supabase
    .from("pauta_approvals")
    .delete()
    .eq("client_id", clientId)
    .eq("ano", ano)
    .eq("mes", mes);

  if (isPeriodo) {
    await deleteQuery.eq("data_inicio", dataInicio!).eq("data_fim", dataFim!);
  } else {
    await deleteQuery.is("data_inicio", null);
  }

  const { data, error } = await supabase
    .from("pauta_approvals")
    .insert({
      client_id: clientId,
      ano,
      mes,
      incluir_briefing: incluirBriefing,
      data_inicio: isPeriodo ? dataInicio : null,
      data_fim: isPeriodo ? dataFim : null,
    })
    .select("token")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, token: data.token as string };
}
