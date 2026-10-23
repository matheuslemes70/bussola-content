import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { FORMAT_LABELS, STATUS_LABELS, formatDate, formatDateTime } from "@/lib/status";
import { ApprovalActions } from "@/components/approval/ApprovalActions";
import { CopyCaption } from "@/components/posts/CopyCaption";
import { RichText } from "@/components/ui/RichText";
import type { Post, Client, Comment } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ApprovalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  const { data: post } = await supabase
    .from("posts")
    .select("*")
    .eq("public_token", token)
    .single();

  if (!post) notFound();
  const p = post as Post;

  const [{ data: client }, { data: comments }] = await Promise.all([
    supabase.from("clients").select("*").eq("id", p.client_id).single(),
    supabase
      .from("comments")
      .select("*")
      .eq("post_id", p.id)
      .eq("tipo", "cliente")
      .order("created_at"),
  ]);

  const c = client as Client | null;
  const clienteComentarios = (comments as Comment[]) ?? [];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-black py-5">
        <div className="mx-auto max-w-2xl px-4">
          <p className="text-2xl font-extrabold tracking-tight text-bussola-yellow">
            Bússola <span className="font-light text-white">Media</span>
          </p>
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">
            Aprovação de conteúdo{c ? ` — ${c.nome}` : ""}
          </h1>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">{p.titulo}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
              {STATUS_LABELS[p.status]}
            </span>
          </div>

          <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs uppercase text-slate-400">Formato</dt>
              <dd className="text-slate-700">{FORMAT_LABELS[p.formato]}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-400">Data planejada</dt>
              <dd className="text-slate-700">{formatDate(p.data_publicacao_planejada)}</dd>
            </div>
          </dl>

          {p.delivered_link ? (
            <a
              href={p.delivered_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-bussola-blue px-4 py-2 text-sm font-medium text-white hover:brightness-110"
            >
              Ver conteúdo
            </a>
          ) : (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-400">
              O conteúdo ainda não foi anexado pela equipe.
            </p>
          )}

          {p.ideia && (
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-medium uppercase text-slate-400">Ideia do post</p>
                <CopyCaption text={p.ideia} />
              </div>
              <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><RichText text={p.ideia} /></p>
            </div>
          )}
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-slate-400">Legenda</p>
              {p.caption && <CopyCaption text={p.caption} />}
            </div>
            <p className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {p.caption ? <RichText text={p.caption} /> : <span className="text-slate-400">Sem legenda.</span>}
            </p>
          </div>
        </div>

        {clienteComentarios.length > 0 && (
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">
              Histórico de comentários
            </h3>
            <div className="space-y-3">
              {clienteComentarios.map((cm) => (
                <div key={cm.id} className="rounded-lg bg-slate-50 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      {cm.author_name || "Cliente"}
                    </span>
                    <span className="text-xs text-slate-400">{formatDateTime(cm.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{cm.texto}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold uppercase text-slate-400">Sua avaliação</h3>
          <ApprovalActions token={token} status={p.status} />
        </div>
      </div>
    </div>
  );
}
