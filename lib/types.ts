// Tipos compartilhados do domínio Bússola.
// (Quando o schema estabilizar, dá pra gerar via `supabase gen types typescript`.)

export type UserRole = "admin" | "social_media" | "designer" | "editor" | "gestor_projetos";
export type ClientStatus = "ativo" | "pausado";
export type PostFormat = "estatico" | "carrossel" | "reels" | "story";
export type PostStatus =
  | "a_produzir"
  | "em_producao"
  | "pronto_pra_editar"
  | "revisao_interna"
  | "para_aprovacao"
  | "alterar"
  | "aprovado"
  | "publicado";
export type CommentType = "interno" | "cliente";
export type PautaStatus = "pendente" | "aprovada" | "ajustes_solicitados";

export interface User {
  id: string;
  nome: string;
  email: string;
  perfil: UserRole;
  ativo: boolean;
  created_at: string;
}

export interface Client {
  id: string;
  nome: string;
  avatar_url: string | null;
  redes_sociais: string[];
  responsavel_id: string | null;
  status: ClientStatus;
  created_at: string;
}

export interface BrandCore {
  id: string;
  client_id: string;
  persona: string;
  diagnostico: string;
  concorrencia: string;
  posicionamento: string;
  esteira_produtos: string;
  updated_at: string;
}

export interface ClientAccess {
  id: string;
  client_id: string;
  plataforma: string;
  usuario: string;
  senha: string;
  created_at: string;
}

export interface Post {
  id: string;
  client_id: string;
  titulo: string;
  briefing: string;
  caption: string;
  formato: PostFormat;
  reference_link: string | null;
  delivered_link: string | null;
  data_publicacao_planejada: string | null;
  horario_publicacao_planejada: string | null;
  arquivado: boolean;
  ideia: string;
  data_entrega: string | null;
  status: PostStatus;
  responsavel_id: string | null;
  dono_id: string | null;
  public_token: string | null;
  ordem: number | null;
  created_at: string;
  updated_at: string;
}

export interface ChecklistItem {
  id: string;
  post_id: string;
  texto: string;
  concluido: boolean;
  created_at: string;
}

export interface PostStatusHistory {
  id: string;
  post_id: string;
  status: PostStatus;
  changed_by: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string | null;
  author_name: string | null;
  texto: string;
  tipo: CommentType;
  created_at: string;
}

export interface FileFolder {
  id: string;
  client_id: string;
  nome: string;
  parent_id: string | null;
  created_at: string;
}

export interface DriveFile {
  id: string;
  folder_id: string | null;
  client_id: string;
  nome: string;
  drive_link: string;
  created_at: string;
}

export interface PautaApproval {
  id: string;
  client_id: string;
  ano: number;
  mes: number;
  token: string;
  status: PautaStatus;
  incluir_briefing: boolean;
  comentario: string | null;
  autor_resposta: string | null;
  created_at: string;
  responded_at: string | null;
  data_inicio: string | null;
  data_fim: string | null;
}

// Joins úteis
export type ClientWithResponsavel = Client & { responsavel: User | null };
export type PostWithRelations = Post & {
  client: Client | null;
  responsavel: User | null;
};

export type ProspectOrigem = "organico" | "pago" | "indicacao" | "outbound";
export type ProspectEtapa = "lead" | "contato" | "proposta" | "fechado" | "perdido";

export interface Prospect {
  id: string;
  nome: string;
  contato: string;
  origem: ProspectOrigem;
  etapa: ProspectEtapa;
  valor_estimado: number | null;
  observacoes: string;
  responsavel_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PostReferenceLink {
  id: string;
  post_id: string;
  label: string;
  url: string;
  created_at: string;
}

export interface PostAttachment {
  id: string;
  post_id: string;
  storage_path: string;
  nome: string;
  created_at: string;
}

export type ContractStatus = "ativo" | "pausado" | "cancelado";

export interface ClientContract {
  id: string;
  client_id: string;
  valor_mensal: number;
  data_inicio: string;
  data_fim: string | null;
  status: ContractStatus;
  motivo_cancelamento: string;
  created_at: string;
  updated_at: string;
}

export type ClientContractWithClient = ClientContract & { client: Client | null };

export interface MetaFinanceira {
  id: string;
  mes: number;
  ano: number;
  valor_meta: number;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  post_id: string | null;
  tipo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}
