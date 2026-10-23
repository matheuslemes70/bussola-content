"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { entregarPost } from "@/app/(app)/posts/actions";
import { AcoesMesa } from "@/components/mesa/AcoesMesa";
import type { PostStatus } from "@/lib/types";

const PRODUCAO: PostStatus[] = ["a_produzir", "em_producao", "pronto_pra_editar", "alterar"];

// Bloco do "próximo passo" na página do post. Mostra só o que faz sentido
// para a etapa atual e para quem está olhando.
export function FluxoPost({
  postId,
  status,
  deliveredLink,
  podeEntregar,
  podeGerir,
  revisorNome,
  baseUrl,
}: {
  postId: string;
  status: PostStatus;
  deliveredLink: string | null;
  podeEntregar: boolean;
  podeGerir: boolean;
  revisorNome: string | null;
  baseUrl: string;
}) {
  const router = useRouter();
  const [link, setLink] = useState(deliveredLink ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onEntregar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await entregarPost(postId, link);
      if (res && "error" in res && res.error) return setErro(res.error);
      router.refresh();
    });
  }

  const titulo = (t: string, sub: string) => (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-lg font-bold text-white">{t}</h2>
      <span className="label-mono text-[#9A9488]">{sub}</span>
    </div>
  );

  if (PRODUCAO.includes(status) && podeEntregar) {
    return (
      <form onSubmit={onEntregar} className="space-y-4 rounded-3xl bg-ink p-[22px] text-paper">
        {titulo("Entregar", "Passo final")}
        <label className="block space-y-2">
          <span className="label-mono block text-[#B9B3A6]">Link da entrega</span>
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Cole aqui o link do Drive"
            className="h-[46px] w-full rounded-[14px] border border-[#3A3733] bg-ink-soft px-3.5 text-sm text-white outline-none placeholder:text-[#8A8478] focus:border-bussola-yellow"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-[52px] w-full rounded-full bg-bussola-yellow text-[15px] font-bold text-ink transition hover:brightness-95 disabled:opacity-60"
        >
          {pending ? "Enviando…" : "Enviar para revisão"}
        </button>
        {erro && <p className="text-sm font-semibold text-[#F6A58A]">{erro}</p>}
        <p className="text-[13px] leading-relaxed text-[#B9B3A6]">
          {revisorNome ? `${revisorNome} recebe o aviso no sino` : "A social media do cliente recebe o aviso"} e revisa antes de ir para o cliente.
        </p>
      </form>
    );
  }

  if (status === "revisao_interna") {
    return (
      <div className="space-y-4 rounded-3xl bg-ink p-[22px] text-paper">
        {titulo("Revisão interna", podeGerir ? "Sua vez" : "Entregue")}
        {deliveredLink ? (
          <a
            href={deliveredLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center rounded-full border border-[#3A3733] text-sm font-semibold text-white hover:border-bussola-yellow"
          >
            Ver entrega ↗
          </a>
        ) : (
          <p className="text-sm text-[#B9B3A6]">Sem link de entrega.</p>
        )}
        {podeGerir ? (
          <div className="rounded-2xl bg-white p-3 text-ink">
            <AcoesMesa postId={postId} tipo="revisar" baseUrl={baseUrl} semAbrir />
          </div>
        ) : (
          <p className="text-[13px] leading-relaxed text-[#B9B3A6]">
            Entregue. {revisorNome ? `${revisorNome} vai revisar` : "A social media vai revisar"} e te avisa se precisar de ajuste.
          </p>
        )}
      </div>
    );
  }

  if (status === "aprovado" && podeGerir) {
    return (
      <div className="space-y-4 rounded-3xl bg-ink p-[22px] text-paper">
        {titulo("Publicar", "Aprovado pelo cliente")}
        <div className="rounded-2xl bg-white p-3 text-ink">
          <AcoesMesa postId={postId} tipo="publicar" semAbrir />
        </div>
      </div>
    );
  }

  if (status === "agendado") {
    return (
      <div className="space-y-2 rounded-3xl bg-ink p-[22px] text-paper">
        {titulo("Agendado", "Na rede")}
        <p className="text-[13px] leading-relaxed text-[#B9B3A6]">
          Vira &quot;Publicado&quot; sozinho no dia seguinte à data de publicação.
        </p>
      </div>
    );
  }

  return null;
}
