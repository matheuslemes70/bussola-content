import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { canManagePosts, canDeletePosts, canViewDataPublicacao } from "@/lib/permissions";
import {
  STATUS_LABELS,
  FORMAT_LABELS,
  formatDate,
  formatDateTime,
  isAtrasado,
} from "@/lib/status";
import { StatusBadge, AtrasadoBadge } from "@/components/ui/Badge";
import { PostFormModal } from "@/components/posts/PostFormModal";
import { ApprovalLink } from "@/components/posts/ApprovalLink";
import { CopyCaption } from "@/components/posts/CopyCaption";
import { CopyButton } from "@/components/posts/CopyButton";
import { DeletePostButton } from "@/components/posts/DeletePostButton";
import { ArchiveButton } from "@/components/posts/ArchiveButton";
import { InternalChat } from "@/components/posts/InternalChat";
import { Checklist } from "@/components/posts/Checklist";
import { ReferenceLinks } from "@/components/posts/ReferenceLinks";
import { Attachments } from "@/components/posts/Attachments";

import { RichText } from "@/components/ui/RichText";
import type {
  Post, Client, User, Comment, PostStatusHistory, ChecklistItem, PostReferenceLink, PostAttachment,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const supabase = await createClient();
  const me = await getCurrentUser();

  const [{ data: post }, { data: users }, { data: comments }, { data: history }, { data: checklist }, { data: refLinks }, { data: attachments }] =
    await Promise.all([
      supabase.from("posts").select("*").eq("id", postId).single(),
      supabase.from("users").select("*").eq("ativo", true).order("nome"),
      supabase.from("comments").select("*").eq("post_id", postId).order("created_at"),
      supabase.from("post_status_history").select("*").eq("post_id", postId).order("created_at"),
      supabase.from("post_checklist_items").select("*").eq("post_id", postId).order("created_at"),
      supabase.from("post_reference_links").select("*").eq("post_id", postId).order("created_at"),
      supabase.from("post_attachments").select("*").eq("post_id", postId).order("created_at"),
    ]);

  if (!post) notFound();
  const p = post as Post;

  const { data: client } = await supabase
    .from("clients").select("*").eq("id", p.client_id).single();
  const c = client as Client | null;

  const allUsers = (users as User[]) ?? [];
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  const internas = (comments as Comment[]).filter((x) => x.tipo === "interno");
  const doCliente = (comments as Comment[]).filter((x) => x.tipo === "cliente");
  const hist = (history as PostStatusHistory[]) ?? [];
  const checklistItems = (checklist as ChecklistItem[]) ?? [];
  const refLinksList = (refLinks as PostReferenceLink[]) ?? [];
  const attachmentsList = (attachments as PostAttachment[]) ?? [];
  const resp = p.responsavel_id ? userMap.get(p.responsavel_id) : null;
  const dono = p.dono_id ? userMap.get(p.dono_id) : null;
  const atrasado = isAtrasado(p);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const pode = canManagePosts(me?.perfil);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {c && (
            <Link href={`/clientes/${c.id}`} className="text-sm text-slate-400 hover:underline">
              ← {c.nome}
            </Link>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="break-words text-2xl font-bold text-slate-800">{p.titulo}</h1>
            <StatusBadge status={p.status} />
            {atrasado && <AtrasadoBadge />}
          </div>
        </div>
        {pode && (
          <div className="flex flex-shrink-0 gap-2">
            <PostFormModal
              users={allUsers}
              fixedClientId={p.client_id}
              post={p}
              podeVerDataPublicacao={canViewDataPublicacao(me?.perfil)}
              triggerLabel="Editar"
              triggerClass="rounded-lg bg-bussola-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110"
            />
            <ArchiveButton postId={p.id} titulo={p.titulo} />
            {canDeletePosts(me?.perfil) && (
              <DeletePostButton postId={p.id} titulo={p.titulo} />
            )}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna principal */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Detalhes</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Info label="Formato" value={FORMAT_LABELS[p.formato]} />
              <Info label="Status" value={STATUS_LABELS[p.status]} />
              <Info label="Data de entrega" value={formatDate(p.data_entrega)} />
              {canViewDataPublicacao(me?.perfil) && (
                <Info label="Data de publicação" value={formatDate(p.data_publicacao_planejada)} />
              )}
              <Info label="Executor" value={resp?.nome || resp?.email || "—"} />
              <Info label="Dono da demanda" value={dono?.nome || dono?.email || "—"} />
              <Info label="Conteúdo entregue" value={
                p.delivered_link ? (
                  <span className="flex items-center gap-2">
                    <a href={p.delivered_link} target="_blank" rel="noopener noreferrer"
                      className="text-bussola-blue hover:underline">Abrir entrega</a>
                    <CopyButton text={p.delivered_link} label="Copiar link do Drive" />
                  </span>
                ) : "—"
              } />
            </dl>
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">Links de referência</p>
              <ReferenceLinks postId={p.id} links={refLinksList} canEdit={pode} />
            </div>
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">Imagens de referência</p>
              <Attachments postId={p.id} attachments={attachmentsList} canEdit={pode} />
            </div>
            {p.ideia && (
              <div className="mt-4">
                <p className="mb-1 text-xs font-medium uppercase text-slate-400">Ideia do post (o cliente vê)</p>
                <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  <RichText text={p.ideia} />
                </p>
              </div>
            )}
            <div className="mt-4">
              <p className="mb-1 text-xs font-medium uppercase text-slate-400">Briefing (interno)</p>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {p.briefing ? <RichText text={p.briefing} /> : <span className="text-slate-400">Sem briefing.</span>}
              </p>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium uppercase text-slate-400">Legenda (publicação)</p>
                <CopyCaption text={p.caption} />
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  {p.caption ? <RichText text={p.caption} /> : <span className="text-slate-400">Sem legenda.</span>}
              </p>
            </div>
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">
              Checklist
            </h2>
            <Checklist postId={p.id} items={checklistItems} />
          </section>

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">
              Chat de feedback interno
            </h2>
            <InternalChat postId={p.id} comments={internas} users={allUsers} />
          </section>

          {doCliente.length > 0 && (
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">
                Comentários do cliente (aprovação)
              </h2>
              <div className="space-y-3">
                {doCliente.map((cm) => (
                  <div key={cm.id} className="rounded-lg bg-amber-50 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold text-amber-800">
                        {cm.author_name || "Cliente"}
                      </span>
                      <span className="text-xs text-slate-400">{formatDateTime(cm.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{cm.texto}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Coluna lateral */}
        <div className="space-y-6">
          {pode && (
            <section className="rounded-xl bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">Aprovação</h2>
              <ApprovalLink postId={p.id} token={p.public_token} baseUrl={baseUrl} />
            </section>
          )}

          <section className="rounded-xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase text-slate-400">
              Histórico de status
            </h2>
            <ol className="space-y-3">
              {hist.map((h) => {
                const who = h.changed_by ? userMap.get(h.changed_by) : null;
                return (
                  <li key={h.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-bussola-yellow" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{STATUS_LABELS[h.status]}</p>
                      <p className="text-xs text-slate-400">
                        {formatDateTime(h.created_at)} · {who?.nome || who?.email || "Sistema/Cliente"}
                      </p>
                    </div>
                  </li>
                );
              })}
              {hist.length === 0 && <li className="text-sm text-slate-400">Sem histórico.</li>}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase text-slate-400">{label}</dt>
      <dd className="mt-0.5 break-words text-slate-700">{value}</dd>
    </div>
  );
}
