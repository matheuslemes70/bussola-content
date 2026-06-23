import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canManageTeam } from "@/lib/permissions";
import { UserRow } from "@/components/team/UserRow";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EquipePage() {
  const me = await getCurrentUser();
  if (!canManageTeam(me?.perfil)) redirect("/");

  const supabase = await createClient();
  const { data: users } = await supabase.from("users").select("*").order("nome");
  const allUsers = (users as User[]) ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Equipe</h1>

      <p className="rounded-lg border border-slate-200 bg-blue-50 p-3 text-sm text-slate-600">
        Novos usuários são criados no painel do Supabase (Authentication → Users). Ao
        criar o login, o perfil aparece aqui automaticamente para você definir o cargo.
      </p>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">E-mail</th>
              <th className="px-4 py-3">Perfil</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {allUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhum usuário ainda.
                </td>
              </tr>
            )}
            {allUsers.map((u) => (
              <UserRow key={u.id} user={u} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
