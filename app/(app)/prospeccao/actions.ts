"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { ProspectEtapa, ProspectOrigem } from "@/lib/types";

const ADMIN = ["admin"] as const;

export async function createProspect(formData: FormData) {
  const auth = await requireRole([...ADMIN]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { error: "Nome é obrigatório." };

  const payload = {
    nome,
    contato: String(formData.get("contato") || "").trim(),
    origem: String(formData.get("origem") || "organico") as ProspectOrigem,
    etapa: "lead" as ProspectEtapa,
    valor_estimado: formData.get("valor_estimado")
      ? Number(formData.get("valor_estimado"))
      : null,
    observacoes: String(formData.get("observacoes") || "").trim(),
    responsavel_id: String(formData.get("responsavel_id") || "") || null,
  };

  const { error } = await supabase.from("prospects").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/prospeccao");
  return { ok: true };
}

export async function updateProspect(id: string, formData: FormData) {
  const auth = await requireRole([...ADMIN]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { error: "Nome é obrigatório." };

  const payload = {
    nome,
    contato: String(formData.get("contato") || "").trim(),
    origem: String(formData.get("origem") || "organico") as ProspectOrigem,
    valor_estimado: formData.get("valor_estimado")
      ? Number(formData.get("valor_estimado"))
      : null,
    observacoes: String(formData.get("observacoes") || "").trim(),
    responsavel_id: String(formData.get("responsavel_id") || "") || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("prospects").update(payload).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/prospeccao");
  return { ok: true };
}

export async function moverEtapa(id: string, etapa: ProspectEtapa) {
  const auth = await requireRole([...ADMIN]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const { error } = await supabase
    .from("prospects")
    .update({ etapa, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/prospeccao");
  return { ok: true };
}

export async function deleteProspect(id: string) {
  const auth = await requireRole([...ADMIN]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const { error } = await supabase.from("prospects").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/prospeccao");
  return { ok: true };
}
