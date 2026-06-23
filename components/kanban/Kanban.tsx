"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updatePostStatus } from "@/app/(app)/posts/actions";
import { STATUS_FLOW, KANBAN_COLUMN_ORDER, STATUS_LABELS, FORMAT_LABELS, isAtrasado, formatDate } from "@/lib/status";
import type { Post, PostStatus, User, Client } from "@/lib/types";

export function Kanban({
  posts,
  users,
  clients,
}: {
  posts: Post[];
  users: User[];
  clients?: Client[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<PostStatus | null>(null);
  // cópia local para mover o card na hora (otimista) enquanto o servidor confirma
  const [items, setItems] = useState<Post[]>(posts);
  const [prev, setPrev] = useState<Post[]>(posts);

  // ressincroniza quando os posts mudam (ex: após refresh do servidor)
  if (posts !== prev) {
    setPrev(posts);
    setItems(posts);
  }

  const userMap = new Map(users.map((u) => [u.id, u]));
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

  function move(post: Post, status: PostStatus) {
    if (status === post.status) return;
    setItems((cur) => cur.map((p) => (p.id === post.id ? { ...p, status } : p)));
    startTransition(async () => {
      await updatePostStatus(post.id, status);
      router.refresh();
    });
  }

  function onDrop(status: PostStatus) {
    setOverCol(null);
    const post = items.find((p) => p.id === dragId);
    setDragId(null);
    if (post) move(post, status);
  }

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 [-webkit-overflow-scrolling:touch]">
      {KANBAN_COLUMN_ORDER.map((status) => {
        const col = items.filter((p) => p.status === status);
        const isOver = overCol === status;
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              if (overCol !== status) setOverCol(status);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setOverCol(null);
            }}
            onDrop={() => onDrop(status)}
            className={`flex w-[80vw] max-w-[18rem] flex-shrink-0 snap-start flex-col rounded-xl p-2 transition sm:w-64 ${
              isOver ? "bg-bussola-yellow/20 ring-2 ring-bussola-yellow" : "bg-slate-100"
            }`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-slate-700">{STATUS_LABELS[status]}</span>
              <span className="rounded-full bg-white px-2 text-xs text-slate-500">{col.length}</span>
            </div>
            <div className="min-h-[40px] space-y-2">
              {col.map((p) => {
                const resp = p.responsavel_id ? userMap.get(p.responsavel_id) : null;
                const atrasado = isAtrasado(p);
                return (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={() => setDragId(p.id)}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverCol(null);
                    }}
                    className={`cursor-grab rounded-lg bg-white p-3 shadow-sm active:cursor-grabbing ${
                      atrasado ? "ring-1 ring-red-300" : ""
                    } ${dragId === p.id ? "opacity-50" : ""}`}
                  >
                    <Link href={`/posts/${p.id}`} className="block">
                      <p className="text-sm font-medium text-slate-800 hover:text-bussola-blue">{p.titulo}</p>
                    </Link>
                    {clients && (
                      <p className="mt-0.5 text-xs font-medium text-bussola-blue">
                        {clientMap.get(p.client_id)?.nome ?? "—"}
                      </p>
                    )}
                    <div className="mt-1 text-xs text-slate-500">{FORMAT_LABELS[p.formato]}</div>
                    {p.data_publicacao_planejada && (
                      <div
                        className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${
                          atrasado ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {atrasado && (
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                            <path
                              fillRule="evenodd"
                              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                        {formatDate(p.data_publicacao_planejada)}
                      </div>
                    )}
                    {resp && <p className="mt-1 text-xs text-slate-400">{resp.nome || resp.email}</p>}
                    <select
                      value={p.status}
                      disabled={pending}
                      onChange={(e) => move(p, e.target.value as PostStatus)}
                      className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1 py-1 text-xs text-slate-600"
                    >
                      {STATUS_FLOW.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
              {col.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-slate-400">
                  {isOver ? "Solte aqui" : "—"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
