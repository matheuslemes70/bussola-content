import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { isAtrasado, formatDate } from "@/lib/status";
import type { Post, PostStatus, User } from "@/lib/types";

const EM_PRODUCAO: PostStatus[] = ["a_produzir", "em_producao", "pronto_pra_editar", "alterar"];

function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, clients(nome)")
    .neq("status", "publicado")
    .eq("arquivado", false);

  if (error) {
    console.error("[cron/atrasados] erro ao buscar posts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const atrasados = ((posts as (Post & { clients: { nome: string } | null })[]) ?? []).filter(
    (p) => isAtrasado(p)
  );

  if (atrasados.length === 0) {
    return NextResponse.json({ ok: true, notificados: 0 });
  }

  const { data: users } = await supabase.from("users").select("id, nome, email, ativo");
  const usersById = new Map(((users as User[]) ?? []).map((u) => [u.id, u]));

  // Para cada usuário, separa os posts em que ele é executor e em que é dono da demanda.
  type Papel = "executor" | "dono";
  const porUsuario = new Map<string, { executor: typeof atrasados; dono: typeof atrasados }>();

  function adicionar(userId: string, papel: Papel, post: (typeof atrasados)[number]) {
    if (!porUsuario.has(userId)) porUsuario.set(userId, { executor: [], dono: [] });
    porUsuario.get(userId)![papel].push(post);
  }

  // Atraso de produção (conta pela data de entrega) vai para o executor e
  // para o dono. Atraso de publicação (já entregue, falta publicar) vai só
  // para o dono: o executor já fez a parte dele.
  for (const post of atrasados) {
    const deProducao = EM_PRODUCAO.includes(post.status);
    if (deProducao && post.responsavel_id) adicionar(post.responsavel_id, "executor", post);
    if (post.dono_id && (post.dono_id !== post.responsavel_id || !deProducao)) adicionar(post.dono_id, "dono", post);
  }

  let notificados = 0;

  for (const [userId, grupos] of Array.from(porUsuario.entries())) {
    const user = usersById.get(userId);
    if (!user?.email || user.ativo === false) continue;

    const totalPosts = grupos.executor.length + grupos.dono.length;
    if (totalPosts === 0) continue;

    const listaHtml = (lista: typeof atrasados) => {
      return lista
        .map(
          (p) =>
            `<li><strong>${p.clients?.nome ?? "Cliente"}</strong> — ${p.titulo} (${
              EM_PRODUCAO.includes(p.status)
                ? `entrega era ${formatDate(p.data_entrega)}`
                : `publicação era ${formatDate(p.data_publicacao_planejada)}`
            })</li>`
        )
        .join("");
    };

    let html = `<p>Olá, ${user.nome}!</p>`;
    if (grupos.executor.length > 0) {
      html += `<p>Você tem <strong>${grupos.executor.length}</strong> post(s) atrasado(s) para <strong>produzir</strong>:</p><ul>${listaHtml(grupos.executor)}</ul>`;
    }
    if (grupos.dono.length > 0) {
      html += `<p>Como <strong>dono da demanda</strong>, estes posts estão fora do prazo e podem precisar da sua atenção (briefing, aprovação do cliente ou publicação):</p><ul>${listaHtml(grupos.dono)}</ul>`;
    }
    html += `<p>Acesse <a href="https://app.bussolamedia.com.br">app.bussolamedia.com.br</a> para atualizar.</p>`;

    await sendEmail({
      to: user.email,
      subject: `⚠️ ${totalPosts} post(s) atrasado(s) na Bússola`,
      html,
    });
    notificados++;
  }

  return NextResponse.json({ ok: true, notificados, totalAtrasados: atrasados.length });
}
