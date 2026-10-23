import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewAdminPanels } from "@/lib/permissions";
import { isAtrasado, publicadoEsteMes } from "@/lib/status";
import type { Client, Post } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function IndicadoresPage() {
  const me = await getCurrentUser();
  if (!canViewAdminPanels(me?.perfil)) {
    redirect("/");
  }

  const supabase = await createClient();
  const [{ data: clients }, { data: posts }, { data: users }] = await Promise.all([
    supabase.from("clients").select("*"),
    supabase.from("posts").select("*").eq("arquivado", false),
    supabase.from("users").select("*").eq("ativo", true),
  ]);

  const allClients = (clients as Client[]) ?? [];
  const allPosts = (posts as Post[]) ?? [];
  const allUsers = (users as { id: string; nome: string }[]) ?? [];

  const clientesAtivos = allClients.filter((c) => c.status === "ativo").length;
  const clientesPausados = allClients.filter((c) => c.status === "pausado").length;

  const publicadosEsteMes = allPosts.filter(publicadoEsteMes);
  const totalPublicadosMes = publicadosEsteMes.length;

  const porCliente = allClients
    .map((c) => ({
      cliente: c.nome,
      publicados: publicadosEsteMes.filter((p) => p.client_id === c.id).length,
    }))
    .filter((c) => c.publicados > 0)
    .sort((a, b) => b.publicados - a.publicados);

  const totalPosts = allPosts.length;
  const totalAtrasados = allPosts.filter(isAtrasado).length;
  const taxaAtrasoGeral = totalPosts > 0 ? Math.round((totalAtrasados / totalPosts) * 100) : 0;

  const taxaPorColaborador = allUsers
    .map((u) => {
      const meus = allPosts.filter((p) => p.responsavel_id === u.id);
      const atrasados = meus.filter(isAtrasado).length;
      const taxa = meus.length > 0 ? Math.round((atrasados / meus.length) * 100) : 0;
      return { nome: u.nome, total: meus.length, atrasados, taxa };
    })
    .filter((u) => u.total > 0);

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-slate-900">Indicadores estratégicos</h1>
      <p className="mt-1 text-sm text-slate-500">
        Visão executiva da operação. Visível apenas para admin.
      </p>

      {/* Cards de resumo */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs uppercase text-slate-500">Clientes ativos</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{clientesAtivos}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs uppercase text-slate-500">Clientes pausados</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{clientesPausados}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs uppercase text-slate-500">Publicados este mês</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{totalPublicadosMes}</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs uppercase text-slate-500">Taxa de atraso geral</p>
          <p className={`mt-1 text-2xl font-bold ${taxaAtrasoGeral > 20 ? "text-red-600" : "text-slate-900"}`}>
            {taxaAtrasoGeral}%
          </p>
        </div>
      </div>

      {/* Publicados por cliente */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Publicados este mês por cliente</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[24rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-center">Posts publicados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {porCliente.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-4 text-center text-slate-400">
                    Nenhum post publicado este mês ainda.
                  </td>
                </tr>
              )}
              {porCliente.map((c) => (
                <tr key={c.cliente} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{c.cliente}</td>
                  <td className="px-4 py-2 text-center text-slate-600">{c.publicados}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Taxa de atraso por colaborador */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Taxa de atraso por colaborador</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[24rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Colaborador</th>
                <th className="px-4 py-2 text-center">Total de posts</th>
                <th className="px-4 py-2 text-center">Atrasados</th>
                <th className="px-4 py-2 text-center">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxaPorColaborador.map((u) => (
                <tr key={u.nome} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">{u.nome}</td>
                  <td className="px-4 py-2 text-center text-slate-600">{u.total}</td>
                  <td className="px-4 py-2 text-center text-slate-600">{u.atrasados}</td>
                  <td className={`px-4 py-2 text-center font-semibold ${u.taxa > 20 ? "text-red-600" : "text-emerald-600"}`}>
                    {u.taxa}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
