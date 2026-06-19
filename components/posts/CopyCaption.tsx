"use client";

import { useState } from "react";

export function CopyCaption({ text }: { text: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    await navigator.clipboard.writeText(text);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (!text) return null;

  return (
    <button
      onClick={copiar}
      className="rounded bg-bussola-blue px-2 py-0.5 text-xs font-medium text-white hover:brightness-110"
    >
      {copiado ? "Copiado!" : "Copiar legenda"}
    </button>
  );
}
