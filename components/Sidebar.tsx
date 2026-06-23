"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, canManageTeam } from "@/lib/permissions";
import type { User } from "@/lib/types";

const NAV = [
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

  const items = [...NAV];
  if (canManageTeam(user.perfil)) {
    items.push({ href: "/equipe", label: "Equipe" });
  }

  return (
    <>
      {/* Backdrop (somente mobile, quando aberto) */}
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

        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
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
          ))}
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
