"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { gerarSemana } from "@/lib/rotina";
import { hojeBrasilia } from "@/lib/status";
import type { PostFormat } from "@/lib/types";

const GESTOR = ["admin", "social_media", "gestor_projetos"] as const;
const FORMATOS: PostFormat[] = ["reels", "carrossel", "estatico", "story"];

export async function adicionarRotina(clientId: string, formData: FormData) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };

  const dia = Number(formData.get("dia_semana"));
  const formato = String(formData.get("formato")) as PostFormat;
  const executor = String(formData.get("executor_id") || "");
  const diasAntes = Number(formData.get("dias_antes") ?? 2);
  if (!(dia >= 1 && dia <= 7)) return { error: "Escolha o dia." };
  if (!FORMATOS.includes(formato)) return { error: "Escolha o formato." };
  if (!executor) return { error: "Escolha quem executa." };
  if (!(diasAntes >= 0 && diasAntes <= 10)) return { error: "A entrega deve ser de 0 a 10 dias antes." };

  const supabase = await createClient();
  const { error } = await supabase.from("rotina_semanal").insert({
    client_id: clientId,
    dia_semana: dia,
    formato,
    executor_id: executor,
    dias_antes: diasAntes,
  });
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function removerRotina(clientId: string, id: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("rotina_semanal").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

export async function gerarRotinaAgora(clientId: string) {
  const auth = await requireRole([...GESTOR]);
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const res = await gerarSemana(supabase, { hoje: hojeBrasilia(), clientId });
  if (res.erro) return { error: res.erro };
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/");
  revalidatePath("/posts");
  return { ok: true, criados: res.criados, inicio: res.semana.inicio, fim: res.semana.fim };
}
