import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAtrasado, isAFazer, publicadoEsteMes } from "@/lib/status";
import { Kanban } from "@/components/kanban/Kanban";
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

  const [{ data: posts }, { data: clients }, { data: users }] = await Promise.all([
    supabase.from("posts").select("*"),
    supabase.from("clients").select("*").order("nome"),
    supabase.from("users").select("*").eq("ativo", true).order("nome"),
  ]);

  const allClients = (clients as Client[]) ?? [];
  const allUsers = (users as User[]) ?? [];

  // Clientes pausados ficam ocultos do dashboard (cards, kanban e resumo).
  const activeClients = allClients.filter((c) => c.status === "ativo");
  const activeIds = new Set(activeClients.map((c) => c.id));
  const allPosts = ((posts as Post[]) ?? []).filter((p) => activeIds.has(p.client_id));

  const aProduzir = allPosts.filter((p) => p.status === "a_produzir").length;
  const aguardando = allPosts.filter((p) => p.status === "para_aprovacao").length;
  const ajuste = allPosts.filter((p) => p.status === "alterar").length;
  const aprovados = allPosts.filter((p) => p.status === "aprovado").length;
  const atrasados = allPosts.filter(isAtrasado).length;
  const publicadosMes = allPosts.filter(publicadoEsteMes).length;

  const cards: DashCard[] = [
    { label: "A produzir", count: aProduzir, href: "/posts?status=a_produzir", accent: "border-slate-300" },
    { label: "Aguardando aprovação", count: aguardando, href: "/posts?status=para_aprovacao", accent: "border-amber-400" },
    { label: "Com ajuste pendente", count: ajuste, href: "/posts?status=alterar", accent: "border-orange-400" },
    { label: "Aprovados", count: aprovados, href: "/posts?status=aprovado", accent: "border-emerald-400" },
    { label: "Atrasados", count: atrasados, href: "/posts?atrasados=1", accent: "border-red-500" },
    { label: "Publicados este mês", count: publicadosMes, href: "/posts?status=publicado", accent: "border-green-500" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

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
          <Kanban posts={allPosts} users={allUsers} clients={activeClients} />
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
