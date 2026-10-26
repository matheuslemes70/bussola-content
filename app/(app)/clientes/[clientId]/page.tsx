import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getCurrentUser } from "@/lib/auth";
import { canCreatePosts, canEditBrandCore, canManageClients, canManagePosts, canViewDataPublicacao } from "@/lib/permissions";
import { CLIENT_STATUS_LABELS } from "@/lib/status";
import { Kanban } from "@/components/kanban/Kanban";
import { BrandCoreForm } from "@/components/clients/BrandCoreForm";
import { AccessesManager } from "@/components/clients/AccessesManager";
import { Calendar } from "@/components/clients/Calendar";
import { FilesManager } from "@/components/clients/FilesManager";
import { PostFormModal } from "@/components/posts/PostFormModal";
import { BulkPostGenerator } from "@/components/posts/BulkPostGenerator";
import { ClientFormModal } from "@/components/clients/ClientFormModal";
import { RotinaSemanal } from "@/components/clients/RotinaSemanal";
import { semanaAlvo } from "@/lib/rotina";
import { hojeBrasilia } from "@/lib/status";
import type { Client, Post, User, BrandCore, FileFolder, DriveFile, ClientAccess, PautaApproval } from "@/lib/types";

export const dynamic = "force-dynamic";

type Tab = "conteudo" | "calendario" | "rotina" | "brand" | "arquivos";
const TABS: { id: Tab; label: string }[] = [
  { id: "conteudo", label: "Conteúdo" },
  { id: "calendario", label: "Calendário" },
  { id: "rotina", label: "Rotina" },
  { id: "brand", label: "Sobre" },
  { id: "arquivos", label: "Arquivos" },
];

export default async function ClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ clientId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { clientId } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const me = await getCurrentUser();

  const podeGerir = canManageClients(me?.perfil);
  const podeVerCalendario = canViewDataPublicacao(me?.perfil);
  const tabsVisiveis: Tab[] = podeVerCalendario
    ? podeGerir
      ? ["conteudo", "calendario", "rotina", "brand", "arquivos"]
      : ["conteudo", "calendario", "brand", "arquivos"]
    : ["conteudo", "brand", "arquivos"];
  const activeTab: Tab = (tabsVisiveis.includes(tab as Tab) ? tab : "conteudo") as Tab;

  const [{ data: client }, { data: posts }, { data: users }, { data: brand }, { data: folders }, { data: files }, { data: pautas }, accessesRes] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase.from("posts").select("*").eq("client_id", clientId).eq("arquivado", false).order("data_publicacao_planejada"),
      supabase.from("users").select("*").eq("ativo", true).order("nome"),
      supabase.from("brand_core").select("*").eq("client_id", clientId).maybeSingle(),
      supabase.from("file_folders").select("*").eq("client_id", clientId).order("nome"),
      supabase.from("files").select("*").eq("client_id", clientId).order("nome"),
      supabase.from("pauta_approvals").select("*").eq("client_id", clientId),
      podeGerir
        ? supabase.from("client_accesses").select("*").eq("client_id", clientId).order("created_at")
        : Promise.resolve({ data: [] as ClientAccess[] }),
    ]);
  const { data: rotina } =
    activeTab === "rotina"
      ? await supabase.from("rotina_semanal").select("*").eq("client_id", clientId).eq("ativo", true)
      : { data: [] };

  const accesses = ((accessesRes.data as ClientAccess[]) ?? []).map((a) => ({ ...a, senha: decryptSecret(a.senha) }));
  const allPautas = (pautas as PautaApproval[]) ?? [];

  if (!client) notFound();

  const c = client as Client;
  const allPosts = (posts as Post[]) ?? [];
  const hojeSP = new Date();
  const mesAtual = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(hojeSP).slice(0, 7);
  const nomeMes = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", month: "long" }).format(hojeSP);
  const postsDoMes = allPosts.filter((p) => p.data_entrega?.startsWith(mesAtual));
  const publicadosDoMes = postsDoMes.filter((p) => p.status === "publicado").length;
  const allUsers = (users as User[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/clientes" className="text-sm text-slate-400 hover:underline">
            ← Clientes
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">{c.nome}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs ${
              c.status === "ativo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}>
              {CLIENT_STATUS_LABELS[c.status]}
            </span>
          </div>
          {c.redes_sociais.length > 0 && (
            <p className="mt-1 text-sm text-slate-400">{c.redes_sociais.join(" · ")}</p>
          )}
        </div>
        <div className="flex gap-2">
          {canManageClients(me?.perfil) && (
            <ClientFormModal users={allUsers} cliente={c} triggerLabel="Editar cliente"
              triggerClass="rounded-lg bg-bussola-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110" />
          )}
          {canCreatePosts(me?.perfil) && (
            <>
              <PostFormModal users={allUsers} fixedClientId={c.id} podeVerDataPublicacao={canViewDataPublicacao(me?.perfil)} triggerLabel="+ Novo post" />
              <BulkPostGenerator clientId={c.id} users={allUsers} />
            </>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        <span className="font-semibold capitalize text-slate-700">{nomeMes}</span>
        {": "}{postsDoMes.length} {postsDoMes.length === 1 ? "post" : "posts"} no mês
        {" ("}{publicadosDoMes} {publicadosDoMes === 1 ? "postado" : "postados"}{")"}
      </p>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.filter((t) => tabsVisiveis.includes(t.id)).map((t) => (
          <Link key={t.id} href={`/clientes/${c.id}?tab=${t.id}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition ${
              activeTab === t.id
                ? "border-bussola-yellow font-semibold text-black"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}>
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "conteudo" && (
        allPosts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
            Nenhum post para este cliente ainda.
          </p>
        ) : (
          <Kanban
            posts={allPosts.map((p) => ({ ...p, data_publicacao_planejada: p.data_entrega }))}
            users={allUsers}
          />
        )
      )}

      {activeTab === "calendario" && (
        <Calendar
          clientId={c.id}
          posts={allPosts}
          users={allUsers}
          canCreate={canCreatePosts(me?.perfil)}
          pautas={allPautas}
          canSendPauta={canManageClients(me?.perfil)}
        />
      )}

      {activeTab === "rotina" && (
        <RotinaSemanal
          clientId={c.id}
          itens={(rotina as { id: string; dia_semana: number; formato: Post["formato"]; executor_id: string; dias_antes: number; turno: "manha" | "tarde" | "noite" | null }[]) ?? []}
          users={allUsers}
          podeEditar={podeGerir}
          semana={semanaAlvo(hojeBrasilia())}
        />
      )}

      {activeTab === "brand" && (
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <BrandCoreForm
            clientId={c.id}
            brandCore={(brand as BrandCore) ?? null}
            canEdit={canEditBrandCore(me?.perfil)}
          />
          {podeGerir && <AccessesManager clientId={c.id} accesses={accesses} />}
        </div>
      )}

      {activeTab === "arquivos" && (
        <FilesManager
          clientId={c.id}
          folders={(folders as FileFolder[]) ?? []}
          files={(files as DriveFile[]) ?? []}
          canEdit={canManagePosts(me?.perfil)}
        />
      )}
    </div>
  );
}
