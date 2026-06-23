"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPost, updatePost } from "@/app/(app)/posts/actions";
import { FORMAT_LABELS, STATUS_LABELS, STATUS_FLOW } from "@/lib/status";
import type { Client, Post, User } from "@/lib/types";

export function PostFormModal({
  users,
  clients,
  fixedClientId,
  post,
  triggerLabel,
  triggerClass,
  defaultDate,
  open: openProp,
  onOpenChange,
}: {
  users: User[];
  clients?: Client[];
  fixedClientId?: string;
  post?: Post;
  triggerLabel?: string;
  triggerClass?: string;
  defaultDate?: string;
  // Modo controlado (ex: abrir ao clicar num dia do calendário)
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const controlled = onOpenChange !== undefined;
  const open = controlled ? !!openProp : openState;
  const setOpen = (v: boolean) => (controlled ? onOpenChange!(v) : setOpenState(v));
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(post);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    if (fixedClientId) fd.set("client_id", fixedClientId);
    startTransition(async () => {
      const res = editing ? await updatePost(post!.id, fd) : await createPost(fd);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      {triggerLabel && (
        <button
          onClick={() => setOpen(true)}
          className={triggerClass ?? "rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95"}
        >
          {triggerLabel}
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="w-full overflow-y-auto bg-white p-5 shadow-xl sm:max-h-[90vh] sm:max-w-lg sm:rounded-2xl sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              {editing ? "Editar post" : "Novo post"}
            </h2>
            <form onSubmit={onSubmit} className="space-y-3">
              {!fixedClientId && (
                <Field label="Cliente">
                  <select name="client_id" required defaultValue={post?.client_id ?? ""} className="pinput">
                    <option value="">— Selecione —</option>
                    {(clients ?? []).map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Título">
                <input name="titulo" required defaultValue={post?.titulo} className="pinput" />
              </Field>
              <Field label="Briefing (instrução interna para a equipe)">
                <textarea name="briefing" rows={3} defaultValue={post?.briefing} className="pinput" />
              </Field>
              <Field label="Legenda (texto final da publicação — visível na aprovação do cliente)">
                <textarea name="caption" rows={3} defaultValue={post?.caption} className="pinput" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Formato">
                  <select name="formato" defaultValue={post?.formato ?? "estatico"} className="pinput">
                    {Object.entries(FORMAT_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue={post?.status ?? "a_produzir"} className="pinput">
                    {STATUS_FLOW.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Link de referência (interno, só a equipe vê)">
                <input name="reference_link" defaultValue={post?.reference_link ?? ""} className="pinput" />
              </Field>
              <Field label="Link do conteúdo entregue (aparece na aprovação do cliente)">
                <input name="delivered_link" defaultValue={post?.delivered_link ?? ""} className="pinput" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Data de publicação">
                  <input type="date" name="data_publicacao_planejada"
                    defaultValue={post?.data_publicacao_planejada ?? defaultDate ?? ""} className="pinput" />
                </Field>
                <Field label="Responsável">
                  <select name="responsavel_id" defaultValue={post?.responsavel_id ?? ""} className="pinput">
                    <option value="">— Nenhum —</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.nome || u.email}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
                  Cancelar
                </button>
                <button type="submit" disabled={pending}
                  className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
                  {pending ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .pinput {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(203 213 225);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .pinput:focus {
          border-color: #0a48c4;
          box-shadow: 0 0 0 1px #0a48c4;
        }
      `}</style>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  );
}
