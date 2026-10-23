"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, canManageTeam, canViewAdminPanels, canViewFinanceiro } from "@/lib/permissions";
import type { User } from "@/lib/types";

// Ícones de traço simples, um por item do menu
const ICON_PATHS: Record<string, React.ReactNode> = {
  "/": (<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>),
  "/clientes": (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.8 3.1 2.5 3.5 5.2" /></>),
  "/posts": (<><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="m3 13 9 5 9-5" /></>),
  "/equipe": (<><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.2 4.1-6.5 8-6.5s7 2.3 8 6.5" /></>),
  "/tarefas": (<><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="m8 12 3 3 5-6" /></>),
  "/visao-equipe": (<><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>),
  "/indicadores": (<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />),
  "/prospeccao": (<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>),
  "/financeiro": (<><rect x="2.5" y="6" width="19" height="13" rx="2.5" /><path d="M2.5 10.5h19M16.5 15h1.5" /><path d="M6 6V5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 18 5v1" /></>),
};

function NavIcon({ href, active }: { href: string; active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`flex-none ${active ? "text-bussola-yellow" : ""}`}
    >
      {ICON_PATHS[href]}
    </svg>
  );
}

const ITEM_BASE = "flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition";
const ITEM_ON = "bg-ink-muted text-white";
const ITEM_OFF = "text-[#B9B3A6] hover:bg-ink-soft hover:text-white";

const GERAL = [
  { href: "/", label: "Visão geral", exact: true },
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
    const ativo = isActive(item.href, item.exact);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        aria-current={ativo ? "page" : undefined}
        className={`${ITEM_BASE} ${ativo ? ITEM_ON : ITEM_OFF}`}
      >
        <NavIcon href={item.href} active={ativo} />
        <span className="flex-1">{item.label}</span>
      </Link>
    );
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/60 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80%] transform flex-col bg-ink text-white transition-transform duration-200 md:sticky md:top-0 md:h-screen md:w-64 md:max-w-none md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 pb-4 pt-7">
          <Image
            src="/logo_bussola.png"
            alt="Bússola Media"
            width={180}
            height={60}
            priority
            style={{ height: "52px", width: "auto" }}
          />
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-2xl leading-none text-stone-450 hover:text-white md:hidden"
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <nav aria-label="Navegação principal" className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <div className="space-y-0.5">
            <p className="label-mono px-3 pb-2 text-stone-450">Operação</p>
            {geralItems.map((item) => {
              if (item.href !== "/posts") {
                return <div key={item.href}>{renderItem(item)}</div>;
              }
              const ativo = isActive(item.href, item.exact);
              return (
                <div key={item.href}>
                  <div className={`flex items-center rounded-xl text-[14.5px] font-medium transition ${ativo ? ITEM_ON : ITEM_OFF}`}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={ativo ? "page" : undefined}
                      className="flex min-h-[44px] flex-1 items-center gap-3 px-3"
                    >
                      <NavIcon href={item.href} active={ativo} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setPostsExpanded((v) => !v)}
                      aria-label={postsExpanded ? "Recolher arquivados" : "Expandir arquivados"}
                      className="flex h-11 w-10 items-center justify-center text-stone-450 hover:text-white"
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 transition-transform ${postsExpanded ? "rotate-90" : ""}`}>
                        <path d="M7 5l6 5-6 5V5z" />
                      </svg>
                    </button>
                  </div>
                  {postsExpanded && (
                    <Link
                      href="/arquivados"
                      onClick={onClose}
                      className={`ml-[42px] mt-0.5 flex min-h-[36px] items-center rounded-lg px-3 text-[13px] font-medium transition ${
                        isActive("/arquivados") ? "bg-ink-muted text-white" : "text-stone-450 hover:bg-ink-soft hover:text-white"
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
              <p className="label-mono px-3 pb-2 text-stone-450">Estratégico</p>
              <div className="space-y-0.5">{estrategicoItems.map(renderItem)}</div>
            </div>
          )}
        </nav>

        <div className="p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-ink-soft p-3">
            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-bussola-yellow text-[15px] font-extrabold text-ink">
              {(user.nome || user.email).charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.nome || user.email}</p>
              <p className="label-mono mt-0.5 text-[9.5px] text-stone-450">{ROLE_LABELS[user.perfil]}</p>
            </div>
            <button
              onClick={logout}
              aria-label="Sair"
              title="Sair"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-stone-450 hover:bg-ink-muted hover:text-white"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
                <path d="M10 8l-4 4 4 4M6 12h10" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
