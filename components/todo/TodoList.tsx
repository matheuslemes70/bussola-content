"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTodo, toggleTodo, deleteTodo } from "@/app/(app)/tarefas/actions";
import { formatDate } from "@/lib/status";

export type Todo = { id: string; texto: string; feita: boolean; data: string };

function Item({ t, destaque }: { t: Todo; destaque?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-start gap-3 rounded-lg bg-white px-3 py-2.5 shadow-sm">
      <input
        type="checkbox"
        checked={t.feita}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            await toggleTodo(t.id, e.target.checked);
            router.refresh();
          })
        }
        className="mt-1 h-4 w-4 cursor-pointer accent-emerald-600"
      />
      <div className="min-w-0 flex-1">
        <p className={`break-words text-sm ${t.feita ? "text-slate-400 line-through" : "text-slate-800"}`}>
          {t.texto}
        </p>
        {destaque && !t.feita && (
          <p className="text-xs font-medium text-red-600">de {formatDate(t.data)}</p>
        )}
      </div>
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await deleteTodo(t.id);
            router.refresh();
          })
        }
        className="text-xs text-slate-300 hover:text-red-500 disabled:opacity-60"
        aria-label="Remover tarefa"
      >
        remover
      </button>
    </li>
  );
}

export function TodoList({ todos, hoje }: { todos: Todo[]; hoje: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [texto, setTexto] = useState("");
  const [data, setData] = useState(hoje);
  const [erro, setErro] = useState<string | null>(null);

  const atrasadas = todos.filter((t) => !t.feita && t.data < hoje);
  const deHoje = todos.filter((t) => t.data === hoje);
  const proximas = todos.filter((t) => !t.feita && t.data > hoje);

  const feitasHoje = deHoje.filter((t) => t.feita).length;

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await addTodo(texto, data);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setTexto("");
      setData(hoje);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={adicionar} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="O que você precisa fazer?"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
        />
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60"
        >
          + Adicionar
        </button>
      </form>
      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {atrasadas.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-red-500">
            Pendentes de dias anteriores ({atrasadas.length})
          </h2>
          <ul className="space-y-2">
            {atrasadas.map((t) => <Item key={t.id} t={t} destaque />)}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">
          Hoje {deHoje.length > 0 && `(${feitasHoje}/${deHoje.length})`}
        </h2>
        {deHoje.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-400">
            Nenhuma tarefa para hoje ainda.
          </p>
        ) : (
          <ul className="space-y-2">
            {deHoje.map((t) => <Item key={t.id} t={t} />)}
          </ul>
        )}
      </section>

      {proximas.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Próximos dias</h2>
          <ul className="space-y-2">
            {proximas.map((t) => (
              <li key={t.id}>
                <p className="mb-0.5 text-xs text-slate-400">{formatDate(t.data)}</p>
                <ul><Item t={t} /></ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
