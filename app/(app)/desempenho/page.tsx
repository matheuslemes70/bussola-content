import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buscarTodas } from "@/lib/supabase/todas";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminPanels } from "@/lib/permissions";
import { isAtrasado, hojeBrasilia } from "@/lib/status";
import type { Client, Post, PostFormat, PostStatus, User } from "@/lib/types";

export const dynamic = "force-dynamic";

// Desempenho: substitui "Visão da equipe" e "Indicadores".
// Tudo que é medição vem do histórico de etapas (post_status_history), que a
// plataforma grava sozinha a cada troca de status. Nada depende de alguém
// preencher algo a mais.

const PRODUCAO: PostStatus[] = ["a_produzir", "em_producao", "pronto_pra_editar", "alterar"];
// Etapas que significam "o executor já entregou".
const ENTREGUE: PostStatus[] = ["revisao_interna", "para_aprovacao", "aprovado", "agendado", "publicado"];
// Respostas do cliente a um envio para aprovação.
const RESPOSTA: PostStatus[] = ["aprovado", "alterar", "agendado", "publicado"];
// Peso de cada formato na carga de trabalho (ajustável aqui).
const PESO: Record<PostFormat, number> = { reels: 3, carrossel: 2, estatico: 1, story: 1 };

type Evento = { post_id: string; status: PostStatus; created_at: string };

