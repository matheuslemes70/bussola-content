"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from "@/app/actions/notifications";
import type { Notification } from "@/lib/types";

function formatRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [pending, startTransition] = useTransition();

  async function carregar() {
    const res = await getMyNotifications();
    setItems(res.notifications as Notification[]);
    setNaoLidas(res.naoLidas);
  }

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 30000);
    return () => clearInterval(interval);
  }, []);

  function abrirNotificacao(n: Notification) {
    if (!n.lida) {
      startTransition(async () => {
        await markNotificationRead(n.id);
        carregar();
      });
    }
    setOpen(false);
  }

  function marcarTodasLidas() {
    startTransition(async () => {
      await markAllNotificationsRead();
      carregar();
    });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg px-2 py-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        aria-label="Notificações"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M10 2a6 6 0 00-6 6v3.586l-1.707 1.707A1 1 0 003 15h14a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM8.5 17a1.5 1.5 0 003 0h-3z" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] max-h-96 overflow-y-auto rounded-lg bg-white shadow-xl ring-1 ring-black/10">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
              <p className="text-sm font-semibold text-slate-700">Notificações</p>
              {naoLidas > 0 && (
                <button
                  onClick={marcarTodasLidas}
                  disabled={pending}
                  className="text-xs text-bussola-blue hover:underline disabled:opacity-60"
                >
                  Marcar todas como lidas
                </button>
              )}
            </div>
            {items.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">Nenhuma notificação ainda.</p>
            )}
            <div className="divide-y divide-slate-100">
              {items.map((n) => {
                const conteudo = (
                  <div
                    className={`px-3 py-2.5 text-sm ${n.lida ? "text-slate-500" : "bg-blue-50/60 text-slate-800"}`}
                  >
                    <p className="whitespace-pre-wrap">{n.mensagem}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatRelativo(n.created_at)}</p>
                  </div>
                );
                return n.post_id ? (
                  <Link key={n.id} href={`/posts/${n.post_id}`} onClick={() => abrirNotificacao(n)} className="block hover:bg-slate-50">
                    {conteudo}
                  </Link>
                ) : (
                  <div key={n.id} onClick={() => abrirNotificacao(n)} className="cursor-pointer hover:bg-slate-50">
                    {conteudo}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
