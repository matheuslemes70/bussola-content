"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBulkPosts } from "@/app/(app)/posts/actions";
import { FORMAT_LABELS, STATUS_LABELS, STATUS_FLOW } from "@/lib/status";
import type { User, PostFormat, PostStatus } from "@/lib/types";

type LinhaGerada = {
  key: string;
  titulo: string;
  briefing: string;
  caption: string;
  formato: PostFormat;
  status: PostStatus;
  data: string;
  horario: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function BulkPostGenerator({ clientId, users }: { clientId: string; users: User[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const hoje = new Date().toISOString().slice(0, 10);
  const [quantidadeDias, setQuantidadeDias] = useState(4);
  const [dataInicial, setDataInicial] = useState(hoje);
  const [intervalo, setIntervalo] = useState(7);
  const [executorId, setExecutorId] = useState("");
  const [postsPorDia, setPostsPorDia] = useState<1 | 2>(1);
  const [horario1, setHorario1] = useState("08:00");
  const [horario2, setHorario2] = useState("19:00");

  const [linhas, setLinhas] = useState<LinhaGerada[] | null>(null);

  function gerarLinhas() {
    setErro(null);
    if (!executorId) {
      setErro("Selecione o executor antes de gerar as linhas.");
      return;
    }
    const horariosBase = postsPorDia === 2 ? [horario1, horario2] : [horario1];
    const base = new Date(dataInicial + "T00:00:00");
    const novasLinhas: LinhaGerada[] = [];
    for (let i = 0; i < quantidadeDias; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i * intervalo);
      const dataStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      for (const h of horariosBase) {
        novasLinhas.push({
          key: `${dataStr}-${h}-${novasLinhas.length}`,
          titulo: "",
          briefing: "",
          caption: "",
          formato: "reels",
          status: "a_produzir",
          data: dataStr,
          horario: h,
        });
      }
    }
    setLinhas(novasLinhas);
  }

  function preencherTitulosAutomaticos() {
    if (!linhas) return;
    setLinhas(linhas.map((l, i) => ({ ...l, titulo: `Post ${i + 1}` })));
  }

  function atualizarLinha(key: string, campo: keyof LinhaGerada, valor: string) {
    if (!linhas) return;
    setLinhas(linhas.map((l) => (l.key === key ? { ...l, [campo]: valor } : l)));
  }

  function salvar() {
    if (!linhas) return;
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      const res = await createBulkPosts(
        clientId,
        executorId,
        linhas.map((l) => ({
          titulo: l.titulo,
          briefing: l.briefing,
          caption: l.caption,
          formato: l.formato,
          status: l.status,
          data: l.data,
          horario: l.horario,
        }))
      );
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setSucesso(`${res.count} post(s) criado(s) com sucesso!`);
      setLinhas(null);
      router.refresh();
    });
  }

  function fecharTudo() {
    setOpen(false);
    setLinhas(null);
    setErro(null);
    setSucesso(null);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-bussola-blue px-4 py-2 text-sm font-medium text-bussola-blue hover:bg-bussola-blue/10"
      >
        Gerar posts em lote
      </button>
    );
  }

  // ---------- Etapa 1: configuração ----------
  if (!linhas) {
    return (
      <div className="w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:w-auto">
        <p className="mb-2 text-sm font-semibold text-slate-700">Gerar posts em lote</p>
        <p className="mb-3 text-xs text-slate-500">
          Defina datas e horários. No próximo passo você preenche título, briefing, legenda, formato e status de cada post.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:min-w-[34rem]">
          <label className="text-xs text-slate-600">
            Quantidade de dias
            <input
              type="number"
              min={1}
              max={60}
              value={quantidadeDias}
              onChange={(e) => setQuantidadeDias(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-bussola-blue"
            />
          </label>
          <label className="text-xs text-slate-600">
            Data inicial
            <input
              type="date"
              value={dataInicial}
              onChange={(e) => setDataInicial(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-bussola-blue"
            />
          </label>
          <label className="text-xs text-slate-600">
            Intervalo (dias)
            <input
              type="number"
              min={1}
              value={intervalo}
              onChange={(e) => setIntervalo(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-bussola-blue"
            />
          </label>
          <label className="text-xs text-slate-600">
            Executor
            <select
              value={executorId}
              onChange={(e) => setExecutorId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-bussola-blue"
            >
              <option value="">Selecione o executor...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.nome || u.email}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-3 rounded-lg bg-slate-50 p-3">
          <label className="text-xs font-medium text-slate-600">Posts por dia</label>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="radio" checked={postsPorDia === 1} onChange={() => setPostsPorDia(1)} />
              1 post por dia
            </label>
            <label className="flex items-center gap-1 text-xs text-slate-600">
              <input type="radio" checked={postsPorDia === 2} onChange={() => setPostsPorDia(2)} />
              2 posts por dia (ex: manhã e noite)
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            <label className="text-xs text-slate-600">
              {postsPorDia === 2 ? "Horário 1 (manhã)" : "Horário"}
              <input
                type="time"
                value={horario1}
                onChange={(e) => setHorario1(e.target.value)}
                className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-bussola-blue"
              />
            </label>
            {postsPorDia === 2 && (
              <label className="text-xs text-slate-600">
                Horário 2 (noite)
                <input
                  type="time"
                  value={horario2}
                  onChange={(e) => setHorario2(e.target.value)}
                  className="mt-1 block rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-bussola-blue"
                />
              </label>
            )}
          </div>
        </div>

        {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        <div className="mt-3 flex gap-2">
          <button
            onClick={gerarLinhas}
            className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95"
          >
            Gerar linhas
          </button>
          <button onClick={fecharTudo} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:underline">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // ---------- Etapa 2: tabela editável ----------
  return (
    <div className="w-full rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">
          Preencha os {linhas.length} post(s) antes de salvar
        </p>
        <button
          onClick={preencherTitulosAutomaticos}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
        >
          Preencher títulos automáticos
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-2">Data</th>
              <th className="px-2 py-2">Título</th>
              <th className="px-2 py-2">Briefing</th>
              <th className="px-2 py-2">Legenda</th>
              <th className="px-2 py-2">Formato</th>
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {linhas.map((l) => (
              <tr key={l.key}>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-500">
                  {l.data.split("-").reverse().join("/")}
                  {l.horario ? ` ${l.horario}` : ""}
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={l.titulo}
                    onChange={(e) => atualizarLinha(l.key, "titulo", e.target.value)}
                    placeholder="Título"
                    className="w-40 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-bussola-blue"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <textarea
                    value={l.briefing}
                    onChange={(e) => atualizarLinha(l.key, "briefing", e.target.value)}
                    placeholder="Instrução interna"
                    rows={3}
                    className="w-48 resize-y rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-bussola-blue"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <textarea
                    value={l.caption}
                    onChange={(e) => atualizarLinha(l.key, "caption", e.target.value)}
                    placeholder="Texto final"
                    rows={3}
                    className="w-48 resize-y rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-bussola-blue"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={l.formato}
                    onChange={(e) => atualizarLinha(l.key, "formato", e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-bussola-blue"
                  >
                    {Object.entries(FORMAT_LABELS).map(([v, lbl]) => (
                      <option key={v} value={v}>{lbl}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <select
                    value={l.status}
                    onChange={(e) => atualizarLinha(l.key, "status", e.target.value)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-bussola-blue"
                  >
                    {STATUS_FLOW.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
      {sucesso && <p className="mt-2 text-sm text-emerald-600">{sucesso}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={salvar}
          disabled={pending}
          className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60"
        >
          {pending ? "Salvando..." : "Salvar posts"}
        </button>
        <button
          onClick={() => setLinhas(null)}
          className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:underline"
        >
          Voltar
        </button>
        <button onClick={fecharTudo} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}