const diaBR = (ts: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ts));
function somarDias(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
const diasEntre = (a: string, b: string) =>
  Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const fmt1 = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export default async function DesempenhoPage() {
  const me = await getCurrentUser();
  if (!canViewAdminPanels(me?.perfil)) redirect("/");

  const hoje = hojeBrasilia();
  const ini30 = somarDias(hoje, -30);
  const ini90 = somarDias(hoje, -90);
  const ini180 = somarDias(hoje, -180);
  const inicioMes = hoje.slice(0, 8) + "01";

  const supabase = await createClient();
  const [posts, { data: clients }, { data: users }, hist] = await Promise.all([
    buscarTodas<Post>((de, ate) =>
      supabase
        .from("posts")
        .select("id, client_id, responsavel_id, formato, status, data_entrega, data_publicacao_planejada, arquivado")
        .order("id")
        .range(de, ate) as unknown as PromiseLike<{ data: Post[] | null; error: { message: string } | null }>
    ),
    supabase.from("clients").select("*").order("nome"),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
    buscarTodas<Evento>((de, ate) =>
      supabase
        .from("post_status_history")
        .select("post_id, status, created_at")
        .gte("created_at", ini180 + "T00:00:00-03:00")
        .order("created_at")
        .order("id")
        .range(de, ate) as unknown as PromiseLike<{ data: Evento[] | null; error: { message: string } | null }>
    ),
  ]);

  const todos = posts;
  const postMap = new Map(todos.map((p) => [p.id, p]));
  const allClients = (clients as Client[]) ?? [];
  const clientMap = new Map(allClients.map((c) => [c.id, c]));
  const equipe = (users as User[]) ?? [];
  const eventos = hist.map((e) => ({ ...e, dia: diaBR(e.created_at) }));

  // Eventos agrupados por post, em ordem
  const porPost = new Map<string, (Evento & { dia: string })[]>();
  for (const e of eventos) {
    if (!porPost.has(e.post_id)) porPost.set(e.post_id, []);
    porPost.get(e.post_id)!.push(e);
  }

  // ---------- 1. Entregas no prazo (últimos 30 dias) ----------
  // Primeira entrega de cada post: a primeira vez que saiu da produção.
  type Entrega = { post: Post; dia: string; noPrazo: boolean };
  const entregas30: Entrega[] = [];
  const entregues90 = new Set<string>();
  for (const [postId, evs] of Array.from(porPost.entries())) {
    const post = postMap.get(postId);
    const primeira = evs.find((e) => ENTREGUE.includes(e.status));
    if (!post || !primeira) continue;
    if (primeira.dia >= ini90) entregues90.add(postId);
    if (primeira.dia >= ini30 && post.data_entrega) {
      entregas30.push({ post, dia: primeira.dia, noPrazo: primeira.dia <= post.data_entrega });
    }
  }
  const noPrazoTotal = entregas30.filter((e) => e.noPrazo).length;

  // ---------- 2. Retrabalho por cliente (90 dias) ----------
  const ajustesPorCliente = new Map<string, number>();
  const entreguesPorCliente = new Map<string, number>();
  for (const e of eventos) {
    if (e.status !== "alterar" || e.dia < ini90) continue;
    const c = postMap.get(e.post_id)?.client_id;
    if (c) ajustesPorCliente.set(c, (ajustesPorCliente.get(c) ?? 0) + 1);
  }
  for (const id of Array.from(entregues90)) {
    const c = postMap.get(id)?.client_id;
    if (c) entreguesPorCliente.set(c, (entreguesPorCliente.get(c) ?? 0) + 1);
  }
  const totalAjustes90 = Array.from(ajustesPorCliente.values()).reduce((a, b) => a + b, 0);

  // ---------- 3. Tempo de resposta do cliente (90 dias) ----------
  const respostas = new Map<string, number[]>(); // client -> dias
  const esperando = new Map<string, number>();
  for (const [postId, evs] of Array.from(porPost.entries())) {
    const post = postMap.get(postId);
    if (!post) continue;
    evs.forEach((e, i) => {
      if (e.status !== "para_aprovacao" || e.dia < ini90) return;
      const resp = evs.slice(i + 1).find((x) => RESPOSTA.includes(x.status));
      if (resp) {
        if (!respostas.has(post.client_id)) respostas.set(post.client_id, []);
        respostas.get(post.client_id)!.push(Math.max(0, diasEntre(e.dia, resp.dia)));
      } else if (post.status === "para_aprovacao") {
        esperando.set(post.client_id, (esperando.get(post.client_id) ?? 0) + 1);
      }
    });
  }
  const todasRespostas = Array.from(respostas.values()).flat();
  const mediaResposta = todasRespostas.length ? todasRespostas.reduce((a, b) => a + b, 0) / todasRespostas.length : null;

  // ---------- 4. Publicados no mês (data real) ----------
  const publicadosMes = new Set(eventos.filter((e) => e.status === "publicado" && e.dia >= inicioMes).map((e) => e.post_id));
  const publicadosPorCliente = new Map<string, number>();
  for (const id of Array.from(publicadosMes)) {
    const c = postMap.get(id)?.client_id;
    if (c) publicadosPorCliente.set(c, (publicadosPorCliente.get(c) ?? 0) + 1);
  }

  // ---------- 5. Carga atual por pessoa ----------
  const emProducao = todos.filter((p) => !p.arquivado && PRODUCAO.includes(p.status) && clientMap.get(p.client_id)?.status === "ativo");
  const carga = equipe
    .map((u) => {
      const meus = emProducao.filter((p) => p.responsavel_id === u.id);
      const formatos = (["reels", "carrossel", "estatico", "story"] as PostFormat[])
        .map((f) => ({ f, n: meus.filter((p) => p.formato === f).length }))
        .filter((x) => x.n > 0);
      const pontos = meus.reduce((acc, p) => acc + (PESO[p.formato] ?? 1), 0);
      const atrasados = meus.filter(isAtrasado).length;
      const ent = entregas30.filter((e) => e.post.responsavel_id === u.id);
      return {
        user: u,
        posts: meus.length,
        formatos,
        pontos,
        atrasados,
        entregues30: ent.length,
        noPrazo30: ent.filter((e) => e.noPrazo).length,
      };
    })
    .filter((x) => x.posts > 0 || x.entregues30 > 0 || x.user.perfil === "editor" || x.user.perfil === "designer")
    .sort((a, b) => b.pontos - a.pontos);
  const maxPontos = Math.max(1, ...carga.map((c) => c.pontos));

  // ---------- Tabela por cliente ----------
  const ativos = allClients.filter((c) => c.status === "ativo");
  const linhasCliente = ativos
    .map((c) => {
      const entregues = entreguesPorCliente.get(c.id) ?? 0;
      const ajustes = ajustesPorCliente.get(c.id) ?? 0;
      const resp = respostas.get(c.id) ?? [];
      return {
        c,
        publicados: publicadosPorCliente.get(c.id) ?? 0,
        entregues,
        ajustes,
        ajustesPorPost: entregues > 0 ? ajustes / entregues : null,
        resposta: resp.length ? resp.reduce((a, b) => a + b, 0) / resp.length : null,
        esperando: esperando.get(c.id) ?? 0,
      };
    })
    .sort((a, b) => (b.ajustesPorPost ?? -1) - (a.ajustesPorPost ?? -1));

  const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());
  const taxa = pct(noPrazoTotal, entregas30.length);
  const ajustesMedio = entregues90.size ? totalAjustes90 / entregues90.size : null;

  const resumo = [
    { label: "Entregas no prazo", valor: taxa === null ? "—" : `${taxa}%`, nota: `${noPrazoTotal} de ${entregas30.length} nos últimos 30 dias`, destaque: true },
    { label: `Publicados em ${nomeMes}`, valor: String(publicadosMes.size), nota: "pela data em que foi marcado" },
    { label: "Ajustes por post", valor: ajustesMedio === null ? "—" : fmt1(ajustesMedio), nota: "idas e voltas, últimos 90 dias" },
    { label: "Resposta do cliente", valor: mediaResposta === null ? "—" : `${fmt1(mediaResposta)} d`, nota: "média até aprovar ou pedir ajuste" },
  ];

  return (
    <div className="space-y-8">
      <section className="max-w-3xl space-y-3 pt-4">
        <p className="label-mono text-stone-550">Estratégico</p>
        <h1 className="text-4xl font-bold leading-none tracking-[-0.04em] sm:text-[52px]">Desempenho</h1>
        <p className="text-[17px] leading-relaxed text-[#4A463F]">
          Como a operação está andando, medida pelo histórico real de cada post. {ativos.length} clientes ativos.
        </p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {resumo.map((r) => (
          <div key={r.label} className={`flex flex-col gap-2 rounded-[22px] p-5 ${r.destaque ? "bg-ink text-white" : "bg-sand"}`}>
            <span className={`label-mono ${r.destaque ? "text-[#9A9488]" : "text-stone-550"}`}>{r.label}</span>
            <span className="text-[44px] font-extrabold leading-none tracking-[-0.05em]">{r.valor}</span>
            <span className={`text-[12.5px] ${r.destaque ? "text-[#B9B3A6]" : "text-stone-550"}`}>{r.nota}</span>
          </div>
        ))}
      </section>

      {/* Equipe */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-3.5">
          <h2 className="text-2xl font-bold tracking-[-0.02em]">Equipe</h2>
          <span className="label-mono text-stone-550">Carga atual e pontualidade</span>
        </div>
        <div className="overflow-x-auto rounded-3xl bg-[#FBFAF7] p-2">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="label-mono text-stone-550">
                <th className="px-4 py-3 font-semibold">Pessoa</th>
                <th className="px-4 py-3 font-semibold">Carga agora</th>
                <th className="px-4 py-3 font-semibold">Em produção</th>
                <th className="px-4 py-3 text-center font-semibold">Atrasados</th>
                <th className="px-4 py-3 text-center font-semibold">No prazo (30 dias)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE9E0]">
              {carga.map((c) => {
                const t = pct(c.noPrazo30, c.entregues30);
                return (
                  <tr key={c.user.id}>
                    <td className="px-4 py-3">
                      <Link href={`/posts?resp=${c.user.id}`} className="font-semibold hover:underline">
                        {(c.user.nome || c.user.email).split(" ")[0]}
                      </Link>
                    </td>
                    <td className="w-[28%] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-2.5 flex-1 rounded-full bg-sand">
                          <div className="h-2.5 rounded-full bg-ink" style={{ width: `${(c.pontos / maxPontos) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right font-semibold tabular-nums">{c.pontos}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[13px] text-stone-550">
                      {c.posts === 0
                        ? "—"
                        : `${c.posts} · ${c.formatos.map((x) => `${x.n} ${x.f === "estatico" ? "estático" : x.f}`).join(", ")}`}
                    </td>
                    <td className={`px-4 py-3 text-center font-semibold ${c.atrasados ? "text-[#9A2A12]" : "text-stone-450"}`}>{c.atrasados}</td>
                    <td className="px-4 py-3 text-center">
                      {t === null ? (
                        <span className="text-stone-450">—</span>
                      ) : (
                        <span className={`font-semibold ${t >= 80 ? "text-emerald-800" : t >= 60 ? "text-[#5C4300]" : "text-[#9A2A12]"}`}>
                          {t}% <span className="font-normal text-stone-550">({c.noPrazo30}/{c.entregues30})</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-stone-550">
          Carga em pontos: Reels vale 3, carrossel 2, estático e story 1. &quot;No prazo&quot; compara o dia da primeira entrega com a data de entrega do post.
        </p>
      </section>

      {/* Clientes */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-3.5">
          <h2 className="text-2xl font-bold tracking-[-0.02em]">Clientes</h2>
          <span className="label-mono text-stone-550">Retrabalho e resposta · últimos 90 dias</span>
        </div>
        <div className="overflow-x-auto rounded-3xl bg-[#FBFAF7] p-2">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="label-mono text-stone-550">
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 text-center font-semibold">Publicados no mês</th>
                <th className="px-4 py-3 text-center font-semibold">Entregues</th>
                <th className="px-4 py-3 text-center font-semibold">Ajustes por post</th>
                <th className="px-4 py-3 text-center font-semibold">Resposta média</th>
                <th className="px-4 py-3 text-center font-semibold">Esperando agora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDE9E0]">
              {linhasCliente.map((l) => (
                <tr key={l.c.id}>
                  <td className="px-4 py-3">
                    <Link href={`/clientes/${l.c.id}`} className="font-semibold hover:underline">{l.c.nome}</Link>
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">{l.publicados}</td>
                  <td className="px-4 py-3 text-center tabular-nums">{l.entregues}</td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {l.ajustesPorPost === null ? (
                      <span className="text-stone-450">—</span>
                    ) : (
                      <span className={`font-semibold ${l.ajustesPorPost >= 1 ? "text-[#9A2A12]" : l.ajustesPorPost >= 0.5 ? "text-[#5C4300]" : ""}`}>
                        {fmt1(l.ajustesPorPost)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums">
                    {l.resposta === null ? <span className="text-stone-450">—</span> : `${fmt1(l.resposta)} d`}
                  </td>
                  <td className={`px-4 py-3 text-center tabular-nums ${l.esperando ? "font-semibold" : "text-stone-450"}`}>{l.esperando}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[12.5px] text-stone-550">
          Ordenado pelo retrabalho: quem mais pede ajuste fica no topo. Acima de 1,0 ajuste por post, o cliente consome mais horas do que o
          contrato costuma prever, vale olhar junto com o Financeiro.
        </p>
      </section>

      <p className="rounded-2xl bg-sand px-4 py-3 text-[13px] leading-relaxed text-[#4A463F]">
        As medições usam o histórico dos últimos 180 dias. A etapa &quot;Revisão interna&quot; existe desde 23/10/2026; antes disso, a entrega
        conta a partir de &quot;Com o cliente&quot;.
      </p>
    </div>
  );
}
