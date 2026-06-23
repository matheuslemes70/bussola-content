"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clientApprove, clientRequestChanges } from "@/app/aprovacao/[token]/actions";

export function ApprovalActions({
  token,
  status,
}: {
  token: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [nome, setNome] = useState("");
  const [comentario, setComentario] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<"aprovado" | "ajuste" | null>(null);

  function aprovar() {
    setErro(null);
    startTransition(async () => {
      const res = await clientApprove(token, nome, comentario);
      if (res?.error) return setErro(res.error);
      setFeito("aprovado");
      setComentario("");
      router.refresh();
    });
  }

  function solicitarAjuste() {
    setErro(null);
    startTransition(async () => {
      const res = await clientRequestChanges(token, nome, comentario);
      if (res?.error) return setErro(res.error);
      setFeito("ajuste");
      setComentario("");
      router.refresh();
    });
  }

  if (feito === "aprovado") {
    return (
      <div className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-medium text-emerald-700">
        Conteúdo aprovado! Obrigado.
      </div>
    );
  }
  if (feito === "ajuste") {
    return (
      <div className="rounded-xl bg-orange-50 p-4 text-center text-sm font-medium text-orange-700">
        Ajuste solicitado. A equipe foi notificada.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Seu nome"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
      />
      <textarea
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
        rows={3}
        placeholder="Comentário (obrigatório ao solicitar ajuste)"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={aprovar}
          disabled={pending}
          className="flex-1 rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60"
        >
          Aprovar
        </button>
        <button
          onClick={solicitarAjuste}
          disabled={pending}
          className="flex-1 rounded-xl bg-orange-500 py-4 text-base font-semibold text-white hover:bg-orange-600 active:bg-orange-700 disabled:opacity-60"
        >
          Solicitar ajuste
        </button>
      </div>
    </div>
  );
}
