import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Cria uma notificacao para um usuario. Best-effort: nunca lanca erro,
// para nao quebrar a acao principal (criar post, comentar, etc).
export async function notifyUser(
  supabase: SupabaseClient,
  userId: string,
  mensagem: string,
  postId?: string | null
) {
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      post_id: postId ?? null,
      tipo: "geral",
      mensagem,
    });
  } catch (err) {
    console.error("[notify] erro ao criar notificacao:", err);
  }
}

// Detecta @nome dentro de um texto e retorna os usuarios mencionados
// (compara pelo primeiro nome, sem acentos/maiusculas, para ser tolerante
// a como a pessoa digitar, ex: @matheus ou @Matheus).
export function detectarMencoes<T extends { id: string; nome: string }>(
  texto: string,
  usuarios: T[]
): T[] {
  const normalizar = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const mencoesTexto = Array.from(texto.matchAll(/@(\w+)/g)).map((m) =>
    normalizar(m[1])
  );
  if (mencoesTexto.length === 0) return [];

  return usuarios.filter((u) => {
    const primeiroNome = normalizar((u.nome || "").split(" ")[0] || "");
    return primeiroNome && mencoesTexto.includes(primeiroNome);
  });
}
