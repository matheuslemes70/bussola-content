"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarAoCliente, pedirAjuste, marcarPublicado, marcarAgendado, cobrarExecutor } from "@/app/(app)/posts/actions";

// Botões rápidos da social media na Minha mesa.
// tipo "revisar": Pedir ajuste / Enviar ao cliente
// tipo "publicar": Marcar como publicado
// tipo "cliente": Copiar link de aprovação
// tipo "risco": Cobrar quem está com o post
export function AcoesMesa({
  postId,
  tipo,
  token,
  baseUrl,
  semAbrir = false,
  executorNome,
}: {
  semAbrir?: boolean;
  postId: string;
  tipo: "revisar" | "publicar" | "cliente" | "risco";
  executorNome?: string | null;
  token?: string | null;
  baseUrl?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [ajusteAberto, setAjusteAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  function copiar(link: string, aviso: string) {
    navigator.clipboard?.writeText(link).then(
      () => setMsg(aviso),
      () => setMsg(link)
    );
  }

  function onEnviar() {
    setErro(null);
    startTransition(async () => {
      const res = await enviarAoCliente(postId);
      if (res && "error" in res && res.error) return setErro(res.error);
      const t = res && "token" in res ? res.token : null;
      if (t) copiar(`${baseUrl ?? ""}/aprovacao/${t}`, "Link de aprovação copiado. É só mandar pro cliente.");
      // Dá tempo de ler o aviso antes de o post sair da lista
      setTimeout(() => router.refresh(), 4000);
    });
  }

  function onAjuste(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await pedirAjuste(postId, texto);
      if (res && "error" in res && res.error) return setErro(res.error);
      setAjusteAberto(false);
      setTexto("");
      router.refresh();
    });
  }

  function onCobrar() {
    setErro(null);
    startTransition(async () => {
      const res = await cobrarExecutor(postId);
      if (res && "error" in res && res.error) return setErro(res.error);
      setMsg(`${executorNome ?? "A pessoa"} recebeu o aviso no sino.`);
    });
  }

  function onAgendado() {
    setErro(null);
    startTransition(async () => {
      const res = await marcarAgendado(postId);
      if (res && "error" in res && res.error) return setErro(res.error);
      router.refresh();
    });
  }

  function onPublicado() {
    setErro(null);
    startTransition(async () => {
      const res = await marcarPublicado(postId);
      if (res && "error" in res && res.error) return setErro(res.error);
      router.refresh();
    });
  }

  const btnClaro =
    "flex h-10 items-center rounded-full bg-paper px-4 text-[13.5px] font-semibold transition hover:bg-sand disabled:opacity-60";
  const btnEscuro =
    "flex h-10 items-center rounded-full bg-ink px-4 text-[13.5px] font-semibold text-white transition hover:bg-ink-muted disabled:opacity-60";

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      {tipo === "revisar" && !ajusteAberto && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!semAbrir && (
            <Link href={`/posts/${postId}`} className={btnClaro}>
              Abrir
            </Link>
          )}
          <button type="button" onClick={() => setAjusteAberto(true)} disabled={pending} className={btnClaro}>
            Pedir ajuste
          </button>
          <button type="button" onClick={onEnviar} disabled={pending} className={btnEscuro}>
            {pending ? "Enviando…" : "Enviar ao cliente"}
          </button>
        </div>
      )}

      {tipo === "revisar" && ajusteAberto && (
        <form onSubmit={onAjuste} className="flex w-full flex-col gap-2 sm:w-80">
          <label className="sr-only" htmlFor={`ajuste-${postId}`}>
            O que precisa ajustar
          </label>
          <textarea
            id={`ajuste-${postId}`}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={3}
            autoFocus
            placeholder="O que precisa ajustar? Quem executa vai ver isso em destaque."
            className="w-full rounded-2xl bg-paper p-3 text-sm outline-none focus:ring-2 focus:ring-ink/70"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAjusteAberto(false)} className={btnClaro}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={btnEscuro}>
              {pending ? "Enviando…" : "Devolver com ajuste"}
            </button>
          </div>
        </form>
      )}

      {tipo === "publicar" && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {!semAbrir && (
            <Link href={`/posts/${postId}`} className={btnClaro}>
              Abrir
            </Link>
          )}
          <button type="button" onClick={onAgendado} disabled={pending} className={btnClaro}>
            Agendado
          </button>
          <button
            type="button"
            onClick={onPublicado}
            disabled={pending}
            className="flex h-10 items-center rounded-full bg-bussola-yellow px-4 text-[13.5px] font-bold text-ink transition hover:brightness-95 disabled:opacity-60"
          >
            {pending ? "Salvando…" : "Publicado"}
          </button>
        </div>
      )}

      {tipo === "risco" && (
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Link href={`/posts/${postId}`} className={btnClaro}>
            Abrir
          </Link>
          {executorNome && !msg && (
            <button type="button" onClick={onCobrar} disabled={pending} className={btnEscuro}>
              {pending ? "Avisando…" : `Cobrar ${executorNome}`}
            </button>
          )}
        </div>
      )}

      {tipo === "cliente" && token && (
        <button
          type="button"
          onClick={() => copiar(`${baseUrl ?? ""}/aprovacao/${token}`, "Link copiado.")}
          className="text-[13px] font-semibold underline-offset-4 hover:underline"
        >
          Copiar link
        </button>
      )}

      {msg && <p className="text-xs font-semibold text-emerald-800">{msg}</p>}
      {erro && <p className="text-xs font-semibold text-[#9A2A12]">{erro}</p>}
    </div>
  );
}
