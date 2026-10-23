"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitPauta } from "@/app/pauta/[token]/actions";
import { RichText } from "@/components/ui/RichText";
import { CopyCaption } from "@/components/posts/CopyCaption";
import { FORMAT_LABELS, FORMAT_COLORS, formatDate } from "@/lib/status";
import type { PostFormat } from "@/lib/types";

// Apenas os campos que o cliente pode ver (sem briefing interno por padrão,
// sem reference_link, sem public_token, etc).
export type PautaPost = {
  id: string;
  titulo: string;
  formato: PostFormat;
  data_publicacao_planejada: string | null;
  briefing: string; // só preenchido quando incluir_briefing = true
  caption: string;
  ideia: string;
  delivered_link: string | null;
};

export function PautaForm({
  token,
  posts,
  incluirBriefing,
  jaRespondida,
}: {
  token: string;
  posts: PautaPost[];
  incluirBriefing: boolean;
  jaRespondida: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autor, setAutor] = useState("");
  const [geral, setGeral] = useState("");
  const [comentarios, setComentarios] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<"aprovada" | "ajustes_solicitados" | null>(null);

  function submit(decision: "aprovada" | "ajustes_solicitados") {
    setErro(null);
    const postComments = Object.entries(comentarios).map(([postId, texto]) => ({ postId, texto }));
    startTransition(async () => {
      const res = await submitPauta(token, decision, autor, geral, postComments);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setFeito(decision);
      router.refresh();
    });
  }

  if (feito) {
    return (
      <div className={`rounded-xl p-5 text-center text-sm font-medium ${
        feito === "aprovada" ? "bg-emerald-50 text-emerald-700" : "bg-orange-50 text-orange-700"
      }`}>
        {feito === "aprovada"
          ? "Pauta aprovada! Obrigado."
          : "Ajustes enviados. A equipe foi notificada."}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((p) => (
        <div key={p.id} className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-slate-400">
              {formatDate(p.data_publicacao_planejada)}
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium text-white ${FORMAT_COLORS[p.formato]}`}>
              {FORMAT_LABELS[p.formato]}
            </span>
          </div>
          <h3 className="text-base font-semibold text-slate-800">{p.titulo}</h3>
          {incluirBriefing && p.briefing && (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <RichText text={p.briefing} />
            </p>
          )}
          {p.ideia && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-slate-400">Ideia do post</p>
                <CopyCaption text={p.ideia} />
              </div>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><RichText text={p.ideia} /></p>
            </div>
          )}
          {p.caption && (
            <div className="mt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-slate-400">Legenda</p>
                <CopyCaption text={p.caption} />
              </div>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700"><RichText text={p.caption} /></p>
            </div>
          )}
          {p.delivered_link && (
            <div className="mt-3">
              <a href={p.delivered_link} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-bussola-blue hover:underline">
                Ver conteúdo →
              </a>
            </div>
          )}
          {!jaRespondida && (
            <textarea
              value={comentarios[p.id] ?? ""}
              onChange={(e) => setComentarios((c) => ({ ...c, [p.id]: e.target.value }))}
              placeholder="Comentário sobre este post (opcional)"
              rows={4}
              className="mt-3 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
            />
          )}
        </div>
      ))}

      {!jaRespondida && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <input
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            placeholder="Seu nome"
            className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
          />
          <textarea
            value={geral}
            onChange={(e) => setGeral(e.target.value)}
            rows={5}
            placeholder="Comentário geral sobre a pauta (obrigatório ao solicitar ajustes)"
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
          />
          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => submit("aprovada")} disabled={pending}
              className="flex-1 rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60">
              Aprovar pauta
            </button>
            <button onClick={() => submit("ajustes_solicitados")} disabled={pending}
              className="flex-1 rounded-xl bg-orange-500 py-4 text-base font-semibold text-white hover:bg-orange-600 active:bg-orange-700 disabled:opacity-60">
              Solicitar ajustes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
