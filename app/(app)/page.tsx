import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminPanels, canViewDataPublicacao } from "@/lib/permissions";
import { isAtrasado, isAFazer, publicadoEsteMes } from "@/lib/status";
import { PersonKanban } from "@/components/kanban/PersonKanban";
import type { Post, Client, User } from "@/lib/types";

export const dynamic = "force-dynamic";

type DashCard = {
  label: string;
  count: number;
  href: string;
  accent: string;
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const me = await getCurrentUser();

  const [{ data: posts }, { data: clients }, { data: users }] = await Promise.all([
    supabase.from("posts").select("*").eq("arquivado", false),
    supabase.from("clients").select("*").order("nome"),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
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
      ? `A equipe tem ${atrasados} post${atrasados > 1 ? "s" : ""} atrasado${atrasados > 1 ? "s" : ""} que precisa${atrasados > 1 ? "m" : ""} de atenção.`
      : !isGestorOuAdmin && meusAtrasados > 0
      ? `Você tem ${meusAtrasados} post${meusAtrasados > 1 ? "s" : ""} atrasado${meusAtrasados > 1 ? "s" : ""} que merece${meusAtrasados > 1 ? "m" : ""} atenção hoje.`
      : allPosts.length > 0
      ? "Tudo em ordem por aqui — bom trabalho!"
      : "Aqui está a visão geral das suas demandas.";
  const publicadosMes = allPosts.filter(publicadoEsteMes).length;

  const cards: DashCard[] = [
    { label: "A produzir", count: aProduzir, href: "/posts?status=a_produzir", accent: "border-slate-300" },
    { label: "Pronto pra editar hoje", count: prontoParaEditarHoje, href: "/posts?status=pronto_pra_editar", accent: "border-indigo-400" },
    { label: "Pronto pra editar", count: prontoParaEditar, href: "/posts?status=pronto_pra_editar", accent: "border-indigo-400" },
    { label: "Aguardando aprovação", count: aguardando, href: "/posts?status=para_aprovacao", accent: "border-amber-400" },
    { label: "Com ajuste pendente", count: ajuste, href: "/posts?status=alterar", accent: "border-orange-400" },
    { label: "Aprovados", count: aprovados, href: "/posts?status=aprovado", accent: "border-emerald-400" },
    { label: "Atrasados", count: atrasados, href: "/posts?atrasados=1", accent: "border-red-500" },
    { label: "Publicados este mês", count: publicadosMes, href: "/posts?status=publicado", accent: "border-green-500" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {saudacao}{primeiroNome ? `, ${primeiroNome}` : ""}
        </h1>
        <p className={`mt-1 text-sm ${atrasados > 0 ? "text-red-600 font-medium" : "text-slate-500"}`}>
          {mensagem}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-xl border-l-4 bg-white p-5 shadow-sm transition hover:shadow-md ${c.accent}`}
          >
            <p className="text-3xl font-bold text-slate-800">{c.count}</p>
            <p className="mt-1 text-sm text-slate-500">{c.label}</p>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-700">Visão geral</h2>
        {allPosts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
            Nenhum post cadastrado ainda.
          </p>
        ) : (
          <PersonKanban
            posts={allPosts.map((p) => ({ ...p, data_publicacao_planejada: p.data_entrega }))}
            users={allUsers}
            clients={activeClients}
          />
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-700">Clientes</h2>
        {activeClients.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
            Nenhum cliente ativo.{" "}
            <Link href="/clientes" className="text-bussola-blue underline">
              Ver clientes
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeClients.map((client) => {
              const cPosts = allPosts.filter((p) => p.client_id === client.id);
              const aFazer = cPosts.filter(isAFazer).length;
              const cAtrasados = cPosts.filter(isAtrasado).length;
              return (
                <Link
                  key={client.id}
                  href={`/clientes/${client.id}`}
                  className="rounded-xl bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-800">{client.nome}</p>
                    {client.status === "pausado" && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                        Pausado
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-4 text-sm text-slate-500">
                    <span>{aFazer} a fazer</span>
                    {cAtrasados > 0 && (
                      <span className="font-medium text-red-600">{cAtrasados} atrasados</span>
                    )}
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
