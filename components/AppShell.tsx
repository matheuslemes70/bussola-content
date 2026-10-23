"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { NotificationsBell } from "@/components/NotificationsBell";
import { GlobalSearch } from "@/components/GlobalSearch";
import { PostFormModal } from "@/components/posts/PostFormModal";
import type { Client, User } from "@/lib/types";

// Nome da seção e da página para o "caminho" no topo
const PAGINAS: { prefix: string; secao: string; titulo: string; exact?: boolean }[] = [
  { prefix: "/", secao: "Operação", titulo: "Visão geral", exact: true },
  { prefix: "/clientes", secao: "Operação", titulo: "Clientes" },
  { prefix: "/posts", secao: "Operação", titulo: "Posts" },
  { prefix: "/arquivados", secao: "Operação", titulo: "Arquivados" },
  { prefix: "/equipe", secao: "Operação", titulo: "Equipe" },
  { prefix: "/tarefas", secao: "Estratégico", titulo: "Tarefas" },
  { prefix: "/visao-equipe", secao: "Estratégico", titulo: "Visão da equipe" },
  { prefix: "/indicadores", secao: "Estratégico", titulo: "Indicadores" },
  { prefix: "/prospeccao", secao: "Estratégico", titulo: "Prospecção" },
  { prefix: "/financeiro", secao: "Estratégico", titulo: "Financeiro" },
];

function paginaAtual(pathname: string) {
  return PAGINAS.find((p) =>
    p.exact ? pathname === p.prefix : pathname === p.prefix || pathname.startsWith(p.prefix + "/")
  );
}

export function AppShell({
  user,
  clients,
  users,
  podeVerDataPublicacao,
  podeCriarPost,
  children,
}: {
  user: User;
  clients: Client[];
  users: User[];
  podeVerDataPublicacao: boolean;
  podeCriarPost: boolean;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [novoPostOpen, setNovoPostOpen] = useState(false);
  const pathname = usePathname();
  const pagina = paginaAtual(pathname);

  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-paper">
      <Sidebar user={user} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 max-w-full flex-1 flex-col md:pl-64">
        {/* Barra superior */}
        <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-8 sm:py-4">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-sand md:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M4 7h16M4 12h16M4 17h10" />
              </svg>
            </button>

            {pagina && (
              <div className="mr-auto hidden items-center gap-2.5 md:flex">
                <span className="label-mono text-stone-550">{pagina.secao}</span>
                <span className="text-stone-450">/</span>
                <span className="text-[15px] font-semibold">{pagina.titulo}</span>
              </div>
            )}
            {!pagina && <div className="mr-auto hidden md:block" />}

            <div className="order-last w-full sm:order-none sm:w-auto">
              <GlobalSearch />
            </div>

            <div className="ml-auto flex items-center gap-2 sm:ml-0">
              <NotificationsBell />
              {podeCriarPost && (
              <button
                onClick={() => setNovoPostOpen(true)}
                className="flex h-11 items-center gap-3 rounded-full bg-ink pl-5 pr-1.5 text-sm font-semibold text-white transition hover:bg-ink-muted"
              >
                Novo post
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bussola-yellow text-ink">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
              )}
            </div>
          </div>
        </header>

        <main className="w-full max-w-full flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-2 sm:px-8">{children}</div>
        </main>
      </div>

      {podeCriarPost && (
      <PostFormModal
        users={users}
        clients={clients}
        podeVerDataPublicacao={podeVerDataPublicacao}
        open={novoPostOpen}
        onOpenChange={setNovoPostOpen}
      />
      )}
    </div>
  );
}
