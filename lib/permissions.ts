import type { UserRole } from "./types";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  social_media: "Social Media",
  designer: "Designer",
  editor: "Editor",
};

// Regras de permissão (espelham as policies de RLS no banco).
// Usadas para esconder/desabilitar ações na UI.

export function canManageClients(role: UserRole | undefined): boolean {
  return role === "admin" || role === "social_media";
}

export function canEditBrandCore(role: UserRole | undefined): boolean {
  return role === "admin" || role === "social_media";
}

export function canViewBrandCore(role: UserRole | undefined): boolean {
  // Todos os perfis autenticados visualizam o Brand Core.
  return role !== undefined;
}

export function canManagePosts(role: UserRole | undefined): boolean {
  // Admin, Social Media, Designer e Editor criam/editam posts.
  return role !== undefined;
}

export function canDeletePosts(role: UserRole | undefined): boolean {
  return role === "admin" || role === "social_media";
}

export function canManageTeam(role: UserRole | undefined): boolean {
  return role === "admin";
}
