import type { Post, PostStatus, PostFormat, ClientStatus, PautaStatus } from "./types";

export const PAUTA_STATUS_LABELS: Record<PautaStatus, string> = {
  pendente: "Aguardando resposta",
  aprovada: "Pauta aprovada",
  ajustes_solicitados: "Ajustes solicitados",
};

export const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ---------- Labels ----------
export const STATUS_LABELS: Record<PostStatus, string> = {
  a_produzir: "A produzir",
  em_producao: "Em produção",
  pronto_pra_editar: "Pronto pra editar",
  para_aprovacao: "Para aprovação",
  alterar: "Alterar",
  aprovado: "Aprovado",
  publicado: "Publicado",
};

export const FORMAT_LABELS: Record<PostFormat, string> = {
  estatico: "Estático",
  carrossel: "Carrossel",
  reels: "Reels",
  story: "Story",
};

// Cor por formato (usada no calendário e legendas)
export const FORMAT_COLORS: Record<PostFormat, string> = {
  estatico: "bg-blue-500",
  carrossel: "bg-purple-500",
  reels: "bg-pink-500",
  story: "bg-amber-500",
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
};

// Ordem do fluxo de transição (usada nos seletores de status)
export const STATUS_FLOW: PostStatus[] = [
  "a_produzir",
  "em_producao",
  "pronto_pra_editar",
  "para_aprovacao",
  "alterar",
  "aprovado",
  "publicado",
];

// Ordem de exibição das colunas no kanban (definida pelo usuário)
export const KANBAN_COLUMN_ORDER: PostStatus[] = [
  "a_produzir",
  "pronto_pra_editar",
  "em_producao",
  "para_aprovacao",
  "alterar",
  "aprovado",
  "publicado",
];

// Cores (classes Tailwind) por status
export const STATUS_COLORS: Record<PostStatus, string> = {
  a_produzir: "bg-slate-100 text-slate-700",
  em_producao: "bg-cyan-200 text-cyan-800",
  pronto_pra_editar: "bg-purple-200 text-purple-800",
  para_aprovacao: "bg-amber-100 text-amber-700",
  alterar: "bg-orange-100 text-orange-700",
  aprovado: "bg-emerald-100 text-emerald-700",
  publicado: "bg-green-600 text-white",
};

// Posts "a fazer" = ainda em etapa de produção (não conta aprovado nem publicado).
const A_FAZER_STATUS: PostStatus[] = ["a_produzir", "em_producao", "pronto_pra_editar", "alterar"];

export function isAFazer(post: Pick<Post, "status">): boolean {
  return A_FAZER_STATUS.includes(post.status);
}

// ---------- Lógica de "Atrasado" ----------
// Post está atrasado quando a data planejada já passou e ainda não foi publicado.
// Etapas em que o executor ainda esta trabalhando (atraso conta pela data de entrega).
const EM_PRODUCAO_STATUS: PostStatus[] = ["a_produzir", "pronto_pra_editar", "em_producao", "alterar"];
// Etapas em que ja foi entregue e so falta publicar (atraso conta pela data de publicacao).
const AGUARDANDO_PUBLICACAO_STATUS: PostStatus[] = ["para_aprovacao", "aprovado"];

// "Hoje" sempre no horário de Brasília (o servidor roda em UTC; sem isso,
// às 21h um post com entrega para hoje já virava "atrasado").
export function hojeBrasilia(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function isAtrasado(
  post: Pick<Post, "data_publicacao_planejada" | "data_entrega" | "status">
): boolean {
  if (post.status === "publicado") return false;
  const hoje = hojeBrasilia(); // YYYY-MM-DD

  if (EM_PRODUCAO_STATUS.includes(post.status)) {
    if (!post.data_entrega) return false;
    return post.data_entrega < hoje;
  }

  if (AGUARDANDO_PUBLICACAO_STATUS.includes(post.status)) {
    if (!post.data_publicacao_planejada) return false;
    return post.data_publicacao_planejada < hoje;
  }

  return false;
}

export function publicadoEsteMes(post: Pick<Post, "status" | "data_publicacao_planejada">): boolean {
  if (post.status !== "publicado") return false;
  if (!post.data_publicacao_planejada) return false;
  const d = new Date(post.data_publicacao_planejada + "T00:00:00");
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? value + "T00:00:00" : value);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

// Post "vence em breve" = ainda não atrasado, mas com vencimento nos próximos 2 dias.
export function isProximoDoVencimento(
  post: Pick<Post, "data_publicacao_planejada" | "data_entrega" | "status">
): boolean {
  if (post.status === "publicado") return false;
  if (isAtrasado(post)) return false;

  let dataRelevante: string | null = null;
  if (EM_PRODUCAO_STATUS.includes(post.status)) {
    dataRelevante = post.data_entrega;
  } else if (AGUARDANDO_PUBLICACAO_STATUS.includes(post.status)) {
    dataRelevante = post.data_publicacao_planejada;
  }
  if (!dataRelevante) return false;

  const hoje = new Date(hojeBrasilia() + "T00:00:00").getTime();
  const data = new Date(dataRelevante.slice(0, 10) + "T00:00:00").getTime();
  const diffDias = Math.round((data - hoje) / (1000 * 60 * 60 * 24));
  return diffDias >= 0 && diffDias <= 2;
}

// ---------- Prospecção (CRM) ----------
export const PROSPECT_ETAPA_LABELS: Record<string, string> = {
  lead: "Lead",
  contato: "Contato",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
};

export const PROSPECT_ETAPA_ORDER: string[] = ["lead", "contato", "proposta", "fechado", "perdido"];

export const PROSPECT_ORIGEM_LABELS: Record<string, string> = {
  organico: "Orgânico",
  pago: "Pago",
  indicacao: "Indicação",
  outbound: "Outbound",
};

export const PROSPECT_ETAPA_COLORS: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700",
  contato: "bg-blue-100 text-blue-700",
  proposta: "bg-amber-100 text-amber-700",
  fechado: "bg-emerald-100 text-emerald-700",
  perdido: "bg-red-100 text-red-700",
};
