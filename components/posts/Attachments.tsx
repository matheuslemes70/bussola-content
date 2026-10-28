"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addAttachment, deleteAttachment } from "@/app/(app)/posts/actions";
import type { PostAttachment } from "@/lib/types";

function publicUrl(storagePath: string) {
  const supabase = createClient();
  const { data } = supabase.storage.from("post-attachments").getPublicUrl(storagePath);
  return data.publicUrl;
}

export function Attachments({
  postId,
  attachments,
  canEdit,
}: {
  postId: string;
  attachments: PostAttachment[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [envio, setEnvio] = useState<{ feitos: number; total: number } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [aberta, setAberta] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contador = useRef(0); // evita piscar ao arrastar sobre elementos filhos

  // ---------- Envio (arrastar, colar ou escolher) ----------
  const enviar = useCallback(
    async (lista: File[]) => {
      const imagens = lista.filter((f) => f.type.startsWith("image/"));
      const ignorados = lista.length - imagens.length;
      if (imagens.length === 0) {
        setErro("Só dá pra anexar imagens aqui.");
        return;
      }
      setErro(ignorados > 0 ? `${ignorados} arquivo(s) não eram imagem e ficaram de fora.` : null);
      setEnvio({ feitos: 0, total: imagens.length });
      const supabase = createClient();
      let falhas = 0;
      for (let i = 0; i < imagens.length; i++) {
        const file = imagens[i];
        const nomeBase = file.name || `imagem-colada-${i + 1}.png`;
        const safeName = nomeBase
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "_");
        const path = `${postId}/${Date.now()}-${i}-${safeName}`;
        const { error } = await supabase.storage.from("post-attachments").upload(path, file);
        if (error) {
          falhas++;
        } else {
          await addAttachment(postId, path, nomeBase);
        }
        setEnvio({ feitos: i + 1, total: imagens.length });
      }
      setEnvio(null);
      if (falhas) setErro(`${falhas} imagem(ns) não foram enviadas. Tente de novo.`);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    },
    [postId, router]
  );

  // Colar imagem copiada (Ctrl+V) em qualquer lugar da página do post
  useEffect(() => {
    if (!canEdit) return;
    function onPaste(e: ClipboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.isContentEditable)) return;
      const arquivos = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (arquivos.length) {
        e.preventDefault();
        enviar(arquivos);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [canEdit, enviar]);

  function onDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    contador.current++;
    setArrastando(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    contador.current = Math.max(0, contador.current - 1);
    if (contador.current === 0) setArrastando(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    contador.current = 0;
    setArrastando(false);
    const arquivos = Array.from(e.dataTransfer.files ?? []);
    if (arquivos.length) enviar(arquivos);
  }

  // ---------- Visualizador ----------
  const total = attachments.length;
  const fechar = useCallback(() => setAberta(null), []);
  const anterior = useCallback(() => setAberta((i) => (i === null ? i : (i - 1 + total) % total)), [total]);
  const proxima = useCallback(() => setAberta((i) => (i === null ? i : (i + 1) % total)), [total]);

  useEffect(() => {
    if (aberta === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") fechar();
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") proxima();
    }
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberta, fechar, anterior, proxima]);

  // Se uma imagem for removida com o visualizador aberto, ajusta o índice
  useEffect(() => {
    if (aberta !== null && aberta >= total) setAberta(total ? total - 1 : null);
  }, [aberta, total]);

  const toqueX = useRef<number | null>(null);

  async function baixar(att: PostAttachment) {
    try {
      const res = await fetch(publicUrl(att.storage_path));
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = att.nome || "imagem.jpg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setErro("Não foi possível baixar a imagem.");
    }
  }

  async function baixarTodas() {
    for (const att of attachments) {
      await baixar(att);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  function remover(att: PostAttachment) {
    if (!window.confirm(`Remover "${att.nome || "esta imagem"}"?`)) return;
    startTransition(async () => {
      await deleteAttachment(postId, att.id, att.storage_path);
      router.refresh();
    });
  }

  const atual = aberta !== null ? attachments[aberta] : null;

  return (
    <div className="space-y-3">
      {total > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
          {attachments.map((att, i) => (
            <div key={att.id} className="group relative aspect-square overflow-hidden rounded-xl bg-sand">
              <button
                type="button"
                onClick={() => setAberta(i)}
                className="block h-full w-full"
                aria-label={`Abrir ${att.nome || `imagem ${i + 1}`}`}
              >
                <img
                  src={publicUrl(att.storage_path)}
                  alt={att.nome}
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                />
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remover(att)}
                  disabled={pending}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/75 text-sm text-white opacity-0 transition group-hover:opacity-100 focus:opacity-100"
                  aria-label={`Remover ${att.nome || "imagem"}`}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 1 && (
        <button type="button" onClick={baixarTodas} className="text-[13px] font-semibold text-ink underline-offset-4 hover:underline">
          Baixar todas ({total})
        </button>
      )}

      {total === 0 && !canEdit && <p className="text-sm text-stone-550">Nenhuma imagem anexada.</p>}

      {canEdit && (
        <div
          onDragEnter={onDragEnter}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed px-4 py-5 text-center transition ${
            arrastando ? "border-ink bg-bussola-yellow/20" : "border-sand-line bg-paper"
          }`}
        >
          <input
            ref={inputRef}
            id={`anexos-${postId}`}
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => e.target.files && enviar(Array.from(e.target.files))}
            disabled={!!envio}
            className="sr-only"
          />
          {envio ? (
            <p className="text-sm font-semibold">
              Enviando {envio.feitos} de {envio.total}…
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold">{arrastando ? "Solte as imagens aqui" : "Arraste as imagens pra cá"}</p>
              <p className="mt-1 text-[13px] text-stone-550">
                ou{" "}
                <label htmlFor={`anexos-${postId}`} className="cursor-pointer font-semibold text-ink underline underline-offset-4">
                  escolha no computador
                </label>
                {" "}· também dá pra colar com Ctrl+V
              </p>
            </>
          )}
        </div>
      )}

      {erro && <p className="text-sm font-semibold text-[#9A2A12]">{erro}</p>}

      {atual && aberta !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Imagens anexadas"
          className="fixed inset-0 z-[60] flex flex-col bg-ink/95 text-white"
          onClick={fechar}
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6" onClick={(e) => e.stopPropagation()}>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{atual.nome || `Imagem ${aberta + 1}`}</p>
              <p className="label-mono text-[#9A9488]">
                {aberta + 1} de {total}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => baixar(atual)}
                className="h-10 rounded-full bg-white/10 px-4 text-[13px] font-semibold hover:bg-white/20"
              >
                Baixar
              </button>
              <button
                type="button"
                onClick={fechar}
                aria-label="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl hover:bg-white/20"
              >
                ×
              </button>
            </div>
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-20"
            onTouchStart={(e) => (toqueX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (toqueX.current === null) return;
              const dx = e.changedTouches[0].clientX - toqueX.current;
              if (Math.abs(dx) > 50) (dx > 0 ? anterior : proxima)();
              toqueX.current = null;
            }}
          >
            <img
              key={atual.id}
              src={publicUrl(atual.storage_path)}
              alt={atual.nome}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
            />
            {total > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    anterior();
                  }}
                  aria-label="Imagem anterior"
                  className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 sm:left-5"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    proxima();
                  }}
                  aria-label="Próxima imagem"
                  className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 hover:bg-white/25 sm:right-5"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {total > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-4" onClick={(e) => e.stopPropagation()}>
              {attachments.map((att, i) => (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => setAberta(i)}
                  aria-label={`Ver imagem ${i + 1}`}
                  className={`h-14 w-14 flex-none overflow-hidden rounded-lg ring-2 transition ${
                    i === aberta ? "ring-bussola-yellow" : "opacity-50 ring-transparent hover:opacity-100"
                  }`}
                >
                  <img src={publicUrl(att.storage_path)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
