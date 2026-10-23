"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { addInternalComment } from "@/app/(app)/posts/actions";
import { formatDateTime } from "@/lib/status";
import type { Comment, User } from "@/lib/types";

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

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
  const [sugestoes, setSugestoes] = useState<User[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const userMap = new Map(users.map((u) => [u.id, u]));

  function onChangeTexto(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const valor = e.target.value;
    setTexto(valor);

    const cursor = e.target.selectionStart ?? valor.length;
    const antesDoCursor = valor.slice(0, cursor);
    const match = antesDoCursor.match(/@(\w*)$/);
    if (match) {
      const termo = normalizar(match[1]);
      const filtrados = users.filter((u) => normalizar((u.nome || "").split(" ")[0] || "").startsWith(termo));
      setSugestoes(filtrados.slice(0, 5));
    } else {
      setSugestoes([]);
    }
  }

  function escolherSugestao(u: User) {
    const cursor = inputRef.current?.selectionStart ?? texto.length;
    const antesDoCursor = texto.slice(0, cursor);
    const depoisDoCursor = texto.slice(cursor);
    const primeiroNome = (u.nome || u.email).split(" ")[0];
    const novoAntes = antesDoCursor.replace(/@(\w*)$/, `@${primeiroNome} `);
    const novoTexto = novoAntes + depoisDoCursor;
    setTexto(novoTexto);
    setSugestoes([]);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

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

      <form onSubmit={enviar} className="relative flex gap-2">
        {sugestoes.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-56 overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black/10">
            {sugestoes.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => escolherSugestao(u)}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                {u.nome || u.email}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={texto}
          onChange={onChangeTexto}
          placeholder="Escreva um feedback interno... use @nome para mencionar"
          rows={2}
          className="flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
        />
        <button type="submit" disabled={pending}
          className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
          Enviar
        </button>
      </form>
    </div>
  );
}
