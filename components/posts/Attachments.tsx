"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addAttachment, deleteAttachment } from "@/app/(app)/posts/actions";
import type { PostAttachment } from "@/lib/types";

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
  const [uploading, setUploading] = useState(false);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function publicUrl(storagePath: string) {
    const supabase = createClient();
    const { data } = supabase.storage.from("post-attachments").getPublicUrl(storagePath);
    return data.publicUrl;
  }

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setErro(null);
    setUploading(true);
    const supabase = createClient();
    for (const file of Array.from(files)) {
      const safeName = file.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${postId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("post-attachments")
        .upload(path, file);
      if (uploadError) {
        setErro(uploadError.message);
        continue;
      }
      await addAttachment(postId, path, file.name);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  async function baixar(att: PostAttachment) {
    setBaixando(att.id);
    try {
      const res = await fetch(publicUrl(att.storage_path));
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = att.nome || "imagem.jpg";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setErro("Não foi possível baixar a imagem.");
    }
    setBaixando(null);
  }

  function remover(att: PostAttachment) {
    startTransition(async () => {
      await deleteAttachment(postId, att.id, att.storage_path);
      router.refresh();
    });
  }

  return (
    <div>
      {attachments.length === 0 && <p className="text-sm text-slate-400">Nenhuma imagem anexada.</p>}
      <div className="flex flex-wrap gap-3">
        {attachments.map((att) => (
          <div key={att.id} className="flex flex-col items-center gap-1">
            <div className="group relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200">
              <a href={publicUrl(att.storage_path)} target="_blank" rel="noopener noreferrer">
                <img
                  src={publicUrl(att.storage_path)}
                  alt={att.nome}
                  className="h-full w-full object-cover"
                />
              </a>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remover(att)}
                  disabled={pending}
                  className="absolute right-1 top-1 hidden rounded-full bg-black/70 px-1.5 text-xs text-white group-hover:block"
                  aria-label="Remover imagem"
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => baixar(att)}
              disabled={baixando === att.id}
              className="text-xs text-bussola-blue hover:underline disabled:opacity-60"
            >
              {baixando === att.id ? "Baixando..." : "Baixar"}
            </button>
          </div>
        ))}
      </div>

      {canEdit && (
        <div className="mt-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onFilesSelected}
            disabled={uploading}
            className="text-sm text-slate-600"
          />
          {uploading && <p className="mt-1 text-xs text-slate-400">Enviando...</p>}
          {erro && <p className="mt-1 text-sm text-red-600">{erro}</p>}
        </div>
      )}
    </div>
  );
}
