"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createContract } from "@/app/(app)/financeiro/actions";
import type { Client } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue";

export function ContractForm({ clients }: { clients: Client[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const hoje = new Date().toISOString().slice(0, 10);

  function onSubmit(formData: FormData) {
    setErro(null);
    startTransition(async () => {
      const res = await createContract(formData);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <select name="client_id" required defaultValue="" className={inputCls}>
        <option value="" disabled>
          Selecione o cliente
        </option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <input
        name="valor_mensal"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="Valor mensal (R$)"
        required
        className={inputCls}
      />
      <input name="data_inicio" type="date" defaultValue={hoje} required className={inputCls} />
      {erro && <p className="text-sm text-red-600 sm:col-span-3">{erro}</p>}
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60"
        >
          {pending ? "Salvando..." : "+ Cadastrar contrato"}
        </button>
      </div>
    </form>
  );
}
