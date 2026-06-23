"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAccess,
  updateAccess,
  deleteAccess,
} from "@/app/(app)/clientes/[clientId]/actions";
import type { ClientAccess } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-bussola-blue";

export function AccessesManager({
  clientId,
  accesses,
}: {
  clientId: string;
  accesses: ClientAccess[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [plataforma, setPlataforma] = useState("");
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await createAccess(clientId, plataforma, usuario, senha);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setPlataforma("");
      setUsuario("");
      setSenha("");
      router.refresh();
    });
  }

  return (
    <div className="mt-8 border-t border-slate-200 pt-6">
      <h3 className="text-sm font-semibold uppercase text-slate-500">Acessos</h3>
      <p className="mb-3 text-xs text-slate-400">
        Logins e senhas das plataformas do cliente. Visível apenas para admin e social media.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Plataforma</th>
              <th className="px-3 py-2">Usuário</th>
              <th className="px-3 py-2">Senha</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accesses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-400">
                  Nenhum acesso cadastrado.
                </td>
              </tr>
            )}
            {accesses.map((a) => (
              <AccessRow key={a.id} clientId={clientId} access={a} />
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={adicionar} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input value={plataforma} onChange={(e) => setPlataforma(e.target.value)}
          placeholder="Plataforma (ex: Instagram)" className={inputCls + " sm:flex-1"} />
        <input value={usuario} onChange={(e) => setUsuario(e.target.value)}
          placeholder="Usuário" className={inputCls + " sm:flex-1"} />
        <input value={senha} onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha" className={inputCls + " sm:flex-1"} />
        <button type="submit" disabled={pending}
          className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
          + Adicionar
        </button>
      </form>
      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
    </div>
  );
}

function CopyBtn({ value, label }: { value: string; label: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 1500);
      }}
      className="text-xs text-bussola-blue hover:underline"
    >
      {copiado ? "copiado!" : label}
    </button>
  );
}

function AccessRow({ clientId, access }: { clientId: string; access: ClientAccess }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [revelada, setRevelada] = useState(false);

  const [plataforma, setPlataforma] = useState(access.plataforma);
  const [usuario, setUsuario] = useState(access.usuario);
  const [senha, setSenha] = useState(access.senha);

  function salvar() {
    startTransition(async () => {
      const res = await updateAccess(clientId, access.id, plataforma, usuario, senha);
      if (!res?.error) {
        setEditing(false);
        router.refresh();
      }
    });
  }

  function cancelar() {
    setPlataforma(access.plataforma);
    setUsuario(access.usuario);
    setSenha(access.senha);
    setEditing(false);
  }

  function remover() {
    startTransition(async () => {
      await deleteAccess(clientId, access.id);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <tr className="bg-slate-50">
        <td className="px-3 py-2"><input value={plataforma} onChange={(e) => setPlataforma(e.target.value)} className={inputCls} /></td>
        <td className="px-3 py-2"><input value={usuario} onChange={(e) => setUsuario(e.target.value)} className={inputCls} /></td>
        <td className="px-3 py-2"><input value={senha} onChange={(e) => setSenha(e.target.value)} className={inputCls} /></td>
        <td className="px-3 py-2 text-right">
          <button onClick={salvar} disabled={pending}
            className="mr-2 text-xs font-medium text-bussola-blue hover:underline disabled:opacity-60">salvar</button>
          <button onClick={cancelar} className="text-xs text-slate-500 hover:underline">cancelar</button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2 font-medium text-slate-800">{access.plataforma}</td>
      <td className="px-3 py-2 text-slate-600">
        <div className="flex items-center gap-2">
          <span>{access.usuario || "—"}</span>
          <CopyBtn value={access.usuario} label="copiar" />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-700">
            {revelada ? access.senha || "—" : "••••••••"}
          </span>
          {access.senha && (
            <>
              <button type="button" onClick={() => setRevelada((v) => !v)}
                className="text-xs text-bussola-blue hover:underline">
                {revelada ? "ocultar" : "revelar"}
              </button>
              <CopyBtn value={access.senha} label="copiar" />
            </>
          )}
        </div>
      </td>
      <td className="px-3 py-2 text-right">
        <button onClick={() => setEditing(true)}
          className="mr-2 text-xs text-bussola-blue hover:underline">editar</button>
        <button onClick={remover} disabled={pending}
          className="text-xs text-red-500 hover:underline disabled:opacity-60">remover</button>
      </td>
    </tr>
  );
}
