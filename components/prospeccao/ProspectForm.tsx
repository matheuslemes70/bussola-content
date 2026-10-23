"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createProspect } from "@/app/(app)/prospeccao/actions";
import { PROSPECT_ORIGEM_LABELS } from "@/lib/status";
import type { User } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue";

export function ProspectForm({ users }: { users: User[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const res = await createProspect(formData);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95"
      >
        + Novo prospect
      </button>
    );
  }

  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:w-auto">
      <form action={onSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:min-w-[28rem]">
        <input name="nome" placeholder="Nome / empresa" required className={inputCls + " sm:col-span-2"} />
        <input name="contato" placeholder="Telefone ou e-mail" className={inputCls} />
        <select name="origem" defaultValue="organico" className={inputCls}>
          {Object.entries(PROSPECT_ORIGEM_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <input name="valor_estimado" type="number" step="0.01" placeholder="Valor estimado (R$)" className={inputCls} />
        <select name="responsavel_id" defaultValue="" className={inputCls}>
          <option value="">Sem responsável</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.nome || u.email}</option>
          ))}
        </select>
        <textarea name="observacoes" placeholder="Observações" className={inputCls + " sm:col-span-2"} rows={2} />
        {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pending}
            className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
            Salvar
          </button>
          <button type="button" onClick={() => setOpen(false)}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:underline">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
