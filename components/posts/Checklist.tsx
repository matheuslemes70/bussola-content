"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
} from "@/app/(app)/posts/actions";
import type { ChecklistItem } from "@/lib/types";

export function Checklist({
  postId,
  items,
}: {
  postId: string;
  items: ChecklistItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");

  const feitos = items.filter((i) => i.concluido).length;

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    startTransition(async () => {
      await addChecklistItem(postId, texto);
      setTexto("");
      router.refresh();
    });
  }

  function toggle(item: ChecklistItem) {
    startTransition(async () => {
      await toggleChecklistItem(item.id, postId, !item.concluido);
      router.refresh();
    });
  }

  function remover(item: ChecklistItem) {
    startTransition(async () => {
      await deleteChecklistItem(item.id, postId);
      router.refresh();
    });
  }

  return (
    <div>
      {items.length > 0 && (
        <p className="mb-2 text-xs text-slate-400">
          {feitos} de {items.length} concluído{items.length > 1 ? "s" : ""}
        </p>
      )}

      <ul className="mb-3 space-y-1">
        {items.map((item) => (
          <li key={item.id} className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={item.concluido}
              disabled={pending}
              onChange={() => toggle(item)}
              className="h-4 w-4 cursor-pointer accent-bussola-blue"
            />
            <span className={`flex-1 text-sm ${item.concluido ? "text-slate-400 line-through" : "text-slate-700"}`}>
              {item.texto}
            </span>
            <button
              onClick={() => remover(item)}
              disabled={pending}
              className="text-xs text-red-500 opacity-0 hover:underline group-hover:opacity-100 disabled:opacity-60"
            >
              remover
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="px-2 text-sm text-slate-400">Nenhuma subtarefa.</li>}
      </ul>

      <form onSubmit={adicionar} className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Adicionar subtarefa..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
        />
        <button type="submit" disabled={pending}
          className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
          Adicionar
        </button>
      </form>
    </div>
  );
}
