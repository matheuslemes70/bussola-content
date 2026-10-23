"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelContract, pauseContract, reactivateContract } from "@/app/(app)/financeiro/actions";
import type { ClientContract } from "@/lib/types";

export function ContractRow({
  contract,
  clientNome,
  formatMoeda,
}: {
  contract: ClientContract;
  clientNome: string;
  formatMoeda: (valor: number) => string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [motivo, setMotivo] = useState("");

  function pausar() {
    setErro(null);
    startTransition(async () => {
      const res = await pauseContract(contract.id);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      router.refresh();
    });
  }

  function reativar() {
    setErro(null);
    startTransition(async () => {
      const res = await reactivateContract(contract.id);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      router.refresh();
    });
  }

  function confirmarCancelamento() {
    setErro(null);
    startTransition(async () => {
      const res = await cancelContract(contract.id, motivo);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setConfirmando(false);
      router.refresh();
    });
  }

  return (
    <>
      <tr className="hover:bg-slate-50">
        <td className="px-4 py-2 font-medium text-slate-800">{clientNome}</td>
        <td className="px-4 py-2 text-center text-slate-600">
          {formatMoeda(Number(contract.valor_mensal))}
        </td>
        <td className="px-4 py-2 text-center text-slate-600">{contract.data_inicio}</td>
        <td className="px-4 py-2">
          <div className="flex justify-center gap-2">
            {contract.status === "ativo" && (
              <button
                onClick={pausar}
                disabled={pending}
                className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                Pausar
              </button>
            )}
            {contract.status === "pausado" && (
              <button
                onClick={reativar}
                disabled={pending}
                className="rounded-lg border border-emerald-300 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
              >
                Reativar
              </button>
            )}
            <button
              onClick={() => setConfirmando(true)}
              disabled={pending}
              className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </td>
      </tr>

      {confirmando && (
        <tr>
          <td colSpan={4} className="bg-slate-50 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder={`Motivo do cancelamento de ${clientNome} (opcional)`}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue sm:flex-1"
              />
              <div className="flex gap-2">
                <button
                  onClick={confirmarCancelamento}
                  disabled={pending}
                  className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {pending ? "Cancelando..." : "Confirmar cancelamento"}
                </button>
                <button
                  onClick={() => setConfirmando(false)}
                  disabled={pending}
                  className="rounded-lg px-3 py-2 text-xs text-slate-500 hover:underline"
                >
                  Voltar
                </button>
              </div>
            </div>
            {erro && <p className="mt-2 text-xs text-red-600">{erro}</p>}
          </td>
        </tr>
      )}
    </>
  );
}
