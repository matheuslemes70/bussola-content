import { createClient } from "./supabase/server";
import type { User, UserRole } from "./types";

// Retorna o perfil (public.users) do usuário logado, ou null.
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  return (data as User) ?? null;
}

// Defesa em profundidade: garante usuário logado (e, opcionalmente, com um dos
// papéis exigidos) antes de uma Server Action mutar dados. O RLS continua sendo
// a barreira real no banco; isto rejeita cedo e deixa a intenção explícita.
export async function requireRole(
  roles?: UserRole[]
): Promise<{ user: User } | { error: string }> {
  const user = await getCurrentUser();
  if (!user || !user.ativo) return { error: "Não autenticado." };
  if (roles && !roles.includes(user.perfil)) return { error: "Sem permissão." };
  return { user };
}
