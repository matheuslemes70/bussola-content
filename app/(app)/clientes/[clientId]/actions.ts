"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateBrandCore(clientId: string, formData: FormData) {
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
  incluirBriefing: boolean
) {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("pauta_approvals")
    .select("id, token")
    .eq("client_id", clientId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();

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
    .insert({ client_id: clientId, ano, mes, incluir_briefing: incluirBriefing })
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
  const supabase = await createClient();
  const p = plataforma.trim();
  if (!p) return { error: "Plataforma é obrigatória." };
  const { error } = await supabase
    .from("client_accesses")
    .insert({ client_id: clientId, plataforma: p, usuario: usuario.trim(), senha });
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
  const supabase = await createClient();
  const p = plataforma.trim();
  if (!p) return { error: "Plataforma é obrigatória." };
  const { error } = await supabase
    .from("client_accesses")
    .update({ plataforma: p, usuario: usuario.trim(), senha })
    .eq("id", accessId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function deleteAccess(clientId: string, accessId: string) {
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
