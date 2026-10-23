import type { UserRole } from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  social_media: "Social Media",
  designer: "Designer",
  editor: "Editor",
  gestor_projetos: "Gestora de Projetos",
};

// Regras de permissão (espelham as policies de RLS no banco).
// Usadas para esconder/desabilitar ações na UI.

export function canManageClients(role: UserRole | undefined): boolean {
  return role === "admin" || role === "social_media" || role === "gestor_projetos";
}

export function canEditBrandCore(role: UserRole | undefined): boolean {
  return role === "admin" || role === "social_media" || role === "gestor_projetos";
}

export function canViewBrandCore(role: UserRole | undefined): boolean {
  // Todos os perfis autenticados visualizam o Brand Core.
  return role !== undefined;
}

export function canManagePosts(role: UserRole | undefined): boolean {
  // Todos os perfis autenticados criam/editam posts.
  return role !== undefined;
}

export function canDeletePosts(role: UserRole | undefined): boolean {
  return role === "admin" || role === "social_media" || role === "gestor_projetos";
}

export function canManageTeam(role: UserRole | undefined): boolean {
  return role === "admin" || role === "gestor_projetos";
}

export function canViewAdminPanels(role: UserRole | undefined): boolean {
  return role === "admin" || role === "gestor_projetos";
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
