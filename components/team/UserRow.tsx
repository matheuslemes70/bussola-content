"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateUser, toggleUserAtivo } from "@/app/(app)/equipe/actions";
import { ROLE_LABELS } from "@/lib/permissions";
import type { User, UserRole } from "@/lib/types";

export function UserRow({ user }: { user: User }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function salvar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await updateUser(user.id, fd);
      setEditing(false);
      router.refresh();
    });
  }

  function toggle() {
    startTransition(async () => {
      await toggleUserAtivo(user.id, !user.ativo);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <tr className="bg-slate-50">
        <td className="px-4 py-2" colSpan={5}>
          <form onSubmit={salvar} className="flex flex-wrap items-center gap-2">
            <input name="nome" defaultValue={user.nome} placeholder="Nome"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none" />
            <span className="text-sm text-slate-500">{user.email}</span>
            <select name="perfil" defaultValue={user.perfil}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none">
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-sm text-slate-600">
              <input type="checkbox" name="ativo" defaultChecked={user.ativo} /> Ativo
            </label>
            <button type="submit" disabled={pending}
              className="rounded-lg bg-bussola-yellow px-3 py-1.5 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
              Salvar
            </button>
            <button type="button" onClick={() => setEditing(false)}
              className="text-sm text-slate-500">Cancelar</button>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 font-medium text-slate-800">{user.nome || "—"}</td>
      <td className="px-4 py-3 text-slate-600">{user.email}</td>
      <td className="px-4 py-3 text-slate-600">{ROLE_LABELS[user.perfil]}</td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2 py-0.5 text-xs ${
          user.ativo ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
        }`}>
          {user.ativo ? "Ativo" : "Inativo"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button onClick={() => setEditing(true)} className="mr-3 text-sm text-bussola-blue hover:underline">
          Editar
        </button>
        <button onClick={toggle} disabled={pending}
          className="text-sm text-slate-500 hover:underline disabled:opacity-60">
          {user.ativo ? "Desativar" : "Reativar"}
        </button>
      </td>
    </tr>
  );
}
