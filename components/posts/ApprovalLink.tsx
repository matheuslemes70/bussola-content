"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendForApproval } from "@/app/(app)/posts/actions";

export function ApprovalLink({
  postId,
  token,
  baseUrl,
}: {
  postId: string;
  token: string | null;
  baseUrl: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currentToken, setCurrentToken] = useState(token);
  const [copiado, setCopiado] = useState(false);

  const link = currentToken ? `${baseUrl}/aprovacao/${currentToken}` : null;

  function enviar() {
    startTransition(async () => {
      const res = await sendForApproval(postId);
      if (res?.ok && res.token) setCurrentToken(res.token);
      router.refresh();
    });
  }

  async function copiar() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="space-y-2">
      <button
        onClick={enviar}
        disabled={pending}
        className="w-full rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60"
      >
        {pending ? "Gerando..." : link ? "Reenviar para aprovação" : "Enviar para aprovação"}
      </button>

      {link && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
          <p className="mb-1 text-xs font-medium text-slate-500">Link público de aprovação</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
            />
            <button
              onClick={copiar}
              className="rounded bg-bussola-blue px-3 py-1 text-xs font-medium text-white hover:brightness-110"
            >
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
