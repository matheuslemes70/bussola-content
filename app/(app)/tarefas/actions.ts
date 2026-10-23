"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addTodo(texto: string, data: string) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Não autenticado." };
  if (!texto.trim()) return { error: "Escreva a tarefa." };

  const row: { user_id: string; texto: string; data?: string } = {
    user_id: auth.user.id,
    texto: texto.trim(),
  };
  if (data) row.data = data;

  const { error } = await supabase.from("todos").insert(row);
  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  return { ok: true };
}

export async function toggleTodo(id: string, feita: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("todos").update({ feita }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  return { ok: true };
}

export async function deleteTodo(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("todos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/tarefas");
  return { ok: true };
}
