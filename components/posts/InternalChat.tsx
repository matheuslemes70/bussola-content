"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addInternalComment } from "@/app/(app)/posts/actions";
import { formatDateTime } from "@/lib/status";
import type { Comment, User } from "@/lib/types";

export function InternalChat({
  postId,
  comments,
  users,
}: {
  postId: string;
  comments: Comment[];
  users: User[];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [pending, startTransition] = useTransition();
  const userMap = new Map(users.map((u) => [u.id, u]));

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    startTransition(async () => {
      const res = await addInternalComment(postId, texto);
      if (!res?.error) {
        setTexto("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col">
      <div className="mb-3 max-h-72 space-y-3 overflow-y-auto">
        {comments.length === 0 && (
          <p className="text-sm text-slate-400">Nenhum comentário ainda.</p>
        )}
        {comments.map((c) => {
          const autor = c.author_id ? userMap.get(c.author_id) : null;
          return (
            <div key={c.id} className="rounded-lg bg-slate-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  {autor?.nome || autor?.email || "Equipe"}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{c.texto}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={enviar} className="flex gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um feedback interno..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
        />
        <button type="submit" disabled={pending}
          className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
          Enviar
        </button>
      </form>
    </div>
  );
}
