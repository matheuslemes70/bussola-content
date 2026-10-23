"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setMeta } from "@/app/(app)/financeiro/actions";

export function MetaEditor({
  mes,
  ano,
  valorAtual,
}: {
  mes: number;
  ano: number;
  valorAtual: number;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(valorAtual > 0 ? String(valorAtual) : "");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar() {
    const numero = Number(valor);
    if (!numero || numero <= 0) {
      setErro("Informe um valor válido.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const res = await setMeta(mes, ano, numero);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setEditando(false);
      router.refresh();
    });
  }

  if (!editando) {
    return (
      <button
        onClick={() => setEditando(true)}
        className="text-xs font-medium text-bussola-blue hover:underline"
      >
        {valorAtual > 0 ? "Editar meta" : "Definir meta"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        min="0.01"
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        placeholder="Valor da meta (R$)"
        className="w-32 rounded-lg border border-slate-300 px-2 py-1 text-xs outline-none focus:border-bussola-blue"
      />
      <button
        onClick={salvar}
        disabled={pending}
        className="rounded-lg bg-bussola-yellow px-2 py-1 text-xs font-bold text-black hover:brightness-95 disabled:opacity-60"
      >
        {pending ? "Salvando..." : "Salvar"}
      </button>
      <button
        onClick={() => setEditando(false)}
        disabled={pending}
        className="text-xs text-slate-500 hover:underline"
      >
        Cancelar
      </button>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
