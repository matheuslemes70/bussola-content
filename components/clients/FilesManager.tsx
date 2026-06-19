"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createFolder,
  deleteFolder,
  createFile,
  deleteFile,
} from "@/app/(app)/clientes/[clientId]/actions";
import type { FileFolder, DriveFile } from "@/lib/types";

export function FilesManager({
  clientId,
  folders,
  files,
  canEdit,
}: {
  clientId: string;
  folders: FileFolder[];
  files: DriveFile[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [novaPasta, setNovaPasta] = useState("");

  const semPasta = files.filter((f) => !f.folder_id);

  function addPasta() {
    if (!novaPasta.trim()) return;
    startTransition(async () => {
      await createFolder(clientId, novaPasta, null);
      setNovaPasta("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="flex gap-2">
          <input
            value={novaPasta}
            onChange={(e) => setNovaPasta(e.target.value)}
            placeholder="Nova pasta..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-bussola-blue"
          />
          <button onClick={addPasta} disabled={pending}
            className="rounded-lg bg-bussola-yellow px-4 py-2 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
            + Pasta
          </button>
        </div>
      )}

      {folders.map((folder) => (
        <FolderBlock
          key={folder.id}
          clientId={clientId}
          folder={folder}
          files={files.filter((f) => f.folder_id === folder.id)}
          canEdit={canEdit}
        />
      ))}

      <FolderBlock
        clientId={clientId}
        folder={null}
        files={semPasta}
        canEdit={canEdit}
      />
    </div>
  );
}

function FolderBlock({
  clientId,
  folder,
  files,
  canEdit,
}: {
  clientId: string;
  folder: FileFolder | null;
  files: DriveFile[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [nome, setNome] = useState("");
  const [link, setLink] = useState("");

  function addFile() {
    startTransition(async () => {
      const res = await createFile(clientId, folder?.id ?? null, nome, link);
      if (!res?.error) {
        setNome("");
        setLink("");
        setAdding(false);
        router.refresh();
      }
    });
  }

  function removeFile(id: string) {
    startTransition(async () => {
      await deleteFile(clientId, id);
      router.refresh();
    });
  }

  function removeFolder() {
    if (!folder) return;
    startTransition(async () => {
      await deleteFolder(clientId, folder.id);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">
          {folder ? folder.nome : "Sem pasta"}
        </h3>
        {canEdit && folder && (
          <button onClick={removeFolder} className="text-xs text-red-500 hover:underline">
            Excluir pasta
          </button>
        )}
      </div>

      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <a href={f.drive_link} target="_blank" rel="noopener noreferrer"
              className="text-bussola-blue hover:underline">
              {f.nome}
            </a>
            {canEdit && (
              <button onClick={() => removeFile(f.id)} className="text-xs text-red-500 hover:underline">
                remover
              </button>
            )}
          </li>
        ))}
        {files.length === 0 && <li className="px-1 text-xs text-slate-400">Nenhum arquivo.</li>}
      </ul>

      {canEdit && (
        <div className="mt-2">
          {adding ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome"
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none" />
              <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link do Drive"
                className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none" />
              <button onClick={addFile} disabled={pending}
                className="rounded-lg bg-bussola-yellow px-3 py-1 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
                Adicionar
              </button>
              <button onClick={() => setAdding(false)} className="text-sm text-slate-500">
                Cancelar
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="text-sm text-bussola-blue hover:underline">
              + Adicionar arquivo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
