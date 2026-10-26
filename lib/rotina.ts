import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FORMAT_LABELS } from "./status";
import type { PostFormat } from "./types";

export type RotinaItem = {
  id: string;
  client_id: string;
  dia_semana: number; // 1 = segunda ... 7 = domingo
  formato: PostFormat;
  executor_id: string;
  dias_antes: number;
  ativo: boolean;
  turno: Turno | null;
};

export type Turno = "manha" | "tarde" | "noite";
export const TURNOS: Record<Turno, string> = { manha: "manhã", tarde: "tarde", noite: "noite" };
const ORDEM_TURNO: Record<string, number> = { manha: 0, tarde: 1, noite: 2 };

export const DIAS_SEMANA = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const DIAS_CURTO = ["", "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

// ---------- Datas (sempre como texto AAAA-MM-DD, sem fuso) ----------
function paraData(iso: string) {
  return new Date(iso + "T12:00:00Z");
}
function paraIso(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function somarDias(iso: string, n: number) {
  const d = paraData(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return paraIso(d);
}
// 1 = segunda ... 7 = domingo
export function diaDaSemana(iso: string) {
  const g = paraData(iso).getUTCDay(); // 0 = domingo
  return g === 0 ? 7 : g;
}
// Volta N dias úteis (pula sábado e domingo).
export function diasUteisAntes(iso: string, n: number) {
  let d = iso;
  let faltam = n;
  while (faltam > 0) {
    d = somarDias(d, -1);
    const s = diaDaSemana(d);
    if (s <= 5) faltam--;
  }
  // Se a própria publicação cai no fim de semana e n = 0, entrega na sexta.
  while (diaDaSemana(d) > 5) d = somarDias(d, -1);
  return d;
}

// A semana que a rotina cobre: a próxima segunda-feira (ou hoje, se hoje já
// for segunda). Rodando no domingo à noite, é a semana que começa no dia
// seguinte.
export function semanaAlvo(hojeIso: string) {
  let seg = hojeIso;
  while (diaDaSemana(seg) !== 1) seg = somarDias(seg, 1);
  return { inicio: seg, fim: somarDias(seg, 6) };
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Cria os posts da rotina para a semana alvo. Pode rodar mais de uma vez:
// a chave da rotina impede post repetido.
export async function gerarSemana(
  supabase: SupabaseClient,
  opcoes: { hoje: string; clientId?: string }
): Promise<{ criados: number; semana: { inicio: string; fim: string }; erro?: string }> {
  const semana = semanaAlvo(opcoes.hoje);

  let q = supabase
    .from("rotina_semanal")
    .select("*, clients!inner(id, nome, status, responsavel_id)")
    .eq("ativo", true)
    .eq("clients.status", "ativo");
  if (opcoes.clientId) q = q.eq("client_id", opcoes.clientId);
  const { data: itens, error } = await q;
  if (error) return { criados: 0, semana, erro: error.message };

  type Linha = RotinaItem & { clients: { id: string; nome: string; status: string; responsavel_id: string | null } };
  const linhas = (itens as Linha[]) ?? [];
  if (linhas.length === 0) return { criados: 0, semana };

  const ordenadas = [...linhas].sort(
    (a, b) => a.dia_semana - b.dia_semana || (ORDEM_TURNO[a.turno ?? ""] ?? -1) - (ORDEM_TURNO[b.turno ?? ""] ?? -1)
  );
  const novos = ordenadas.map((r) => {
    const publicacao = somarDias(semana.inicio, r.dia_semana - 1);
    // A entrega nunca cai antes da segunda da própria semana (senão o post
    // já nasceria atrasado).
    const entrega = diasUteisAntes(publicacao, r.dias_antes);
    const turno = r.turno ? ` ${TURNOS[r.turno]}` : "";
    return {
      client_id: r.client_id,
      titulo: `${FORMAT_LABELS[r.formato]} · ${DIAS_CURTO[r.dia_semana]} ${ddmm(publicacao)}${turno} · preencher`,
      ideia: "",
      briefing: "",
      caption: "",
      formato: r.formato,
      status: "a_produzir",
      responsavel_id: r.executor_id,
      dono_id: r.clients.responsavel_id,
      data_publicacao_planejada: publicacao,
      data_entrega: entrega < semana.inicio ? semana.inicio : entrega,
      rotina_chave: `${r.id}:${publicacao}`,
    };
  });

  const { data: criados, error: erroInsert } = await supabase
    .from("posts")
    .upsert(novos, { onConflict: "rotina_chave", ignoreDuplicates: true })
    .select("id, client_id, responsavel_id");
  if (erroInsert) return { criados: 0, semana, erro: erroInsert.message };

  // Um aviso por executor e por cliente.
  const lista = criados ?? [];
  const nomes = new Map(linhas.map((l) => [l.client_id, l.clients.nome]));
  const grupos = new Map<string, { executor: string; cliente: string; n: number }>();
  for (const p of lista) {
    const k = `${p.responsavel_id}:${p.client_id}`;
    const g = grupos.get(k) ?? { executor: p.responsavel_id, cliente: nomes.get(p.client_id) ?? "", n: 0 };
    g.n++;
    grupos.set(k, g);
  }
  const avisos = Array.from(grupos.values()).map((g) => ({
    user_id: g.executor,
    post_id: null,
    tipo: "geral",
    mensagem: `${g.n} ${g.n === 1 ? "post novo" : "posts novos"} de ${g.cliente} para a semana de ${ddmm(semana.inicio)}. Os títulos e briefings ainda vão ser preenchidos.`,
  }));
  if (avisos.length) await supabase.from("notifications").insert(avisos);

  return { criados: lista.length, semana };
}
