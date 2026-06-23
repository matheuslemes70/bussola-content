"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { updatePostStatus } from "@/app/(app)/posts/actions";
import { STATUS_FLOW, KANBAN_COLUMN_ORDER, STATUS_LABELS, FORMAT_LABELS, isAtrasado, formatDate } from "@/lib/status";
import type { Post, PostStatus, User, Client } from "@/lib/types";

export function Kanban({
  posts,
  users,
  clients,
}: {
  posts: Post[];
  users: User[];
  clients?: Client[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // cópia local para mover o card na hora (otimista) enquanto o servidor confirma
  const [items, setItems] = useState<Post[]>(posts);
  const [prev, setPrev] = useState<Post[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);

  // ressincroniza quando os posts mudam (ex: após refresh do servidor)
  if (posts !== prev) {
    setPrev(posts);
    setItems(posts);
  }

  const userMap = new Map(users.map((u) => [u.id, u]));
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

  // Sensores: mouse (desktop, com distância p/ não atrapalhar cliques),
  // touch (mobile, com delay p/ permitir scroll e não disparar sem querer)
  // e teclado (acessibilidade).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  function move(post: Post, status: PostStatus) {
    if (status === post.status) return;
    setItems((cur) => cur.map((p) => (p.id === post.id ? { ...p, status } : p)));
    startTransition(async () => {
      await updatePostStatus(post.id, status);
      router.refresh();
    });
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const post = items.find((p) => p.id === active.id);
    const status = over.id as PostStatus;
    if (post) move(post, status);
  }

  const activePost = activeId ? items.find((p) => p.id === activeId) ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 [-webkit-overflow-scrolling:touch]">
        {KANBAN_COLUMN_ORDER.map((status) => {
          const col = items.filter((p) => p.status === status);
          return (
            <Column key={status} status={status} count={col.length}>
              {col.map((p) => (
                <Card
                  key={p.id}
                  post={p}
                  showClient={Boolean(clients)}
                  clientName={clientMap.get(p.client_id)?.nome}
                  respName={p.responsavel_id ? userMap.get(p.responsavel_id)?.nome || userMap.get(p.responsavel_id)?.email : undefined}
                  pending={pending}
                  onStatusChange={(s) => move(p, s)}
                />
              ))}
              {col.length === 0 && (
                <p className="px-1 py-4 text-center text-xs text-slate-400">—</p>
              )}
            </Column>
          );
        })}
      </div>

      {/* Pré-visualização que segue o dedo/cursor durante o arraste */}
      <DragOverlay dropAnimation={null}>
        {activePost ? (
          <div className="w-60 rotate-2 rounded-lg bg-white p-3 shadow-xl ring-2 ring-bussola-yellow">
            <CardBody
              post={activePost}
              showClient={Boolean(clients)}
              clientName={clientMap.get(activePost.client_id)?.nome}
              respName={activePost.responsavel_id ? userMap.get(activePost.responsavel_id)?.nome || userMap.get(activePost.responsavel_id)?.email : undefined}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  count,
  children,
}: {
  status: PostStatus;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-[80vw] max-w-[18rem] flex-shrink-0 snap-start flex-col rounded-xl p-2 transition sm:w-64 ${
        isOver ? "bg-bussola-yellow/20 ring-2 ring-bussola-yellow" : "bg-slate-100"
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-slate-700">{STATUS_LABELS[status]}</span>
        <span className="rounded-full bg-white px-2 text-xs text-slate-500">{count}</span>
      </div>
      <div className="min-h-[48px] space-y-2">{children}</div>
    </div>
  );
}

function Card({
  post,
  showClient,
  clientName,
  respName,
  pending,
  onStatusChange,
}: {
  post: Post;
  showClient: boolean;
  clientName?: string;
  respName?: string;
  pending: boolean;
  onStatusChange: (status: PostStatus) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: post.id,
  });
  const atrasado = isAtrasado(post);

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg bg-white p-3 shadow-sm ${atrasado ? "ring-1 ring-red-300" : ""} ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Alça de arraste (mouse + touch). touch-none evita o scroll roubar o gesto. */}
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label="Arrastar card"
          className="mt-0.5 flex-shrink-0 cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <circle cx="7" cy="5" r="1.5" />
            <circle cx="13" cy="5" r="1.5" />
            <circle cx="7" cy="10" r="1.5" />
            <circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="15" r="1.5" />
            <circle cx="13" cy="15" r="1.5" />
          </svg>
        </button>

        <div className="min-w-0 flex-1">
          <CardBody post={post} showClient={showClient} clientName={clientName} respName={respName} />
        </div>
      </div>

      <select
        value={post.status}
        disabled={pending}
        onChange={(e) => onStatusChange(e.target.value as PostStatus)}
        className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-1 py-1 text-xs text-slate-600"
      >
        {STATUS_FLOW.map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
    </div>
  );
}

// Conteúdo visual do card, reutilizado no card e no DragOverlay.
function CardBody({
  post,
  showClient,
  clientName,
  respName,
}: {
  post: Post;
  showClient: boolean;
  clientName?: string;
  respName?: string;
}) {
  const atrasado = isAtrasado(post);
  return (
    <>
      <Link href={`/posts/${post.id}`} className="block">
        <p className="text-sm font-medium text-slate-800 hover:text-bussola-blue">{post.titulo}</p>
      </Link>
      {showClient && (
        <p className="mt-0.5 text-xs font-medium text-bussola-blue">{clientName ?? "—"}</p>
      )}
      <div className="mt-1 text-xs text-slate-500">{FORMAT_LABELS[post.formato]}</div>
      {post.data_publicacao_planejada && (
        <div
          className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold ${
            atrasado ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600"
          }`}
        >
          {atrasado && (
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {formatDate(post.data_publicacao_planejada)}
        </div>
      )}
      {respName && <p className="mt-1 text-xs text-slate-400">{respName}</p>}
    </>
  );
}
