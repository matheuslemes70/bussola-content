"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adicionarRotina, removerRotina, gerarRotinaAgora } from "@/app/(app)/clientes/[clientId]/rotina-actions";
import { FORMAT_LABELS } from "@/lib/status";
import type { PostFormat, User } from "@/lib/types";

type Turno = "manha" | "tarde" | "noite";
type Item = {
  id: string;
  dia_semana: number;
  formato: PostFormat;
  executor_id: string;
  dias_antes: number;
  turno: Turno | null;
};

const DIAS_CURTO = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const TURNOS: Record<Turno, string> = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
const ORDEM_TURNO: Record<string, number> = { "": -1, manha: 0, tarde: 1, noite: 2 };
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// "Seg a Sex", "Seg, Qua e Sex", "Todos os dias"
function descreverDias(dias: number[]) {
  const d = [...dias].sort((a, b) => a - b);
  if (d.length === 7) return "Todos os dias";
  const seguidos = d.length >= 3 && d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  if (seguidos) return `${DIAS_CURTO[d[0]]} a ${DIAS_CURTO[d[d.length - 1]]}`;
  const nomes = d.map((x) => DIAS_CURTO[x]);
  return nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

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

  // Agrupa linhas iguais (mesmo formato, executor, turno e entrega) para
  // mostrar "Seg a Sex" numa linha só.
  const grupos = new Map<string, { chave: string; itens: Item[] }>();
  for (const i of itens) {
    const chave = `${i.formato}|${i.executor_id}|${i.turno ?? ""}|${i.dias_antes}`;
    if (!grupos.has(chave)) grupos.set(chave, { chave, itens: [] });
    grupos.get(chave)!.itens.push(i);
  }
  const linhas = Array.from(grupos.values()).sort((a, b) => {
    const ta = ORDEM_TURNO[a.itens[0].turno ?? ""] ?? -1;
    const tb = ORDEM_TURNO[b.itens[0].turno ?? ""] ?? -1;
    return Math.min(...a.itens.map((x) => x.dia_semana)) - Math.min(...b.itens.map((x) => x.dia_semana)) || ta - tb;
  });
  const postsPorSemana = itens.length;

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

  function onRemover(ids: string[]) {
    setErro(null);
    startTransition(async () => {
      const res = await removerRotina(clientId, ids);
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
          ? `${n} ${n === 1 ? "post criado" : "posts criados"} para a semana de ${ddmm(semana.inicio)}.`
          : `A semana de ${ddmm(semana.inicio)} já estava criada. Nada foi repetido.`
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
          Todo domingo à noite a plataforma lança os posts da semana que começa no dia seguinte, com título provisório. Quem executa já vê
          na Minha mesa, e você completa título e briefing depois.
        </p>
      </div>

      {linhas.length === 0 ? (
        <p className="rounded-2xl bg-sand px-4 py-5 text-sm text-stone-550">Este cliente ainda não tem rotina.</p>
      ) : (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-3xl bg-[#FBFAF7] p-2">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className="label-mono text-stone-550">
                  <th className="px-4 py-3 font-semibold">Dias</th>
                  <th className="px-4 py-3 font-semibold">Turno</th>
                  <th className="px-4 py-3 font-semibold">Formato</th>
                  <th className="px-4 py-3 font-semibold">Quem executa</th>
                  <th className="px-4 py-3 font-semibold">Entrega</th>
                  {podeEditar && <th className="px-4 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDE9E0]">
                {linhas.map(({ chave, itens: g }) => {
                  const base = g[0];
                  const u = userMap.get(base.executor_id);
                  return (
                    <tr key={chave}>
                      <td className="px-4 py-3 font-semibold">{descreverDias(g.map((x) => x.dia_semana))}</td>
                      <td className="px-4 py-3">{base.turno ? TURNOS[base.turno] : <span className="text-stone-450">—</span>}</td>
                      <td className="px-4 py-3">{FORMAT_LABELS[base.formato]}</td>
                      <td className="px-4 py-3">
                        {u ? (u.nome || u.email).split(" ")[0] : <span className="text-[#9A2A12]">Saiu da equipe</span>}
                      </td>
                      <td className="px-4 py-3 text-stone-550">
                        {base.dias_antes === 0 ? "No dia" : `${base.dias_antes} ${base.dias_antes === 1 ? "dia útil" : "dias úteis"} antes`}
                      </td>
                      {podeEditar && (
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => onRemover(g.map((x) => x.id))}
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
          <p className="px-1 text-[13px] text-stone-550">
            {postsPorSemana} {postsPorSemana === 1 ? "post" : "posts"} por semana.
          </p>
        </div>
      )}

      {podeEditar && (
        <form onSubmit={onAdicionar} className="space-y-4 rounded-3xl bg-sand p-4">
          <fieldset className="space-y-2">
            <legend className="label-mono pb-1 text-stone-550">Dias que publica</legend>
            <div className="flex flex-wrap gap-2">
              {DIAS_CURTO.slice(1).map((d, i) => (
                <label
                  key={d}
                  className="flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold has-[:checked]:bg-ink has-[:checked]:text-white"
                >
                  <input type="checkbox" name="dia_semana" value={i + 1} defaultChecked={i < 5} className="h-4 w-4 accent-bussola-yellow" />
                  {d}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end">
            <label className="space-y-1.5">
              <span className="label-mono block text-stone-550">Turno</span>
              <select name="turno" defaultValue="" className={campo}>
                <option value="">Sem turno (1 por dia)</option>
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
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
              <input name="dias_antes" type="number" min={0} max={10} defaultValue={0} className={campo} />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="h-11 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink-muted disabled:opacity-60"
            >
              Adicionar
            </button>
          </div>
          <p className="text-[12.5px] leading-relaxed text-stone-550">
            Dois posts por dia? Adicione duas vezes: uma com turno Manhã e outra com turno Noite. Entrega 0 = no próprio dia da publicação.
          </p>
        </form>
      )}

      {podeEditar && linhas.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-ink p-4 text-paper">
          <p className="min-w-0 flex-[1_1_260px] text-sm leading-relaxed text-[#E8E3D8]">
            Não quer esperar domingo? Lance agora os posts da semana de{" "}
            <strong className="text-white">{ddmm(semana.inicio)} a {ddmm(semana.fim)}</strong>. Se já tiverem sido lançados, nada se repete.
          </p>
          <button
            type="button"
            onClick={onGerar}
            disabled={pending}
            className="h-11 rounded-full bg-bussola-yellow px-5 text-sm font-bold text-ink transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? "Lançando…" : "Lançar semana agora"}
          </button>
        </div>
      )}

      {msg && <p className="text-sm font-semibold text-emerald-800">{msg}</p>}
      {erro && <p className="text-sm font-semibold text-[#9A2A12]">{erro}</p>}
    </div>
  );
}
