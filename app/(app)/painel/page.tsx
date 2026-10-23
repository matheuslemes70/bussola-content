import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminPanels, canViewDataPublicacao, canViewPainel } from "@/lib/permissions";
import { isAtrasado, isAFazer, FORMAT_LABELS } from "@/lib/status";
import { PersonKanban } from "@/components/kanban/PersonKanban";
import type { Post, Client, User } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const me = await getCurrentUser();
  if (!canViewPainel(me?.perfil)) redirect("/");

  // Postados há mais de 30 dias não entram (a coluna "Postado" crescia para sempre).
  const corte30 = new Date(Date.now() - 30 * 86400000).toISOString();
  const inicioMes =
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(0, 8) + "01";
  const [{ data: posts }, { data: clients }, { data: users }, { data: pubHist }] = await Promise.all([
    supabase.from("posts").select("*").eq("arquivado", false).or(`status.neq.publicado,updated_at.gte.${corte30}`),
    supabase.from("clients").select("*").order("nome"),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
    supabase
      .from("post_status_history")
      .select("post_id")
      .eq("status", "publicado")
      .gte("created_at", inicioMes + "T00:00:00-03:00"),
  ]);

  const allClients = (clients as Client[]) ?? [];
  const allUsers = (users as User[]) ?? [];

  // Clientes pausados ficam ocultos do dashboard (cards, kanban e resumo).
  const activeClients = allClients.filter((c) => c.status === "ativo");
  const activeIds = new Set(activeClients.map((c) => c.id));
  const allPosts = ((posts as Post[]) ?? []).filter((p) => activeIds.has(p.client_id));

  const hojeBrasilia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()); // YYYY-MM-DD
  const aProduzir = allPosts.filter((p) => p.status === "a_produzir").length;
  const prontoParaEditarHoje = allPosts.filter(
    (p) => p.status === "pronto_pra_editar" && p.data_entrega === hojeBrasilia
  ).length;
  const prontoParaEditar = allPosts.filter((p) => p.status === "pronto_pra_editar").length;
  const aguardando = allPosts.filter((p) => p.status === "para_aprovacao").length;
  const ajuste = allPosts.filter((p) => p.status === "alterar").length;
  const aprovados = allPosts.filter((p) => p.status === "aprovado").length;
  const atrasados = allPosts.filter(isAtrasado).length;
  const meusAtrasados = allPosts.filter(
    (p) => isAtrasado(p) && (p.responsavel_id === me?.id || p.dono_id === me?.id)
  ).length;

  const hora = Number(
    new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date())
  );
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const primeiroNome = (me?.nome || "").split(" ")[0] || "";
  const isGestorOuAdmin = canViewAdminPanels(me?.perfil);
  const mensagem =
    isGestorOuAdmin && atrasados > 0
      ? `A fila tem ${atrasados} post${atrasados > 1 ? "s" : ""} fora do prazo${aguardando > 0 ? ` e ${aguardando} com o cliente esperando aprovação` : ""}. Hoje é dia de destravar o que já está pronto.`
      : !isGestorOuAdmin && meusAtrasados > 0
      ? `Você tem ${meusAtrasados} post${meusAtrasados > 1 ? "s" : ""} atrasado${meusAtrasados > 1 ? "s" : ""} que merece${meusAtrasados > 1 ? "m" : ""} atenção hoje.`
      : allPosts.length > 0
      ? "Tudo em ordem por aqui — bom trabalho!"
      : "Aqui está a visão geral das suas demandas.";
  // Publicados no mês pela data em que foram marcados (histórico), não pela planejada.
  const idsAtivos = new Set(((posts as Post[]) ?? []).filter((p) => activeIds.has(p.client_id)).map((p) => p.id));
  const publicadosMes = new Set(
    ((pubHist as { post_id: string }[]) ?? []).map((h) => h.post_id).filter((id) => idsAtivos.has(id))
  ).size;

  // ---------- Fluxo de produção (barra segmentada) ----------
  const emProducao = allPosts.filter((p) => p.status === "em_producao").length;
  const emRevisao = allPosts.filter((p) => p.status === "revisao_interna").length;
  const fluxo = [
    { label: "A produzir", count: aProduzir, href: "/posts?status=a_produzir", cor: "#8A8478" },
    { label: "Em produção", count: emProducao, href: "/posts?status=em_producao", cor: "#3FB6C9" },
    { label: "Pra editar", count: prontoParaEditar, href: "/posts?status=pronto_pra_editar", cor: "#5B83F5" },
    { label: "Revisão", count: emRevisao, href: "/posts?status=revisao_interna", cor: "#B7D3F2" },
    { label: "Cliente", count: aguardando, href: "/posts?status=para_aprovacao", cor: "#F9B800" },
    { label: "Ajuste", count: ajuste, href: "/posts?status=alterar", cor: "#EE7A4E" },
    { label: "Aprovados", count: aprovados, href: "/posts?status=aprovado", cor: "#E8E3D8" },
  ];
  const totalFluxo = fluxo.reduce((acc, f) => acc + f.count, 0);

  // ---------- Mais atrasados ----------
  // A data que conta é a de entrega (em produção) ou a de publicação (aguardando
  // publicar). Quem não pode ver a data de publicação só vê atrasos de entrega.
  const podeVerPublicacao = canViewDataPublicacao(me?.perfil);
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const clientMap = new Map(activeClients.map((c) => [c.id, c]));
  const DIA_MS = 24 * 60 * 60 * 1000;
  const hojeMs = new Date(hojeBrasilia + "T00:00:00").getTime();
  const maisAtrasados = allPosts
    .filter(isAtrasado)
    .map((p) => {
      const deEntrega = ["a_produzir", "em_producao", "pronto_pra_editar", "alterar"].includes(p.status);
      const data = deEntrega ? p.data_entrega : p.data_publicacao_planejada;
      return { post: p, data, deEntrega };
    })
    .filter((x) => x.data && (x.deEntrega || podeVerPublicacao))
    .map((x) => ({
      ...x,
      dias: Math.max(1, Math.round((hojeMs - new Date(x.data + "T00:00:00").getTime()) / DIA_MS)),
    }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 3);
  const maisAntigo = maisAtrasados[0];

  const dataHoje = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const ddmm = (d: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : "—");
  const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios);

  return (
    <div className="space-y-8">
      {/* Saudação */}
      <section className="max-w-3xl space-y-3 pt-4">
        <p className="label-mono text-stone-550">{dataHoje}</p>
        <h1 className="text-4xl font-bold leading-none tracking-[-0.04em] sm:text-[56px]">
          {saudacao}
          {primeiroNome ? `, ${primeiroNome}` : ""}
        </h1>
        <p className="text-[17px] leading-relaxed text-[#4A463F]">{mensagem}</p>
      </section>

      {/* Destaques */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Link
          href="/posts?atrasados=1"
          className="group flex min-h-[290px] flex-col gap-4 rounded-4xl bg-bussola-yellow p-6 text-ink transition hover:brightness-[0.97] sm:p-7"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold">Atrasados</h2>
            <span className="label-mono text-[#3D2E05]">Prazo vencido</span>
          </div>
          <span className="text-[104px] font-extrabold leading-[0.9] tracking-[-0.06em]">{atrasados}</span>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-4">
            {maisAntigo ? (
              <div className="min-w-0 space-y-1">
                <p className="label-mono text-[#3D2E05]">Mais antigo</p>
                <p className="truncate text-sm font-semibold">
                  {maisAntigo.post.titulo} · {maisAntigo.dias} {plural(maisAntigo.dias, "dia", "dias")}
                </p>
              </div>
            ) : (
              <p className="text-sm font-semibold">Nenhum post fora do prazo.</p>
            )}
            <span className="flex h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white">
              Ver atrasados
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden className="transition group-hover:translate-x-0.5">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </span>
          </div>
        </Link>

        <article className="flex min-h-[290px] flex-col gap-5 rounded-4xl bg-ink p-6 text-paper sm:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-white">Fluxo de produção</h2>
            <span className="label-mono text-[#9A9488]">Posts ativos</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-6xl font-extrabold leading-none tracking-[-0.05em] text-white">{totalFluxo}</span>
            <span className="text-sm text-[#B9B3A6]">
              na fila agora
              {prontoParaEditarHoje > 0 && (
                <>
                  {" · "}
                  <strong className="font-semibold text-bussola-yellow">
                    {prontoParaEditarHoje} {plural(prontoParaEditarHoje, "pronto", "prontos")} pra editar hoje
                  </strong>
                </>
              )}
            </span>
          </div>
          {totalFluxo > 0 && (
            <div
              role="img"
              aria-label={fluxo.map((f) => `${f.count} ${f.label}`).join(", ")}
              className="flex h-3.5 gap-1"
            >
              {fluxo
                .filter((f) => f.count > 0)
                .map((f) => (
                  <span key={f.label} className="rounded-[4px]" style={{ flex: f.count, background: f.cor }} />
                ))}
            </div>
          )}
          <div className="mt-auto grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-x-3 gap-y-4">
            {fluxo.map((f) => (
              <Link key={f.label} href={f.href} className="group space-y-1.5 rounded-lg">
                <span className="block text-[22px] font-bold text-white group-hover:text-bussola-yellow">{f.count}</span>
                <span className="label-mono flex items-center gap-1.5 text-[#B9B3A6]">
                  <span className="h-[7px] w-[7px] flex-none rounded-[2px]" style={{ background: f.cor }} />
                  {f.label}
                </span>
              </Link>
            ))}
          </div>
        </article>
      </section>

      {/* No feed + mais atrasados */}
      <section className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <article className="flex flex-col gap-5 rounded-4xl bg-sand p-6">
          <div className="space-y-1">
            <h2 className="text-[17px] font-bold">No feed</h2>
            <span className="label-mono block text-stone-550">Este mês</span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-5 lg:flex-col lg:divide-y lg:divide-sand-line">
            <Link href="/posts?status=publicado" className="space-y-1.5 hover:opacity-80">
              <span className="block text-[44px] font-extrabold leading-none tracking-[-0.04em]">{publicadosMes}</span>
              <span className="label-mono block text-stone-550">Publicados</span>
            </Link>
            <Link href="/posts?status=aprovado" className="space-y-1.5 hover:opacity-80 lg:pt-5">
              <span className="block text-[44px] font-extrabold leading-none tracking-[-0.04em]">{aprovados}</span>
              <span className="label-mono block text-stone-550">Prontos pra postar</span>
            </Link>
          </div>
        </article>

        <article className="flex flex-col gap-3 rounded-4xl bg-sand p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">Mais atrasados</h2>
            <Link href="/posts?atrasados=1" className="label-mono text-ink underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          {maisAtrasados.length === 0 && (
            <p className="rounded-2xl bg-sand-light px-4 py-5 text-sm text-stone-550">Tudo dentro do prazo por aqui.</p>
          )}
          {maisAtrasados.map(({ post, dias, data, deEntrega }) => {
            const dono = post.responsavel_id ? userMap.get(post.responsavel_id) : null;
            const cliente = clientMap.get(post.client_id);
            return (
              <Link
                key={post.id}
                href={`/posts/${post.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-sand-light px-4 py-3 transition hover:bg-white"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-ink text-[13px] font-extrabold text-bussola-yellow">
                  {dias}d
                </span>
                <div className="min-w-0 flex-[1_1_200px]">
                  <p className="truncate text-[14.5px] font-semibold">{post.titulo}</p>
                  <p className="truncate text-[13px] text-stone-550">
                    {[cliente?.nome, dono ? (dono.nome || dono.email).split(" ")[0] : null].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="label-mono text-stone-550">{FORMAT_LABELS[post.formato]}</span>
                <span className="label-mono text-[#9A2A12]">
                  {deEntrega ? "Entrega" : "Publicação"} {ddmm(data)}
                </span>
              </Link>
            );
          })}
        </article>
      </section>

      {/* Fila da equipe */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3.5">
            <h2 className="text-2xl font-bold tracking-[-0.02em]">Fila da equipe</h2>
            <span className="label-mono text-stone-550">Por responsável</span>
          </div>
          <Link href="/posts" className="text-sm font-semibold underline-offset-4 hover:underline">
            Ver todos os posts
          </Link>
        </div>
        {allPosts.length === 0 ? (
          <p className="rounded-3xl bg-sand p-8 text-center text-sm text-stone-550">Nenhum post cadastrado ainda.</p>
        ) : (
          <PersonKanban
            posts={allPosts.map((p) => ({ ...p, data_publicacao_planejada: p.data_entrega }))}
            users={allUsers}
            clients={activeClients}
          />
        )}
      </section>

      {/* Clientes */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-3.5">
            <h2 className="text-2xl font-bold tracking-[-0.02em]">Clientes</h2>
            <span className="label-mono text-stone-550">{activeClients.length} ativos</span>
          </div>
          <Link href="/clientes" className="text-sm font-semibold underline-offset-4 hover:underline">
            Ver clientes
          </Link>
        </div>
        {activeClients.length === 0 ? (
          <p className="rounded-3xl bg-sand p-8 text-center text-sm text-stone-550">Nenhum cliente ativo.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeClients.map((client) => {
              const cPosts = allPosts.filter((p) => p.client_id === client.id);
              const aFazer = cPosts.filter(isAFazer).length;
              const cAtrasados = cPosts.filter(isAtrasado).length;
              return (
                <Link
                  key={client.id}
                  href={`/clientes/${client.id}`}
                  className="flex items-center gap-3.5 rounded-3xl bg-sand p-4 transition hover:bg-sand-line"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-ink text-sm font-bold text-paper">
                    {client.nome.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{client.nome}</p>
                    <p className="mt-0.5 flex gap-3 text-[13px] text-stone-550">
                      <span>{aFazer} a fazer</span>
                      {cAtrasados > 0 && <span className="font-semibold text-[#9A2A12]">{cAtrasados} atrasados</span>}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
