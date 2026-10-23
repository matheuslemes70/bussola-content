"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchGlobal, type SearchResult } from "@/app/actions/search";
import { FORMAT_LABELS, STATUS_LABELS } from "@/lib/status";

const VAZIO: SearchResult = { posts: [], clients: [] };

export function GlobalSearch() {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [res, setRes] = useState<SearchResult>(VAZIO);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  // Busca enquanto digita, com uma pequena espera para não disparar a cada tecla
  useEffect(() => {
    const t = termo.trim();
    if (t.length < 2) {
      setRes(VAZIO);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const r = await searchGlobal(t);
        if (id === reqId.current) setRes(r);
      } finally {
        if (id === reqId.current) setCarregando(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [termo]);

  // Fecha ao clicar fora
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  function fechar() {
    setAberto(false);
    setTermo("");
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const primeiro = res.posts[0];
    if (primeiro) {
      router.push(`/posts/${primeiro.id}`);
      fechar();
    }
  }

  const temResultado = res.posts.length > 0 || res.clients.length > 0;
  const mostrarPainel = aberto && termo.trim().length >= 2;

  return (
    <div ref={boxRef} className="relative w-full sm:w-80">
      <form onSubmit={onSubmit} role="search">
        <label className="flex h-11 items-center gap-2.5 rounded-full bg-sand px-4 focus-within:ring-2 focus-within:ring-ink/80">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-none text-stone-550" aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="sr-only">Buscar posts e clientes</span>
          <input
            type="search"
            value={termo}
            onChange={(e) => {
              setTermo(e.target.value);
              setAberto(true);
            }}
            onFocus={() => setAberto(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") fechar();
            }}
            placeholder="Buscar posts, clientes, briefings"
            className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-stone-550"
          />
        </label>
      </form>

      {mostrarPainel && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-3xl bg-white p-2 shadow-2xl ring-1 ring-ink/10 sm:left-auto sm:w-[26rem]">
          {carregando && !temResultado && <p className="px-3 py-5 text-center text-sm text-stone-550">Buscando…</p>}
          {!carregando && !temResultado && (
            <p className="px-3 py-5 text-center text-sm text-stone-550">Nada encontrado para “{termo.trim()}”.</p>
          )}

          {res.clients.length > 0 && (
            <div className="pb-1">
              <p className="label-mono px-3 pb-1 pt-2 text-stone-550">Clientes</p>
              {res.clients.map((c) => (
                <Link
                  key={c.id}
                  href={`/clientes/${c.id}`}
                  onClick={fechar}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-sand-light"
                >
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-ink text-xs font-bold text-paper">
                    {c.nome.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate text-sm font-semibold">{c.nome}</span>
                </Link>
              ))}
            </div>
          )}

          {res.posts.length > 0 && (
            <div>
              <p className="label-mono px-3 pb-1 pt-2 text-stone-550">Posts</p>
              {res.posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/posts/${p.id}`}
                  onClick={fechar}
                  className="block rounded-2xl px-3 py-2.5 hover:bg-sand-light"
                >
                  <p className="truncate text-sm font-semibold">{p.titulo}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-stone-550">
                    {p.clientNome && <span>{p.clientNome}</span>}
                    <span className="label-mono text-[9.5px]">{FORMAT_LABELS[p.formato]}</span>
                    <span className="label-mono text-[9.5px]">{p.arquivado ? "Arquivado" : STATUS_LABELS[p.status]}</span>
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
