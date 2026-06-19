"use client";

import { useState } from "react";

// Botão genérico de copiar para a área de transferência (feedback "Copiado!" por 2s).
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copiado, setCopiado] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="text-xs text-bussola-blue hover:underline"
    >
      {copiado ? "Copiado!" : label}
    </button>
  );
}
