"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBrandCore } from "@/app/(app)/clientes/[clientId]/actions";
import type { BrandCore } from "@/lib/types";

const FIELDS: { name: keyof BrandCore; label: string }[] = [
  { name: "persona", label: "Persona" },
  { name: "diagnostico", label: "Diagnóstico" },
  { name: "concorrencia", label: "Concorrência" },
  { name: "posicionamento", label: "Posicionamento" },
  { name: "esteira_produtos", label: "Esteira de produtos" },
];

export function BrandCoreForm({
  clientId,
  brandCore,
  canEdit,
}: {
  clientId: string;
  brandCore: BrandCore | null;
  canEdit: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSalvo(false);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateBrandCore(clientId, fd);
      if (res?.error) {
        setErro(res.error);
        return;
      }
      setSalvo(true);
      router.refresh();
    });
  }

  if (!canEdit) {
    return (
      <div className="space-y-5">
        {FIELDS.map((f) => (
          <div key={f.name}>
            <h3 className="mb-1 text-sm font-semibold text-slate-700">{f.label}</h3>
            <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {(brandCore?.[f.name] as string) || <span className="text-slate-400">Não preenchido.</span>}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {FIELDS.map((f) => (
        <div key={f.name}>
          <label className="mb-1 block text-sm font-semibold text-slate-700">{f.label}</label>
          <textarea
            name={f.name}
            rows={4}
            defaultValue={(brandCore?.[f.name] as string) ?? ""}
            className="w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-bussola-blue focus:ring-1 focus:ring-bussola-blue"
          />
        </div>
      ))}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {salvo && <p className="text-sm text-emerald-600">Salvo!</p>}
      <button type="submit" disabled={pending}
        className="rounded-lg bg-bussola-yellow px-5 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
        {pending ? "Salvando..." : "Salvar Brand Core"}
      </button>
    </form>
  );
}
