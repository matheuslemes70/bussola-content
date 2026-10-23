"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { archivePost } from "@/app/(app)/posts/actions";

export function ArchiveButton({ postId, titulo }: { postId: string; titulo: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function arquivar() {
    if (!confirm(`Arquivar "${titulo}"? Ele sai das listas ativas, mas fica salvo pra revisitar depois.`)) return;
    startTransition(async () => {
      await archivePost(postId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={arquivar}
      disabled={pending}
      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
    >
      {pending ? "..." : "Arquivar"}
    </button>
  );
}
