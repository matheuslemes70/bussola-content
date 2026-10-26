import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { isAtrasado, formatDate, hojeBrasilia } from "@/lib/status";
import { gerarSemana, diaDaSemana } from "@/lib/rotina";
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

  // 0) Segunda tentativa da rotina semanal: se a de domingo à noite falhou,
  // lança agora. Se já lançou, nada se repete (chave da rotina).
  let rotinaSegunda: number | null = null;
  if (diaDaSemana(hojeBrasilia()) === 1) {
    const r = await gerarSemana(supabase, { hoje: hojeBrasilia() });
    if (r.erro) console.error("[cron/atrasados] rotina de segunda:", r.erro);
    rotinaSegunda = r.criados;
  }

  // 1) Agendados cuja data de publicação já passou viram "Publicado".
  const { data: publicadosAgora } = await supabase
    .from("posts")
    .update({ status: "publicado" })
    .eq("status", "agendado")
    .lt("data_publicacao_planejada", hojeBrasilia())
    .select("id");

  // 2) Atrasos: e-mail + aviso no sino para cada pessoa.
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*, clients(nome, responsavel_id, status)")
    .neq("status", "publicado")
    .eq("arquivado", false);

  if (error) {
    console.error("[cron/atrasados] erro ao buscar posts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const atrasados = ((posts as (Post & { clients: { nome: string; responsavel_id: string | null; status: string } | null })[]) ?? []).filter(
    // Cliente inativo (pausado) não gera cobrança.
    (p) => p.clients?.status === "ativo" && isAtrasado(p)
  );

  if (atrasados.length === 0) {
    return NextResponse.json({ ok: true, notificados: 0, agendadosPublicados: publicadosAgora?.length ?? 0, rotinaSegunda });
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
    // Sem dono definido, quem acompanha é a social media responsável pelo cliente.
    const dono = post.dono_id ?? post.clients?.responsavel_id ?? null;
    if (dono && (dono !== post.responsavel_id || !deProducao)) adicionar(dono, "dono", post);
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

    // Aviso no sino (um por pessoa por dia, com o resumo)
    const partes = [
      grupos.executor.length ? `${grupos.executor.length} pra produzir` : null,
      grupos.dono.length ? `${grupos.dono.length} pra acompanhar (revisão, cliente ou publicação)` : null,
    ].filter(Boolean);
    await supabase.from("notifications").insert({
      user_id: userId,
      post_id: null,
      tipo: "geral",
      mensagem: `Bom dia! Você tem ${totalPosts} post${totalPosts > 1 ? "s" : ""} fora do prazo: ${partes.join(" e ")}. Veja na Minha mesa.`,
    });
    notificados++;
  }

  return NextResponse.json({
    ok: true,
    notificados,
    totalAtrasados: atrasados.length,
    agendadosPublicados: publicadosAgora?.length ?? 0,
    rotinaSegunda,
  });
}
