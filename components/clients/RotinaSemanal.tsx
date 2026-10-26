"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarRotina, removerRotina, gerarRotinaAgora } from "@/app/(app)/clientes/[clientId]/rotina-actions";
import { FORMAT_LABELS } from "@/lib/status";
import type { PostFormat, User } from "@/lib/types";

type Item = { id: string; dia_semana: number; formato: PostFormat; executor_id: string; dias_antes: number };

const DIAS = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function RotinaSemanal({
  clientId,
  itens,
  users,
  podeEditar,
  semana,
}: {
  clientId: string;
  itens: Item[];
  users: User[];
  podeEditar: boolean;
  semana: { inicio: string; fim: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const executores = users.filter((u) => u.ativo);
  const ordenados = [...itens].sort((a, b) => a.dia_semana - b.dia_semana);

  function onAdicionar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startTransition(async () => {
      const res = await adicionarRotina(clientId, fd);
      if (res && "error" in res && res.error) return setErro(res.error);
      form.reset();
      router.refresh();
    });
  }

  function onRemover(id: string) {
    setErro(null);
    startTransition(async () => {
      const res = await removerRotina(clientId, id);
      if (res && "error" in res && res.error) return setErro(res.error);
      router.refresh();
    });
  }

  function onGerar() {
    setErro(null);
    setMsg(null);
    startTransition(async () => {
      const res = await gerarRotinaAgora(clientId);
      if (res && "error" in res && res.error) return setErro(res.error);
      const n = res && "criados" in res ? res.criados ?? 0 : 0;
      setMsg(
        n > 0
          ? `${n} ${n === 1 ? "post criado" : "posts criados"} para a semana de ${ddmm(semana.inicio)} a ${ddmm(semana.fim)}.`
          : `A semana de ${ddmm(semana.inicio)} a ${ddmm(semana.fim)} já estava criada.`
      );
      router.refresh();
    });
  }

  const campo = "h-11 w-full rounded-xl border border-sand-line bg-white px-3 text-sm outline-none focus:border-ink";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-xl font-bold tracking-[-0.01em]">Rotina semanal</h2>
        <p className="max-w-2xl text-sm leading-relaxed text-stone-550">
          Todo domingo à noite a plataforma cria sozinha os posts abaixo para a semana seguinte, com título provisório. Quem executa já vê
          na Minha mesa, e você completa título e briefing depois.
        </p>
      </div>

      {ordenados.length === 0 ? (
        <p className="rounded-2xl bg-sand px-4 py-5 text-sm text-stone-550">Este cliente ainda não tem rotina.</p>
      ) : (
        <div className="overflow-x-auto rounded-3xl bg-[#FBFAF7] p-2">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead>
              <tr className="label-mono text-stone-550">
                <th className="px-4 py-3 font-semibold">Publica</th>
                <th className="px-4 py-3 font-semibold">Formato</th>
                <th className="px-4 py-3 font-semibold">Quem executa</th>
                <th className="px-4 py-3 font-semibold">Entrega</th>
                {podeEditar && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE9E0]">
              {ordenados.map((i) => {
                const u = userMap.get(i.executor_id);
                return (
                  <tr key={i.id}>
                    <td className="px-4 py-3 font-semibold">{DIAS[i.dia_semana]}</td>
                    <td className="px-4 py-3">{FORMAT_LABELS[i.formato]}</td>
                    <td className="px-4 py-3">{u ? (u.nome || u.email).split(" ")[0] : <span className="text-[#9A2A12]">Saiu da equipe</span>}</td>
                    <td className="px-4 py-3 text-stone-550">
                      {i.dias_antes === 0 ? "No dia" : `${i.dias_antes} ${i.dias_antes === 1 ? "dia útil" : "dias úteis"} antes`}
                    </td>
                    {podeEditar && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onRemover(i.id)}
                          disabled={pending}
                          className="text-[13px] font-semibold text-stone-550 underline-offset-4 hover:text-[#9A2A12] hover:underline"
                        >
                          Remover
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {podeEditar && (
        <form onSubmit={onAdicionar} className="grid gap-3 rounded-3xl bg-sand p-4 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
          <label className="space-y-1.5">
            <span className="label-mono block text-stone-550">Publica</span>
            <select name="dia_semana" defaultValue="1" className={campo}>
              {DIAS.slice(1).map((d, i) => (
                <option key={d} value={i + 1}>{d}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="label-mono block text-stone-550">Formato</span>
            <select name="formato" defaultValue="reels" className={campo}>
              {(Object.keys(FORMAT_LABELS) as PostFormat[]).map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="label-mono block text-stone-550">Quem executa</span>
            <select name="executor_id" required defaultValue="" className={campo}>
              <option value="" disabled>Escolher…</option>
              {executores.map((u) => (
                <option key={u.id} value={u.id}>{u.nome || u.email}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="label-mono block text-stone-550">Entrega (dias úteis antes)</span>
            <input name="dias_antes" type="number" min={0} max={10} defaultValue={2} className={campo} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink-muted disabled:opacity-60"
          >
            Adicionar
          </button>
        </form>
      )}

      {podeEditar && ordenados.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-ink p-4 text-paper">
          <p className="min-w-0 flex-[1_1_260px] text-sm leading-relaxed text-[#E8E3D8]">
            Não quer esperar domingo? Crie agora os posts da semana de{" "}
            <strong className="text-white">{ddmm(semana.inicio)} a {ddmm(semana.fim)}</strong>. Se já tiverem sido criados, nada se repete.
          </p>
          <button
            type="button"
            onClick={onGerar}
            disabled={pending}
            className="h-11 rounded-full bg-bussola-yellow px-5 text-sm font-bold text-ink transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? "Criando…" : "Gerar semana agora"}
          </button>
        </div>
      )}

      {msg && <p className="text-sm font-semibold text-emerald-800">{msg}</p>}
      {erro && <p className="text-sm font-semibold text-[#9A2A12]">{erro}</p>}
    </div>
  );
}
