import type { UserRole } from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  social_media: "Social Media",
  designer: "Designer",
  editor: "Editor",
  gestor_projetos: "Gestora de Projetos",
};

// Regras de permissão (espelham as policies de RLS no banco).
// Usadas para esconder/desabilitar ações na UI E nas Server Actions:
// as listas abaixo são a fonte única — tela, servidor e banco seguem as mesmas.
//
// Decisões (out/2026):
// - Gestora de Projetos: cria/edita clientes e exclui posts; não mexe em
//   equipe, prospecção nem financeiro.
// - Editor e designer não criam posts (só editam o que recebem).
export const ROLES_GESTAO: UserRole[] = ["admin", "social_media", "gestor_projetos"];
export const ROLES_ADMIN: UserRole[] = ["admin"];

export function canManageClients(role: UserRole | undefined): boolean {
  return role !== undefined && ROLES_GESTAO.includes(role);
}

export function canEditBrandCore(role: UserRole | undefined): boolean {
  return canManageClients(role);
}

export function canViewBrandCore(role: UserRole | undefined): boolean {
  // Todos os perfis autenticados visualizam o Brand Core.
  return role !== undefined;
}

export function canManagePosts(role: UserRole | undefined): boolean {
  // Todos os perfis autenticados editam os posts que recebem.
  return role !== undefined;
}

export function canCreatePosts(role: UserRole | undefined): boolean {
  // Quem cria demanda é a gestão; editor e designer executam.
  return role !== undefined && ROLES_GESTAO.includes(role);
}

export function canDeletePosts(role: UserRole | undefined): boolean {
  return role !== undefined && ROLES_GESTAO.includes(role);
}

export function canManageTeam(role: UserRole | undefined): boolean {
  return role === "admin";
}

// Visão da equipe e Indicadores
export function canViewAdminPanels(role: UserRole | undefined): boolean {
  return role === "admin" || role === "gestor_projetos";
}

export function canViewProspeccao(role: UserRole | undefined): boolean {
  return role === "admin";
}

export function canViewFinanceiro(role: UserRole | undefined): boolean {
  return role === "admin";
}

// Data de publicacao (quando vai ao ar) so e visivel para quem gerencia a
// conta do cliente e o cliente em si. Editor/Designer veem so a data de
// entrega (quando devem produzir), que pode ser diferente.
export function canViewDataPublicacao(role: UserRole | undefined): boolean {
  return role === "admin" || role === "social_media" || role === "gestor_projetos";
}
