import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canViewFinanceiro } from "@/lib/permissions";
import type { Client, ClientContract, MetaFinanceira } from "@/lib/types";
import { ContractForm } from "./ContractForm";
import { ContractRow } from "./ContractRow";
import { MetaEditor } from "./MetaEditor";

export const dynamic = "force-dynamic";

function formatMoeda(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default async function FinanceiroPage() {
  const me = await getCurrentUser();
  if (!canViewFinanceiro(me?.perfil)) {
    redirect("/");
  }

  const supabase = await createClient();

  const now = new Date();
  const mesAtual = now.getMonth() + 1;
  const anoAtual = now.getFullYear();

  const [{ data: contracts }, { data: clients }, { data: metas }] = await Promise.all([
    supabase.from("client_contracts").select("*").order("data_inicio", { ascending: false }),
    supabase.from("clients").select("*"),
    supabase.from("metas_financeiras").select("*").eq("mes", mesAtual).eq("ano", anoAtual),
  ]);

  const allContracts = (contracts as ClientContract[]) ?? [];
  const allClients = (clients as Client[]) ?? [];
  const metaAtual = (metas as MetaFinanceira[])?.[0] ?? null;

  const clientMap = new Map(allClients.map((c) => [c.id, c]));

  const contratosAtivos = allContracts.filter((c) => c.status === "ativo");
  const faturamentoAtual = contratosAtivos.reduce((sum, c) => sum + Number(c.valor_mensal), 0);

  const valorMeta = metaAtual ? Number(metaAtual.valor_meta) : 0;
  const progresso = valorMeta > 0 ? Math.round((faturamentoAtual / valorMeta) * 100) : 0;

  const contratosPausados = allContracts.filter((c) => c.status === "pausado");
  const contratosCancelados = allContracts
    .filter((c) => c.status === "cancelado")
    .sort((a, b) => (b.data_fim ?? "").localeCompare(a.data_fim ?? ""));

  const nomesMeses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl font-bold text-slate-900">Financeiro</h1>
      <p className="mt-1 text-sm text-slate-500">
        Faturamento recorrente e meta do mês. Visível apenas para admin e Gestora de Projetos.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs uppercase text-slate-500">Faturamento atual (MRR)</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoeda(faturamentoAtual)}</p>
          <p className="mt-1 text-xs text-slate-400">{contratosAtivos.length} contrato(s) ativo(s)</p>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs uppercase text-slate-500">
            Meta de {nomesMeses[mesAtual - 1]}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-2xl font-bold text-slate-900">
              {valorMeta > 0 ? formatMoeda(valorMeta) : "Não definida"}
            </p>
          </div>
          <div className="mt-2">
            <MetaEditor mes={mesAtual} ano={anoAtual} valorAtual={valorMeta} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="text-xs uppercase text-slate-500">Progresso da meta</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              progresso >= 100 ? "text-emerald-600" : "text-slate-900"
            }`}
          >
            {valorMeta > 0 ? `${progresso}%` : "—"}
          </p>
          {valorMeta > 0 && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full ${progresso >= 100 ? "bg-emerald-500" : "bg-slate-900"}`}
                style={{ width: `${Math.min(progresso, 100)}%` }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Novo contrato</h2>
        <div className="mt-3 rounded-lg border border-slate-200 p-4">
          <ContractForm clients={allClients} />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Contratos ativos</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-center">Valor mensal</th>
                <th className="px-4 py-2 text-center">Início</th>
                <th className="px-4 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contratosAtivos.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                    Nenhum contrato ativo cadastrado ainda.
                  </td>
                </tr>
              )}
              {contratosAtivos.map((contract) => (
                <ContractRow
                  key={contract.id}
                  contract={contract}
                  clientNome={clientMap.get(contract.client_id)?.nome ?? "—"}
                  formatMoeda={formatMoeda}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {contratosPausados.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Contratos pausados</h2>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Cliente</th>
                  <th className="px-4 py-2 text-center">Valor mensal</th>
                  <th className="px-4 py-2 text-center">Início</th>
                  <th className="px-4 py-2 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contratosPausados.map((contract) => (
                  <ContractRow
                    key={contract.id}
                    contract={contract}
                    clientNome={clientMap.get(contract.client_id)?.nome ?? "—"}
                    formatMoeda={formatMoeda}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Histórico de cancelamentos</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Cliente</th>
                <th className="px-4 py-2 text-center">Valor mensal</th>
                <th className="px-4 py-2 text-center">Cancelado em</th>
                <th className="px-4 py-2">Motivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contratosCancelados.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-slate-400">
                    Nenhum cancelamento registrado.
                  </td>
                </tr>
              )}
              {contratosCancelados.map((contract) => (
                <tr key={contract.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2 font-medium text-slate-800">
                    {clientMap.get(contract.client_id)?.nome ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-center text-slate-600">
                    {formatMoeda(Number(contract.valor_mensal))}
                  </td>
                  <td className="px-4 py-2 text-center text-slate-600">
                    {contract.data_fim ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-slate-500">
                    {contract.motivo_cancelamento || "—"}
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
