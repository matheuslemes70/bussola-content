import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canCreatePosts, canViewDataPublicacao } from "@/lib/permissions";
import { AppShell } from "@/components/AppShell";
import type { Client, User } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Dados do botão "Novo post" do topo (mesmos que a página de posts usa)
  const supabase = await createClient();
  const [{ data: clients }, { data: users }] = await Promise.all([
    supabase.from("clients").select("*").order("nome"),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
  ]);

  return (
    <AppShell
      user={user}
      clients={(clients as Client[]) ?? []}
      users={(users as User[]) ?? []}
      podeVerDataPublicacao={canViewDataPublicacao(user.perfil)}
      podeCriarPost={canCreatePosts(user.perfil)}
    >
      {children}
    </AppShell>
  );
}
