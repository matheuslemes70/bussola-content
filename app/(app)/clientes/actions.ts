"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";

const GESTOR = ["admin", "social_media"] as const;

function parseRedes(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createCliente(formData: FormData) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const nome = String(formData.get("nome") || "").trim();
  if (!nome) return { error: "Nome é obrigatório." };

  const responsavel = String(formData.get("responsavel_id") || "");
  const { data, error } = await supabase
    .from("clients")
    .insert({
      nome,
      redes_sociais: parseRedes(String(formData.get("redes_sociais") || "")),
      responsavel_id: responsavel || null,
      status: (String(formData.get("status") || "ativo")) as "ativo" | "pausado",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Cria o registro de brand_core vazio junto
  await supabase.from("brand_core").insert({ client_id: data.id });

  revalidatePath("/clientes");
  revalidatePath("/");
  return { ok: true, id: data.id as string };
}

export async function updateCliente(id: string, formData: FormData) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const responsavel = String(formData.get("responsavel_id") || "");
  const { error } = await supabase
    .from("clients")
    .update({
      nome: String(formData.get("nome") || "").trim(),
      redes_sociais: parseRedes(String(formData.get("redes_sociais") || "")),
      responsavel_id: responsavel || null,
      status: (String(formData.get("status") || "ativo")) as "ativo" | "pausado",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  revalidatePath("/");
  return { ok: true };
}
