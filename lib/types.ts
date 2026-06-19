// Tipos compartilhados do domínio Bússola.
// (Quando o schema estabilizar, dá pra gerar via `supabase gen types typescript`.)

export type UserRole = "admin" | "social_media" | "designer" | "editor";
export type ClientStatus = "ativo" | "pausado";
export type PostFormat = "estatico" | "carrossel" | "reels" | "story";
export type PostStatus =
  | "a_produzir"
  | "em_producao"
  | "pronto_pra_editar"
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
  status: PostStatus;
  responsavel_id: string | null;
  public_token: string | null;
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
}

// Joins úteis
export type ClientWithResponsavel = Client & { responsavel: User | null };
export type PostWithRelations = Post & {
  client: Client | null;
  responsavel: User | null;
};
