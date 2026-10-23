"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moverEtapa, deleteProspect, updateProspect } from "@/app/(app)/prospeccao/actions";
import { PROSPECT_ETAPA_LABELS, PROSPECT_ETAPA_ORDER, PROSPECT_ETAPA_COLORS, PROSPECT_ORIGEM_LABELS } from "@/lib/status";
import type { Prospect, User } from "@/lib/types";

export function ProspectCard({
  prospect,
  respName,
  users,
}: {
  prospect: Prospect;
  respName?: string;
  users: User[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [expandido, setExpandido] = useState(false);

  function mudarEtapa(etapa: string) {
    startTransition(async () => {
      await moverEtapa(prospect.id, etapa as Prospect["etapa"]);
      router.refresh();
    });
  }

  function remover() {
    if (!confirm(`Remover "${prospect.nome}" da prospecção?`)) return;
    startTransition(async () => {
      await deleteProspect(prospect.id);
      router.refresh();
    });
  }

  const etapaIdx = PROSPECT_ETAPA_ORDER.indexOf(prospect.etapa);
  const proxima = PROSPECT_ETAPA_ORDER[etapaIdx + 1];
  const anterior = PROSPECT_ETAPA_ORDER[etapaIdx - 1];

  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <button onClick={() => setExpandido((v) => !v)} className="w-full text-left">
        <p className="text-sm font-semibold text-slate-800">{prospect.nome}</p>
        {prospect.valor_estimado && (
          <p className="text-xs text-emerald-600">
            R$ {Number(prospect.valor_estimado).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        )}
        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs ${PROSPECT_ETAPA_COLORS[prospect.origem] ?? "bg-slate-100 text-slate-600"}`}>
          {PROSPECT_ORIGEM_LABELS[prospect.origem]}
        </span>
        {respName && <p className="mt-1 text-xs text-slate-400">{respName}</p>}
      </button>

      {expandido && (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
          {prospect.contato && <p className="text-xs text-slate-500">📞 {prospect.contato}</p>}
          {prospect.observacoes && <p className="text-xs text-slate-500">{prospect.observacoes}</p>}
          <div className="flex flex-wrap gap-1">
            {anterior && (
              <button onClick={() => mudarEtapa(anterior)} disabled={pending}
                className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 hover:bg-slate-200 disabled:opacity-60">
                ← {PROSPECT_ETAPA_LABELS[anterior]}
              </button>
            )}
            {proxima && (
              <button onClick={() => mudarEtapa(proxima)} disabled={pending}
                className="rounded bg-bussola-yellow px-2 py-1 text-xs font-semibold text-black hover:brightness-95 disabled:opacity-60">
                {PROSPECT_ETAPA_LABELS[proxima]} →
              </button>
            )}
            {prospect.etapa !== "perdido" && (
              <button onClick={() => mudarEtapa("perdido")} disabled={pending}
                className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100 disabled:opacity-60">
                Marcar perdido
              </button>
            )}
            <button onClick={remover} disabled={pending}
              className="rounded px-2 py-1 text-xs text-slate-400 hover:text-red-500 disabled:opacity-60">
              remover
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
