"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, canManageTeam, canViewAdminPanels, canViewFinanceiro } from "@/lib/permissions";
import type { User } from "@/lib/types";

const GERAL = [
  { href: "/", label: "Dashboard", exact: true },
  { href: "/clientes", label: "Clientes" },
  { href: "/posts", label: "Todos os posts" },
];

export function Sidebar({
  user,
  mobileOpen = false,
  onClose,
}: {
  user: User;
  mobileOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [postsExpanded, setPostsExpanded] = useState(pathname.startsWith("/arquivados"));

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const geralItems = [...GERAL];
  if (canManageTeam(user.perfil)) {
    geralItems.push({ href: "/equipe", label: "Equipe" });
  }

  const estrategicoItems: { href: string; label: string; exact?: boolean }[] = [];
  if (user.id === "e5b89d87-34d3-45ae-b720-fc7762031d9b") {
    estrategicoItems.push({ href: "/tarefas", label: "Tarefas" });
  }
  if (canViewAdminPanels(user.perfil)) {
    estrategicoItems.push({ href: "/visao-equipe", label: "Visão da equipe" });
    estrategicoItems.push({ href: "/indicadores", label: "Indicadores" });
    estrategicoItems.push({ href: "/prospeccao", label: "Prospecção" });
  }
  if (canViewFinanceiro(user.perfil)) {
    estrategicoItems.push({ href: "/financeiro", label: "Financeiro" });
  }

  function renderItem(item: { href: string; label: string; exact?: boolean }) {
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive(item.href, item.exact)
            ? "bg-bussola-yellow text-black"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        {item.label}
      </Link>
    );
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80%] transform flex-col bg-black text-white transition-transform duration-200 md:static md:w-60 md:max-w-none md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <Image
            src="/logo_bussola.png"
            alt="Bússola Media"
            width={180}
            height={60}
            priority
            style={{ height: "60px", width: "auto" }}
          />
          <button
            onClick={onClose}
            className="text-2xl leading-none text-white/70 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          <div className="space-y-1">
            {geralItems.map((item) => {
              if (item.href !== "/posts") {
                return <div key={item.href}>{renderItem(item)}</div>;
              }
              const ativo = isActive(item.href, item.exact);
              return (
                <div key={item.href}>
                  <div
                    className={`flex items-center rounded-lg text-sm font-medium transition ${
                      ativo ? "bg-bussola-yellow text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Link href={item.href} onClick={onClose} className="flex-1 px-3 py-2">
                      {item.label}
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPostsExpanded((v) => !v)}
                      aria-label={postsExpanded ? "Recolher arquivados" : "Expandir arquivados"}
                      className={`px-2 py-2 ${ativo ? "text-black/60 hover:text-black" : "text-white/40 hover:text-white"}`}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className={`h-3.5 w-3.5 transition-transform ${postsExpanded ? "rotate-90" : ""}`}
                      >
                        <path d="M7 5l6 5-6 5V5z" />
                      </svg>
                    </button>
                  </div>
                  {postsExpanded && (
                    <Link
                      href="/arquivados"
                      onClick={onClose}
                      className={`ml-4 mt-1 block rounded-lg border-l border-white/10 pl-3 py-1.5 text-xs font-medium transition ${
                        isActive("/arquivados")
                          ? "bg-bussola-yellow text-black"
                          : "text-white/50 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      Arquivados
                    </Link>
                  )}
                </div>
              );
            })}
          </div>

          {estrategicoItems.length > 0 && (
            <div>
              <div className="mb-2 border-t border-white/10 pt-3">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                  Estratégico
                </p>
              </div>
              <div className="space-y-1">{estrategicoItems.map(renderItem)}</div>
            </div>
          )}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="px-2 text-sm font-medium text-white">{user.nome || user.email}</p>
          <p className="px-2 text-xs text-white/50">{ROLE_LABELS[user.perfil]}</p>
          <button
            onClick={logout}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm text-white/60 hover:bg-white/10 hover:text-white"
          >
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}
