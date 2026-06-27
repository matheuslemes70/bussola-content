import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./email";
import { MESES_PT } from "./status";
import type { Post, Client, User, PautaApproval, PautaStatus } from "./types";

type Ctx = {
  post: Post;
  client: Client | null;
  responsavel: User | null;
  gestor: User | null; // responsável interno do cliente
};

function postUrl(postId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  return `${base}/posts/${postId}`;
}

// Escapa valores dinâmicos interpolados no HTML do e-mail (anti-injeção/phishing).
function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(title: string, body: string, postId: string) {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
      <div style="background:#000;padding:16px 20px">
        <span style="color:#F9B800;font-size:20px;font-weight:800">Bússola</span>
        <span style="color:#fff;font-weight:300"> Media</span>
      </div>
      <div style="padding:20px">
        <h2 style="color:#111;font-size:18px;margin:0 0 12px">${title}</h2>
        <div style="color:#333;font-size:14px;line-height:1.5">${body}</div>
        <a href="${postUrl(postId)}"
          style="display:inline-block;margin-top:16px;background:#0A48C4;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">
          Abrir post
        </a>
      </div>
    </div>`;
}

// Carrega post + cliente + responsável do post + gestor do cliente.
async function loadCtx(supabase: SupabaseClient, postId: string): Promise<Ctx | null> {
  const { data: post } = await supabase.from("posts").select("*").eq("id", postId).single();
  if (!post) return null;

  const { data: client } = await supabase
    .from("clients").select("*").eq("id", post.client_id).single();

  const responsavel = post.responsavel_id
    ? (await supabase.from("users").select("*").eq("id", post.responsavel_id).single()).data
    : null;

  const gestor = client?.responsavel_id
    ? (await supabase.from("users").select("*").eq("id", client.responsavel_id).single()).data
    : null;

  return { post, client, responsavel, gestor };
}

export async function notifyNewPost(supabase: SupabaseClient, postId: string) {
  const ctx = await loadCtx(supabase, postId);
  if (!ctx) return;
  const to = [ctx.responsavel?.email, ctx.gestor?.email];
  await sendEmail({
    to,
    subject: `Novo post atribuído a você — ${ctx.post.titulo}`,
    html: layout(
      "Novo post atribuído a você",
      `Você é o responsável pelo post <strong>${esc(ctx.post.titulo)}</strong>${
        ctx.client ? ` (cliente ${esc(ctx.client.nome)})` : ""
      }.`,
      ctx.post.id
    ),
  });
}

export async function notifyAwaitingApproval(supabase: SupabaseClient, postId: string) {
  const ctx = await loadCtx(supabase, postId);
  if (!ctx?.gestor?.email) return;
  await sendEmail({
    to: ctx.gestor.email,
    subject: `Post enviado para aprovação — ${ctx.post.titulo}`,
    html: layout(
      "Post aguardando aprovação",
      `O post <strong>${esc(ctx.post.titulo)}</strong>${
        ctx.client ? ` do cliente ${esc(ctx.client.nome)}` : ""
      } foi enviado para aprovação.`,
      ctx.post.id
    ),
  });
}

export async function notifyClientApproved(supabase: SupabaseClient, postId: string) {
  const ctx = await loadCtx(supabase, postId);
  if (!ctx) return;
  const to = [ctx.responsavel?.email, ctx.gestor?.email];
  await sendEmail({
    to,
    subject: `Cliente aprovou — ${ctx.post.titulo}`,
    html: layout(
      "Conteúdo aprovado pelo cliente",
      `O cliente aprovou o post <strong>${esc(ctx.post.titulo)}</strong>. Pode seguir para publicação.`,
      ctx.post.id
    ),
  });
}

export async function notifyClientRequestedChanges(
  supabase: SupabaseClient,
  postId: string,
  comment: string
) {
  const ctx = await loadCtx(supabase, postId);
  if (!ctx) return;
  const to = [ctx.responsavel?.email, ctx.gestor?.email];
  await sendEmail({
    to,
    subject: `Cliente solicitou ajuste — ${ctx.post.titulo}`,
    html: layout(
      "Cliente solicitou ajuste",
      `O cliente pediu ajustes no post <strong>${esc(ctx.post.titulo)}</strong>:<br><br>
       <em style="display:block;background:#fff7ed;border-left:3px solid #f59e0b;padding:10px 12px;color:#92400e">
       ${esc(comment)}</em>`,
      ctx.post.id
    ),
  });
}

// Resposta do cliente à pauta mensal → notifica o gestor do cliente.
export async function notifyPautaResponse(supabase: SupabaseClient, pautaId: string) {
  const { data: pauta } = await supabase
    .from("pauta_approvals").select("*").eq("id", pautaId).single();
  if (!pauta) return;
  const p = pauta as PautaApproval;

  const { data: client } = await supabase
    .from("clients").select("*").eq("id", p.client_id).single();
  const c = client as Client | null;

  const gestor = c?.responsavel_id
    ? (await supabase.from("users").select("*").eq("id", c.responsavel_id).single()).data as User | null
    : null;
  if (!gestor?.email) return;

  const aprovou = (p.status as PautaStatus) === "aprovada";
  const mesNome = `${MESES_PT[p.mes - 1]} ${p.ano}`;
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  const link = `${base}/clientes/${p.client_id}?tab=calendario`;

  await sendEmail({
    to: gestor.email,
    subject: `${aprovou ? "Pauta aprovada" : "Ajustes solicitados na pauta"} — ${c?.nome ?? ""} (${mesNome})`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
        <div style="background:#000;padding:16px 20px">
          <span style="color:#F9B800;font-size:20px;font-weight:800">Bússola</span>
          <span style="color:#fff;font-weight:300"> Media</span>
        </div>
        <div style="padding:20px;color:#333;font-size:14px;line-height:1.5">
          <h2 style="color:#111;font-size:18px;margin:0 0 12px">
            ${aprovou ? "Pauta aprovada pelo cliente" : "Cliente solicitou ajustes na pauta"}
          </h2>
          <p>Cliente <strong>${esc(c?.nome)}</strong> — pauta de <strong>${mesNome}</strong>.</p>
          ${p.comentario ? `<p><em style="display:block;background:#f8fafc;border-left:3px solid #94a3b8;padding:10px 12px">${esc(p.comentario)}</em></p>` : ""}
          ${p.autor_resposta ? `<p style="color:#64748b">Respondido por: ${esc(p.autor_resposta)}</p>` : ""}
          <a href="${link}" style="display:inline-block;margin-top:8px;background:#0A48C4;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:14px">Abrir calendário</a>
        </div>
      </div>`,
  });
}

export async function notifyStatusAlterar(supabase: SupabaseClient, postId: string) {
  const ctx = await loadCtx(supabase, postId);
  if (!ctx) return;
  const to = [ctx.responsavel?.email, ctx.gestor?.email];
  await sendEmail({
    to,
    subject: `Post movido para "Alterar" — ${ctx.post.titulo}`,
    html: layout(
      'Post movido para "Alterar"',
      `O post <strong>${esc(ctx.post.titulo)}</strong> foi movido para o status <strong>Alterar</strong> e precisa de ajustes.`,
      ctx.post.id
    ),
  });
}
