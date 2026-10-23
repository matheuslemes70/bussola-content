"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unarchivePost } from "@/app/(app)/posts/actions";

export function UnarchiveButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function desarquivar() {
    startTransition(async () => {
      await unarchivePost(postId);
      router.refresh();
    });
  }

  return (
    <button
      onClick={desarquivar}
      disabled={pending}
      className="rounded-lg border border-bussola-blue px-3 py-1 text-xs font-medium text-bussola-blue hover:bg-bussola-blue/10 disabled:opacity-60"
    >
      {pending ? "..." : "Desarquivar"}
    </button>
  );
}
