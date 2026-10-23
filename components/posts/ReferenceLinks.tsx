"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addReferenceLink, deleteReferenceLink } from "@/app/(app)/posts/actions";
import type { PostReferenceLink } from "@/lib/types";

export function ReferenceLinks({
  postId,
  links,
  canEdit,
}: {
  postId: string;
  links: PostReferenceLink[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  function adicionar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await addReferenceLink(postId, label, url);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setLabel("");
      setUrl("");
      router.refresh();
    });
  }

  function remover(linkId: string) {
    startTransition(async () => {
      await deleteReferenceLink(postId, linkId);
      router.refresh();
    });
  }

  return (
    <div>
      {links.length === 0 && <p className="text-sm text-slate-400">Nenhum link ainda.</p>}
      <div className="flex flex-wrap gap-2">
        {links.map((l) => (
          <span
            key={l.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-bussola-blue/10 px-3 py-1 text-sm text-bussola-blue"
          >
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
              {l.label}
            </a>
            {canEdit && (
              <button
                type="button"
                onClick={() => remover(l.id)}
                disabled={pending}
                className="text-bussola-blue/60 hover:text-red-600"
                aria-label="Remover link"
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>

      {canEdit && (
        <form onSubmit={adicionar} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Nome (ex: Vídeo 1)"
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-bussola-blue sm:w-40"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Link (Drive, etc.)"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-bussola-blue"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-bussola-yellow px-3 py-1.5 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
          >
            + Adicionar
          </button>
        </form>
      )}
      {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
    </div>
  );
}
