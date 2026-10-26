import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canCreatePosts } from "@/lib/permissions";
import { FORMAT_LABELS, STATUS_LABELS, isAtrasado, hojeBrasilia } from "@/lib/status";
import { AcoesMesa } from "@/components/mesa/AcoesMesa";
import type { Client, Comment, Post, PostStatus, User } from "@/lib/types";

export const dynamic = "force-dynamic";

// Minha mesa: a tela inicial de cada pessoa, montada pelo que está com ela.
// - Como executor: atrasados, ajustes pedidos, pra hoje, próximos 7 dias.
// - Como dona de demanda / responsável pelo cliente (gestão): pra revisar,
//   pra publicar, com o cliente e meus clientes.
// Um bloco só aparece quando tem alguma coisa nele.

const PRODUCAO: PostStatus[] = ["a_produzir", "em_producao", "pronto_pra_editar", "alterar"];
const DIA_MS = 24 * 60 * 60 * 1000;

function somarDias(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function diasEntre(deIso: string, ateIso: string) {
  return Math.round(
    (new Date(ateIso.slice(0, 10) + "T00:00:00").getTime() - new Date(deIso.slice(0, 10) + "T00:00:00").getTime()) / DIA_MS
  );
}
const ddmm = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "sem data");
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

export default async function MinhaMesaPage() {
  const supabase = await createClient();
  const me = await getCurrentUser();
  if (!me) return null;

  const [{ data: posts }, { data: clients }, { data: users }] = await Promise.all([
    supabase.from("posts").select("*").eq("arquivado", false).neq("status", "publicado"),
    supabase.from("clients").select("*").order("nome"),
    supabase.from("users").select("*").eq("ativo", true),
  ]);

  const ativos = ((clients as Client[]) ?? []).filter((c) => c.status === "ativo");
  const clientMap = new Map(ativos.map((c) => [c.id, c]));
  const userMap = new Map(((users as User[]) ?? []).map((u) => [u.id, u]));
  const todos = ((posts as Post[]) ?? []).filter((p) => clientMap.has(p.client_id));
  const hoje = hojeBrasilia();
  const daquiSete = somarDias(hoje, 7);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";

  // ---------- Como executor ----------
  const meusExec = todos.filter((p) => p.responsavel_id === me.id && PRODUCAO.includes(p.status));
  const atrasados = meusExec.filter(isAtrasado).sort((a, b) => (a.data_entrega ?? "").localeCompare(b.data_entrega ?? ""));
  const idsAtrasados = new Set(atrasados.map((p) => p.id));
  const ajustes = meusExec.filter((p) => p.status === "alterar" && !idsAtrasados.has(p.id));
  const praHoje = meusExec
    .filter((p) => !idsAtrasados.has(p.id) && p.status !== "alterar" && p.data_entrega === hoje)
    .sort((a, b) => (a.horario_publicacao_planejada ?? "23:59").localeCompare(b.horario_publicacao_planejada ?? "23:59"));
  const semana = meusExec
    .filter((p) => p.status !== "alterar" && p.data_entrega && p.data_entrega > hoje && p.data_entrega <= daquiSete)
    .sort((a, b) => (a.data_entrega ?? "").localeCompare(b.data_entrega ?? ""));
  const semData = meusExec.filter((p) => !p.data_entrega && p.status !== "alterar").length;

  // ---------- Como gestão do conteúdo ----------
  const gestao = canCreatePosts(me.perfil);
  const meusClientes = gestao ? ativos.filter((c) => c.responsavel_id === me.id) : [];
  const idsMeusClientes = new Set(meusClientes.map((c) => c.id));
  const escopo = (p: Post) => gestao && (p.dono_id === me.id || idsMeusClientes.has(p.client_id));

  const revisar = todos.filter((p) => escopo(p) && p.status === "revisao_interna")
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
  const publicar = todos.filter((p) => escopo(p) && p.status === "aprovado")
    .sort((a, b) => (a.data_publicacao_planejada ?? "9999").localeCompare(b.data_publicacao_planejada ?? "9999"));
  const agendados = todos.filter((p) => escopo(p) && p.status === "agendado").length;
  const vencidos = publicar.filter((p) => p.data_publicacao_planejada && p.data_publicacao_planejada < hoje).length;
  const comCliente = todos.filter((p) => escopo(p) && p.status === "para_aprovacao");
  // Publicação em risco: publica de 3 dias atrás até amanhã e ainda não foi
  // aprovado pelo cliente. O que publica hoje e ainda está em edição aparece aqui.
  const ANTES_DE_APROVAR: PostStatus[] = [...PRODUCAO, "revisao_interna", "para_aprovacao"];
  const amanha = somarDias(hoje, 1);
  const tresDiasAtras = somarDias(hoje, -3);
  const emRisco = todos
    .filter((p) => {
      const d = p.data_publicacao_planejada?.slice(0, 10);
      return escopo(p) && !!d && d >= tresDiasAtras && d <= amanha && ANTES_DE_APROVAR.includes(p.status);
    })
    .sort((a, b) => (a.data_publicacao_planejada ?? "").localeCompare(b.data_publicacao_planejada ?? ""));
  const riscoHoje = emRisco.filter((p) => (p.data_publicacao_planejada ?? "").slice(0, 10) <= hoje).length;
  // Atrasados com a equipe: posts dos meus clientes/demandas que já passaram
  // da data de ENTREGA e ainda estão em produção com outra pessoa. É o que a
  // social media precisa cobrar logo cedo.
  const idsRisco = new Set(emRisco.map((p) => p.id));
  const atrasadosEquipe = todos
    .filter(
      (p) =>
        escopo(p) &&
        PRODUCAO.includes(p.status) &&
        p.responsavel_id !== me.id &&
        !!p.data_entrega &&
        p.data_entrega < hoje &&
        !idsRisco.has(p.id)
    )
    .sort((a, b) => (a.data_entrega ?? "").localeCompare(b.data_entrega ?? ""));
  // Posts criados pela rotina semanal que ainda não têm briefing.
  const preencher = todos
    .filter((p) => escopo(p) && !!p.rotina_chave && !(p.briefing ?? "").trim() && PRODUCAO.includes(p.status))
    .sort((a, b) => (a.data_entrega ?? "").localeCompare(b.data_entrega ?? ""));
  const emAjusteDeOutros = todos.filter((p) => escopo(p) && p.status === "alterar" && p.responsavel_id !== me.id).length;

  // Último pedido de ajuste de cada post que voltou pra mim
  const voltaram = [...atrasados, ...ajustes].filter((p) => p.status === "alterar").map((p) => p.id);
  const pedidos = new Map<string, { quem: string; texto: string }>();
  if (voltaram.length > 0) {
    const { data: coms } = await supabase
      .from("comments")
      .select("*")
      .in("post_id", voltaram)
      .order("created_at", { ascending: false });
    for (const c of (coms as Comment[]) ?? []) {
      if (pedidos.has(c.post_id)) continue;
      const autor = c.tipo === "cliente"
        ? c.author_name || "Cliente"
        : (c.author_id ? userMap.get(c.author_id)?.nome?.split(" ")[0] : null) || "Equipe";
      pedidos.set(c.post_id, { quem: autor, texto: c.texto.replace(/^Ajuste pedido:\s*/, "") });
    }
  }

  // Há quantos dias cada post está com o cliente
  const desde = new Map<string, string>();
  if (comCliente.length > 0) {
    const { data: hist } = await supabase
      .from("post_status_history")
      .select("post_id, created_at")
      .in("post_id", comCliente.map((p) => p.id))
      .eq("status", "para_aprovacao")
      .order("created_at", { ascending: false });
    for (const h of hist ?? []) if (!desde.has(h.post_id)) desde.set(h.post_id, h.created_at);
  }
  const comClienteOrdenado = comCliente
    .map((p) => ({ post: p, dias: diasEntre((desde.get(p.id) ?? p.updated_at).slice(0, 10), hoje) }))
    .sort((a, b) => b.dias - a.dias);

  // Meus clientes
  const resumoClientes = meusClientes.map((c) => {
    const cp = todos.filter((p) => p.client_id === c.id);
    const prod = cp.filter((p) => PRODUCAO.includes(p.status)).length;
    const rev = cp.filter((p) => p.status === "revisao_interna").length;
    const cli = cp.filter((p) => p.status === "para_aprovacao").length;
    const alerta = cp.some(
      (p) => isAtrasado(p) || (p.status === "aprovado" && !!p.data_publicacao_planejada && p.data_publicacao_planejada < hoje)
    );
    const partes = [
      prod ? `${prod} em produção` : null,
      rev ? `${rev} pra revisar` : null,
      cli ? `${cli} com o cliente` : null,
    ].filter(Boolean);
    return { client: c, resumo: partes.length ? partes.join(" · ") : "Nada pendente", alerta };
  });

  // ---------- Topo ----------
  const tiles = [
    // Cor = urgência: vermelho (urgente), preto (cobrar alguém),
    // amarelo (sua vez), areia (acompanhar).
    { id: "atrasados", label: "Atrasados", n: atrasados.length, cor: "red" },
    { id: "risco", label: "Publicação em risco", n: emRisco.length, cor: "red" },
    { id: "equipe-atrasada", label: "Atrasados com a equipe", n: atrasadosEquipe.length, cor: "ink" },
    { id: "revisar", label: "Pra revisar", n: revisar.length, cor: "yellow" },
    { id: "preencher", label: "Pra preencher", n: preencher.length, cor: "yellow" },
    { id: "ajustes", label: "Ajustes pedidos", n: ajustes.length + atrasados.filter((p) => p.status === "alterar").length, cor: "yellow" },
    { id: "publicar", label: "Pra publicar", n: publicar.length, cor: "yellow" },
    { id: "hoje", label: "Pra hoje", n: praHoje.length, cor: "sand" },
    { id: "cliente", label: "Com o cliente", n: comCliente.length, cor: "sand" },
    { id: "semana", label: "Próximos 7 dias", n: semana.length, cor: "sand" },
  ].filter((t) => t.n > 0).slice(0, 4);

  const frases: string[] = [];
  if (emRisco.length)
    frases.push(
      riscoHoje
        ? `${plural(riscoHoje, "post que publica hoje e ainda não está pronto", "posts que publicam hoje e ainda não estão prontos")}`
        : `${plural(emRisco.length, "post que publica amanhã e ainda não está pronto", "posts que publicam amanhã e ainda não estão prontos")}`
    );
  if (atrasadosEquipe.length)
    frases.push(`${plural(atrasadosEquipe.length, "post atrasado com a equipe", "posts atrasados com a equipe")}`);
  if (preencher.length)
    frases.push(`${plural(preencher.length, "post da rotina pra preencher", "posts da rotina pra preencher")}`);
  if (praHoje.length) frases.push(`${plural(praHoje.length, "entrega", "entregas")} pra hoje`);
  if (revisar.length) frases.push(`${plural(revisar.length, "post", "posts")} pra revisar`);
  const nAjustes = ajustes.length + atrasados.filter((p) => p.status === "alterar").length;
  if (nAjustes) frases.push(`${plural(nAjustes, "ajuste pedido", "ajustes pedidos")}`);
  if (vencidos) frases.push(`${plural(vencidos, "aprovado", "aprovados")} com a publicação vencida`);
  const juntar = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs[xs.length - 1]}`);
  const mensagem = frases.length
    ? `Você tem ${juntar(frases)}.${atrasados.length ? " Comece pelos atrasados." : ""}`
    : atrasados.length
    ? "Comece pelos atrasados."
    : "Nada pendente com você agora. Bom trabalho!";

  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = (me.nome || "").split(" ")[0];
  const dataHoje = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" }).format(new Date());

  const temColunaLateral = semana.length > 0 || semData > 0 || resumoClientes.length > 0;
  const nada = tiles.length === 0 && comCliente.length === 0 && resumoClientes.length === 0;

  // Linha de post como executor
  function LinhaExecutor({ p, acao }: { p: Post; acao: string }) {
    const atrasado = idsAtrasados.has(p.id);
    const pedido = pedidos.get(p.id);
    const dias = atrasado && p.data_entrega ? diasEntre(p.data_entrega, hoje) : 0;
    const ehHoje = p.data_entrega === hoje;
    const tag =
      p.status === "alterar"
        ? { t: "Ajuste pedido", c: "bg-[#FCEBB6] text-[#5C4300]" }
        : { t: STATUS_LABELS[p.status], c: "bg-[#ECE7DC] text-[#4A463F]" };
    return (
      <article className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[20px] bg-[#FBFAF7] px-[18px] py-4">
        <div className="min-w-0 flex-[1_1_260px] space-y-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="label-mono text-[9.5px] text-stone-550">{FORMAT_LABELS[p.formato]}</span>
            <span className={`label-mono rounded-full px-2 py-[3px] text-[9.5px] ${atrasado && p.status === "alterar" ? "bg-[#F6DDD3] text-[#8F2410]" : tag.c}`}>{tag.t}</span>
          </div>
          <p className="text-base font-semibold">{p.titulo}</p>
          <p className="text-[13px] text-stone-550">{clientMap.get(p.client_id)?.nome}</p>
          {pedido && (
            <p className="mt-2 rounded-xl bg-paper px-3 py-2.5 text-[13.5px] leading-relaxed text-[#4A463F]">
              <strong className="text-ink">{pedido.quem}:</strong> {pedido.texto.length > 220 ? pedido.texto.slice(0, 220) + "…" : pedido.texto}
            </p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className={`text-[13px] font-semibold ${atrasado ? "text-[#9A2A12]" : "text-[#4A463F]"}`}>
            {atrasado
              ? `Entrega ${ddmm(p.data_entrega)} · ${plural(dias, "dia", "dias")}`
              : ehHoje
              ? `Hoje${p.horario_publicacao_planejada ? ` · ${p.horario_publicacao_planejada.slice(0, 5)}` : ""}`
              : `Entrega ${ddmm(p.data_entrega)}`}
          </span>
          <Link
            href={`/posts/${p.id}`}
            className="flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[13.5px] font-semibold text-white transition hover:bg-ink-muted"
          >
            {acao}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
        </div>
      </article>
    );
  }

  function Secao({ id, titulo, sub, subCor, children }: { id: string; titulo: string; sub: string; subCor?: string; children: React.ReactNode }) {
    return (
      <section id={id} className="scroll-mt-24 space-y-2.5">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-xl font-bold tracking-[-0.01em]">{titulo}</h2>
          <span className={`label-mono ${subCor ?? "text-stone-550"}`}>{sub}</span>
        </div>
        {children}
      </section>
    );
  }

  const corTile: Record<string, string> = {
    red: "bg-[#B42318] text-white",
    ink: "bg-ink text-white",
    yellow: "bg-bussola-yellow text-ink",
    sand: "bg-sand text-ink",
  };
  const corTileLabel: Record<string, string> = {
    red: "text-[#FBD5CE]",
    ink: "text-[#9A9488]",
    yellow: "text-[#3D2E05]",
    sand: "text-stone-550",
  };

  return (
    <div className="space-y-7">
      <section className="max-w-3xl space-y-3 pt-4">
        <p className="label-mono text-stone-550">{dataHoje}</p>
        <h1 className="text-4xl font-bold leading-none tracking-[-0.04em] sm:text-[52px]">
          {saudacao}
          {primeiroNome ? `, ${primeiroNome}` : ""}
        </h1>
        <p className="text-[17px] leading-relaxed text-[#4A463F]">{mensagem}</p>
      </section>

      {tiles.length > 0 && (
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {tiles.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={`flex flex-col gap-2 rounded-[22px] p-5 transition hover:brightness-[0.97] ${corTile[t.cor]}`}>
              <span className={`label-mono ${corTileLabel[t.cor]}`}>{t.label}</span>
              <span className="text-5xl font-extrabold leading-none tracking-[-0.05em]">{t.n}</span>
            </a>
          ))}
        </section>
      )}

      {nada && (
        <div className="rounded-4xl bg-sand p-8 text-center">
          <p className="text-lg font-semibold">Nada pendente com você agora.</p>
          <p className="mt-1 text-sm text-stone-550">
            Quando um post for atribuído a você, ou um cliente seu tiver algo pra revisar, ele aparece aqui.{" "}
            <Link href="/posts" className="font-semibold text-ink underline underline-offset-4">Ver todos os posts</Link>
          </p>
        </div>
      )}

      <div className={`grid items-start gap-5 ${temColunaLateral ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""}`}>
        <div className="min-w-0 space-y-6">
          {atrasados.length > 0 && (
            <Secao id="atrasados" titulo="Atrasados" sub="Resolver primeiro" subCor="text-[#9A2A12]">
              {atrasados.map((p) => (
                <LinhaExecutor key={p.id} p={p} acao={p.status === "alterar" ? "Abrir e ajustar" : "Abrir"} />
              ))}
            </Secao>
          )}

          {emRisco.length > 0 && (
            <Secao id="risco" titulo="Publicação em risco" sub="Publica até amanhã e ainda não foi aprovado" subCor="text-[#9A2A12]">
              {emRisco.map((p) => {
                const d = (p.data_publicacao_planejada ?? "").slice(0, 10);
                const quando = d < hoje ? `Venceu ${ddmm(d)}` : d === hoje ? "Publica hoje" : "Publica amanhã";
                const exec = p.responsavel_id ? userMap.get(p.responsavel_id) : null;
                const execNome = exec ? (exec.nome || exec.email).split(" ")[0] : null;
                const comVoce = p.responsavel_id === me.id || ["revisao_interna"].includes(p.status);
                const onde =
                  p.status === "revisao_interna"
                    ? "Está com você, pra revisar"
                    : p.status === "para_aprovacao"
                    ? "Com o cliente, esperando aprovação"
                    : `${STATUS_LABELS[p.status]}${execNome ? ` · com ${p.responsavel_id === me.id ? "você" : execNome}` : ""}`;
                return (
                  <article key={p.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[20px] bg-[#FBFAF7] px-[18px] py-4">
                    <span className={`flex h-12 min-w-[88px] flex-none items-center justify-center rounded-[14px] px-2 text-center text-[12px] font-extrabold leading-tight ${d <= hoje ? "bg-[#B42318] text-white" : "bg-[#FBE3DE] text-[#8F2410]"}`}>
                      {quando}
                    </span>
                    <div className="min-w-0 flex-[1_1_220px] space-y-1">
                      <p className="text-base font-semibold">{p.titulo}</p>
                      <p className="text-[13px] text-stone-550">
                        {clientMap.get(p.client_id)?.nome} · {FORMAT_LABELS[p.formato]} · <span className="font-semibold text-[#4A463F]">{onde}</span>
                      </p>
                    </div>
                    <AcoesMesa
                      postId={p.id}
                      tipo="risco"
                      executorNome={comVoce || p.status === "para_aprovacao" ? null : execNome}
                    />
                  </article>
                );
              })}
            </Secao>
          )}

          {atrasadosEquipe.length > 0 && (
            <Secao id="equipe-atrasada" titulo="Atrasados com a equipe" sub="Passaram da data de entrega" subCor="text-[#9A2A12]">
              {atrasadosEquipe.map((p) => {
                const exec = p.responsavel_id ? userMap.get(p.responsavel_id) : null;
                const execNome = exec ? (exec.nome || exec.email).split(" ")[0] : null;
                const dias = diasEntre(p.data_entrega!, hoje);
                return (
                  <article key={p.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[20px] bg-[#FBFAF7] px-[18px] py-4">
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-ink text-[13px] font-extrabold text-bussola-yellow">
                      {dias}d
                    </span>
                    <div className="min-w-0 flex-[1_1_220px] space-y-1">
                      <p className="text-base font-semibold">{p.titulo}</p>
                      <p className="text-[13px] text-stone-550">
                        {clientMap.get(p.client_id)?.nome} · {FORMAT_LABELS[p.formato]} ·{" "}
                        <span className="font-semibold text-[#4A463F]">
                          {STATUS_LABELS[p.status]}{execNome ? ` · com ${execNome}` : " · sem executor"}
                        </span>
                      </p>
                      <p className="text-[12.5px] font-semibold text-[#9A2A12]">Entrega era {ddmm(p.data_entrega)}</p>
                    </div>
                    <AcoesMesa postId={p.id} tipo="risco" executorNome={execNome} />
                  </article>
                );
              })}
            </Secao>
          )}

          {revisar.length > 0 && (
            <Secao id="revisar" titulo="Pra revisar" sub="Entregues pela equipe">
              {revisar.map((p) => {
                const quem = p.responsavel_id ? userMap.get(p.responsavel_id)?.nome?.split(" ")[0] : null;
                return (
                  <article key={p.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[20px] bg-[#FBFAF7] px-[18px] py-4">
                    <div className="min-w-0 flex-[1_1_240px] space-y-1">
                      <span className="label-mono block text-[9.5px] text-stone-550">
                        {FORMAT_LABELS[p.formato]}{quem ? ` · por ${quem}` : ""}
                      </span>
                      <Link href={`/posts/${p.id}`} className="block text-base font-semibold hover:underline">{p.titulo}</Link>
                      <p className="text-[13px] text-stone-550">
                        {clientMap.get(p.client_id)?.nome}
                        {p.delivered_link && (
                          <>
                            {" · "}
                            <a href={p.delivered_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline-offset-4 hover:underline">
                              Ver entrega ↗
                            </a>
                          </>
                        )}
                      </p>
                    </div>
                    <AcoesMesa postId={p.id} tipo="revisar" baseUrl={baseUrl} />
                  </article>
                );
              })}
            </Secao>
          )}

          {preencher.length > 0 && (
            <Secao id="preencher" titulo="Pra preencher" sub="Criados pela rotina · faltam título e briefing">
              <div className="rounded-[20px] bg-[#FBFAF7] px-[18px] py-1.5">
                {preencher.map((p) => {
                  const exec = p.responsavel_id ? userMap.get(p.responsavel_id) : null;
                  const urgente = !!p.data_entrega && p.data_entrega <= somarDias(hoje, 1);
                  return (
                    <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#EDE9E0] py-3 last:border-0">
                      <div className="min-w-0 flex-[1_1_240px]">
                        <p className="text-[14.5px] font-semibold">{clientMap.get(p.client_id)?.nome}</p>
                        <p className="text-[13px] text-stone-550">
                          {FORMAT_LABELS[p.formato]} · publica {ddmm(p.data_publicacao_planejada)}
                          {exec ? ` · ${(exec.nome || exec.email).split(" ")[0]}` : ""}
                        </p>
                      </div>
                      <span className={`label-mono ${urgente ? "text-[#9A2A12]" : "text-stone-550"}`}>
                        Entrega {ddmm(p.data_entrega)}
                      </span>
                      <Link
                        href={`/posts/${p.id}`}
                        className="flex h-10 items-center rounded-full bg-ink px-4 text-[13.5px] font-semibold text-white transition hover:bg-ink-muted"
                      >
                        Preencher
                      </Link>
                    </div>
                  );
                })}
              </div>
            </Secao>
          )}

          {ajustes.length > 0 && (
            <Secao id="ajustes" titulo="Ajustes pedidos" sub="Voltaram pra você">
              {ajustes.map((p) => <LinhaExecutor key={p.id} p={p} acao="Abrir e ajustar" />)}
            </Secao>
          )}

          {publicar.length > 0 && (
            <Secao
              id="publicar"
              titulo="Pra publicar"
              sub={vencidos ? `${plural(vencidos, "com a data vencida", "com a data vencida")}` : "Aprovados pelo cliente · agende ou marque como publicado"}
              subCor={vencidos ? "text-[#9A2A12]" : undefined}
            >
              {publicar.map((p) => {
                const vencido = !!p.data_publicacao_planejada && p.data_publicacao_planejada < hoje;
                const dias = vencido ? diasEntre(p.data_publicacao_planejada!, hoje) : 0;
                return (
                  <article key={p.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[20px] bg-[#FBFAF7] px-[18px] py-4">
                    {vencido && (
                      <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-ink text-[13px] font-extrabold text-bussola-yellow">
                        {dias}d
                      </span>
                    )}
                    <div className="min-w-0 flex-[1_1_220px] space-y-1">
                      <p className="text-base font-semibold">{p.titulo}</p>
                      <p className="text-[13px] text-stone-550">
                        {clientMap.get(p.client_id)?.nome} · aprovado · {vencido ? "publicação era" : "publicação"} {ddmm(p.data_publicacao_planejada)}
                      </p>
                    </div>
                    <AcoesMesa postId={p.id} tipo="publicar" />
                  </article>
                );
              })}
            </Secao>
          )}

          {agendados > 0 && (
            <p className="text-[13px] text-stone-550">
              {plural(agendados, "post agendado", "posts agendados")} na rede. Eles viram &quot;Publicado&quot; sozinhos no dia seguinte à data.
            </p>
          )}

          {praHoje.length > 0 && (
            <Secao id="hoje" titulo="Pra hoje" sub={dataHoje}>
              {praHoje.map((p) => <LinhaExecutor key={p.id} p={p} acao="Entregar" />)}
            </Secao>
          )}

          {comClienteOrdenado.length > 0 && (
            <Secao id="cliente" titulo="Com o cliente" sub={emAjusteDeOutros ? `Esperando resposta · ${emAjusteDeOutros} em ajuste com a equipe` : "Esperando resposta"}>
              <div className="rounded-[20px] bg-[#FBFAF7] px-[18px] py-1.5">
                {comClienteOrdenado.map(({ post: p, dias }) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#EDE9E0] py-3 last:border-0">
                    <Link href={`/posts/${p.id}`} className="min-w-0 flex-[1_1_220px] text-[14.5px] font-semibold hover:underline">
                      {p.titulo} <span className="font-medium text-stone-550">· {clientMap.get(p.client_id)?.nome}</span>
                    </Link>
                    <span className={`label-mono ${dias >= 3 ? "text-[#9A2A12]" : "text-stone-550"}`}>
                      {dias <= 0 ? "Hoje" : `Há ${plural(dias, "dia", "dias")}`}
                    </span>
                    <AcoesMesa postId={p.id} tipo="cliente" token={p.public_token} baseUrl={baseUrl} />
                  </div>
                ))}
              </div>
            </Secao>
          )}
        </div>

        {temColunaLateral && (
          <div className="space-y-4">
            {(semana.length > 0 || semData > 0) && (
              <aside id="semana" className="space-y-4 rounded-3xl bg-sand p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[17px] font-bold">Próximos 7 dias</h2>
                  <span className="label-mono text-stone-550">{plural(semana.length, "post", "posts")}</span>
                </div>
                {Array.from(new Set(semana.map((p) => p.data_entrega!))).map((dia) => (
                  <div key={dia} className="space-y-1.5">
                    <p className="label-mono text-stone-550">
                      {new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(dia + "T12:00:00Z")).replace(".", "")} · {ddmm(dia)}
                    </p>
                    {semana.filter((p) => p.data_entrega === dia).map((p) => (
                      <Link key={p.id} href={`/posts/${p.id}`} className="block rounded-[14px] bg-sand-light px-3 py-2.5 transition hover:bg-white">
                        <span className="block text-sm font-semibold">{p.titulo}</span>
                        <span className="block text-[12.5px] text-stone-550">
                          {clientMap.get(p.client_id)?.nome} · {FORMAT_LABELS[p.formato]}
                        </span>
                      </Link>
                    ))}
                  </div>
                ))}
                {semData > 0 && (
                  <p className="text-[12.5px] text-stone-550">
                    + {plural(semData, "post seu sem data de entrega", "posts seus sem data de entrega")}.
                  </p>
                )}
                <Link href={`/posts?resp=${me.id}`} className="block pt-1 text-center text-[13.5px] font-semibold underline-offset-4 hover:underline">
                  Ver todos os meus posts
                </Link>
              </aside>
            )}

            {resumoClientes.length > 0 && (
              <aside className="space-y-3 rounded-3xl bg-sand p-5">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[17px] font-bold">Meus clientes</h2>
                  <span className="label-mono text-stone-550">{resumoClientes.length}</span>
                </div>
                {resumoClientes.map(({ client: c, resumo, alerta }) => (
                  <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center gap-3 rounded-2xl bg-sand-light p-3 transition hover:bg-white">
                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-ink text-[13px] font-bold text-paper">
                      {c.nome.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{c.nome}</span>
                      <span className="block truncate text-[12.5px] text-stone-550">{resumo}</span>
                    </span>
                    {alerta && <span className="h-2 w-2 flex-none rounded-full bg-[#C2410C]" aria-label="Tem pendência" />}
                  </Link>
                ))}
                <p className="text-[12.5px] leading-relaxed text-stone-550">Ponto laranja: post atrasado ou aprovado sem publicar.</p>
              </aside>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
