"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCliente, updateCliente } from "@/app/(app)/clientes/actions";
import type { Client, User } from "@/lib/types";

export function ClientFormModal({
  users,
  cliente,
  triggerLabel,
  triggerClass,
}: {
  users: User[];
  cliente?: Client;
  triggerLabel: string;
  triggerClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const editing = Boolean(cliente);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = editing
        ? await updateCliente(cliente!.id, fd)
        : await createCliente(fd);
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
      <button
        onClick={() => setOpen(true)}
        className={triggerClass ?? "rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95"}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 sm:items-center sm:p-4">
          <div className="w-full overflow-y-auto bg-white p-5 shadow-xl sm:max-h-[90vh] sm:max-w-md sm:rounded-2xl sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">
              {editing ? "Editar cliente" : "Novo cliente"}
            </h2>
            <form onSubmit={onSubmit} className="space-y-3">
              <Field label="Nome">
                <input name="nome" required defaultValue={cliente?.nome}
                  className="input" />
              </Field>
              <Field label="Redes sociais gerenciadas (separadas por vírgula)">
                <input name="redes_sociais" placeholder="instagram, tiktok"
                  defaultValue={cliente?.redes_sociais?.join(", ")} className="input" />
              </Field>
              <Field label="Responsável interno">
                <select name="responsavel_id" defaultValue={cliente?.responsavel_id ?? ""}
                  className="input">
                  <option value="">— Nenhum —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.nome || u.email}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select name="status" defaultValue={cliente?.status ?? "ativo"} className="input">
                  <option value="ativo">Ativo</option>
                  <option value="pausado">Pausado</option>
                </select>
              </Field>

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
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid rgb(203 213 225);
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
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
