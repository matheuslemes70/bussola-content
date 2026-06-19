import { createClient } from "./supabase/server";
import type { User } from "./types";

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
