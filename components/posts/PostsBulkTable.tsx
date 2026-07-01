"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deletePostsBulk } from "@/app/(app)/posts/actions";
import { FORMAT_LABELS, formatDate } from "@/lib/status";
import { StatusBadge, AtrasadoBadge } from "@/components/ui/Badge";
import type { PostFormat, PostStatus } from "@/lib/types";

export type PostRow = {
  id: string;
  titulo: string;
  clientId: string | null;
  clientNome: string | null;
  formato: PostFormat;
  status: PostStatus;
  respNome: string | null;
  data: string | null;
  atrasado: boolean;
};

export function PostsBulkTable({
  rows,
  canDelete,
}: {
  rows: PostRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // ids selecionados que ainda existem na lista atual
  const selectedIds = rows.filter((r) => selected.has(r.id)).map((r) => r.id);
  const allChecked = rows.length > 0 && selectedIds.length === rows.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)));
  }

  function excluir() {
    setErro(null);
    startTransition(async () => {
      const res = await deletePostsBulk(selectedIds);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setSelected(new Set());
      setConfirming(false);
      router.refresh();
    });
  }

  const colCount = canDelete ? 7 : 6;

  return (
    <div className="space-y-3">
      {canDelete && selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-2">
          <span className="text-sm text-slate-700">
            {selectedIds.length} selecionado{selectedIds.length > 1 ? "s" : ""}
          </span>
          <button
            onClick={() => setConfirming(true)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Excluir selecionados
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              {canDelete && (
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Selecionar todos"
                    className="h-4 w-4 cursor-pointer accent-bussola-blue"
                  />
                </th>
              )}
              <th className="px-4 py-3">Título</th>
              <th className="hidden px-4 py-3 md:table-cell">Cliente</th>
              <th className="hidden px-4 py-3 lg:table-cell">Formato</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 lg:table-cell">Responsável</th>
              <th className="px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-8 text-center text-slate-400">
                  Nenhum post encontrado.
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const checked = selected.has(p.id);
              return (
                <tr
                  key={p.id}
                  className={
                    checked
                      ? "bg-blue-50"
                      : p.atrasado
                      ? "bg-red-50 hover:bg-red-100"
                      : "hover:bg-slate-50"
                  }
                >
                  {canDelete && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p.id)}
                        aria-label={`Selecionar ${p.titulo}`}
                        className="h-4 w-4 cursor-pointer accent-bussola-blue"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/posts/${p.id}`} className="text-slate-800 hover:text-bussola-blue hover:underline">
                      {p.titulo}
                    </Link>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                    {p.clientId ? (
                      <Link href={`/clientes/${p.clientId}`} className="hover:underline">{p.clientNome}</Link>
                    ) : "—"}
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{FORMAT_LABELS[p.formato]}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <StatusBadge status={p.status} />
                      {p.atrasado && <AtrasadoBadge />}
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-slate-600 lg:table-cell">{p.respNome || "—"}</td>
                  <td className={`px-4 py-3 ${p.atrasado ? "font-semibold text-red-600" : "text-slate-600"}`}>
                    {formatDate(p.data)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">Excluir posts</h2>
            <p className="mt-2 text-sm text-slate-600">
              Excluir <strong>{selectedIds.length}</strong> post{selectedIds.length > 1 ? "s" : ""}? Essa ação
              não pode ser desfeita.
            </p>
            {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                onClick={excluir}
                disabled={pending}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {pending ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
