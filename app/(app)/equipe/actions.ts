"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

// O RLS já restringe a admin; aqui rejeitamos cedo (defesa em profundidade).
export async function updateUser(id: string, formData: FormData) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();

  const { error } = await supabase
    .from("users")
    .update({
      nome: String(formData.get("nome") || "").trim(),
      perfil: String(formData.get("perfil") || "editor") as UserRole,
      ativo: formData.get("ativo") === "on",
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/equipe");
  return { ok: true };
}

export async function toggleUserAtivo(id: string, ativo: boolean) {
  const auth = await requireRole(["admin"]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("users").update({ ativo }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/equipe");
  return { ok: true };
}
