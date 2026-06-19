"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { STATUS_FLOW, STATUS_LABELS, FORMAT_LABELS } from "@/lib/status";
import type { Client, User } from "@/lib/types";

export function PostFilters({ clients, users }: { clients: Client[]; users: User[] }) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/posts?${next.toString()}`);
  }

  const sel = "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select value={params.get("client") ?? ""} onChange={(e) => setParam("client", e.target.value)} className={sel}>
        <option value="">Todos os clientes</option>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>

      <select value={params.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)} className={sel}>
        <option value="">Todos os status</option>
        {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>

      <select value={params.get("formato") ?? ""} onChange={(e) => setParam("formato", e.target.value)} className={sel}>
        <option value="">Todos os formatos</option>
        {Object.entries(FORMAT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>

      <select value={params.get("resp") ?? ""} onChange={(e) => setParam("resp", e.target.value)} className={sel}>
        <option value="">Todos os responsáveis</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.nome || u.email}</option>)}
      </select>

      <input type="date" value={params.get("de") ?? ""} onChange={(e) => setParam("de", e.target.value)} className={sel} title="De" />
      <input type="date" value={params.get("ate") ?? ""} onChange={(e) => setParam("ate", e.target.value)} className={sel} title="Até" />

      <label className="flex items-center gap-1 text-sm text-slate-600">
        <input type="checkbox" checked={params.get("atrasados") === "1"}
          onChange={(e) => setParam("atrasados", e.target.checked ? "1" : "")} />
        Só atrasados
      </label>

      {params.toString() && (
        <button onClick={() => router.push("/posts")} className="text-sm text-slate-500 hover:underline">
          Limpar filtros
        </button>
      )}
    </div>
  );
}
