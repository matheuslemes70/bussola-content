"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const FINANCEIRO = ["admin"] as const;

export async function createContract(formData: FormData) {
  const auth = await requireRole([...FINANCEIRO]);
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();

  const clientId = String(formData.get("client_id") || "");
  const valorMensal = Number(formData.get("valor_mensal") || 0);
  const dataInicio = String(formData.get("data_inicio") || "");

  if (!clientId) return { error: "Cliente é obrigatório." };
  if (!valorMensal || valorMensal <= 0) return { error: "Valor mensal inválido." };
  if (!dataInicio) return { error: "Data de início é obrigatória." };

  const payload = {
    client_id: clientId,
    valor_mensal: valorMensal,
    data_inicio: dataInicio,
    status: "ativo" as const,
  };

  const { error } = await supabase.from("client_contracts").insert(payload);
  if (error) return { error: error.message };

  revalidatePath("/financeiro");
  return { ok: true };
}

export async function cancelContract(id: string, motivo: string) {
  const auth = await requireRole([...FINANCEIRO]);
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();

  const payload = {
    status: "cancelado" as const,
    data_fim: new Date().toISOString().slice(0, 10),
    motivo_cancelamento: motivo.trim(),
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("client_contracts").update(payload).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/financeiro");
  return { ok: true };
}

export async function pauseContract(id: string) {
  const auth = await requireRole([...FINANCEIRO]);
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_contracts")
    .update({ status: "pausado", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/financeiro");
  return { ok: true };
}

export async function reactivateContract(id: string) {
  const auth = await requireRole([...FINANCEIRO]);
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("client_contracts")
    .update({ status: "ativo", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/financeiro");
  return { ok: true };
}

export async function setMeta(mes: number, ano: number, valorMeta: number) {
  const auth = await requireRole([...FINANCEIRO]);
  if ("error" in auth) return { error: auth.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("metas_financeiras")
    .upsert(
      { mes, ano, valor_meta: valorMeta, updated_at: new Date().toISOString() },
      { onConflict: "mes,ano" }
    );
  if (error) return { error: error.message };

  revalidatePath("/financeiro");
  return { ok: true };
}
