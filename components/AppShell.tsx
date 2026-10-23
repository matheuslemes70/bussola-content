"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { NotificationsBell } from "@/components/NotificationsBell";
import type { User } from "@/lib/types";

export function AppShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-hidden">
      <Sidebar user={user} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 max-w-full flex-1 flex-col">
        {/* Barra superior fixa (mobile e desktop) */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Abrir menu"
              className="text-2xl leading-none text-slate-700"
            >
              ☰
            </button>
            <span className="text-lg font-extrabold tracking-tight text-bussola-blue">
              Bússola <span className="font-light text-slate-700">Media</span>
            </span>
          </div>
          <div className="hidden md:block" />
          <NotificationsBell />
        </header>
        <main className="w-full max-w-full flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-7xl p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
