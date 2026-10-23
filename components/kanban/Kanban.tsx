"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  closestCorners,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updatePostStatus, reorderColumn } from "@/app/(app)/posts/actions";
import { STATUS_FLOW, KANBAN_COLUMN_ORDER, STATUS_LABELS, FORMAT_LABELS, isAtrasado, isProximoDoVencimento, formatDate } from "@/lib/status";
import type { Post, PostStatus, User, Client } from "@/lib/types";
import type { CollisionDetection } from "@dnd-kit/core";

// Detecta a coluna certa mesmo quando ela está vazia ou estreita: usa
// pointerWithin (posição exata do cursor) e só cai para closestCorners
// se o cursor não estiver dentro de nenhuma área (ex: fora de todas as colunas).
const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  return closestCorners(args);
};

// Ordem de exibição dentro de uma coluna: ordem manual primeiro (posts sem
// ordem definida vão por último), depois por data planejada e criação.
function compareOrder(a: Post, b: Post): number {
  const oa = a.ordem ?? Number.POSITIVE_INFINITY;
  const ob = b.ordem ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa - ob;
  const da = a.data_publicacao_planejada ?? "9999-12-31";
  const db = b.data_publicacao_planejada ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  return (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1;
}

// Ordena sempre por data + horário de entrega, ignorando ordem manual
// (usado na coluna "Pronto pra editar", onde prazo real deve mandar).
function compareByDataHorario(a: Post, b: Post): number {
  const da = a.data_publicacao_planejada ?? "9999-12-31";
  const db = b.data_publicacao_planejada ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  const ha = a.horario_publicacao_planejada ?? "23:59";
  const hb = b.horario_publicacao_planejada ?? "23:59";
  if (ha !== hb) return ha < hb ? -1 : 1;
  return (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1;
}

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
  const [items, setItems] = useState<Post[]>(posts);
  // Barra de rolagem espelho no topo, sincronizada com a rolagem real do quadro
  // (evita ter que descer a tela toda pra arrastar o quadro pros lados).
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [prev, setPrev] = useState<Post[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);

  // ressincroniza quando os posts mudam (ex: após refresh do servidor)
  if (posts !== prev) {
    setPrev(posts);
    setItems(posts);
  }

  const userMap = new Map(users.map((u) => [u.id, u]));
  const clientMap = new Map((clients ?? []).map((c) => [c.id, c]));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const columnOf = (status: PostStatus) => {
    const filtered = items.filter((p) => p.status === status).sort(compareByDataHorario);
    return status === "publicado" ? filtered.reverse() : filtered;
  };

  // Persiste a ordem de uma coluna (lista já reordenada) — otimista + servidor.
  function persistOrder(status: PostStatus, newCol: Post[]) {
    const orderMap = new Map(newCol.map((p, i) => [p.id, i] as const));
    setItems((cur) =>
      cur.map((p) => (orderMap.has(p.id) ? { ...p, status, ordem: orderMap.get(p.id)! } : p))
    );
    const ids = newCol.map((p) => p.id);
    startTransition(async () => {
      await reorderColumn(ids);
      router.refresh();
    });
  }

  // Move um card para outra coluna (muda status) e reindexa a coluna destino.
  function moveToColumn(post: Post, targetStatus: PostStatus, newTargetCol: Post[]) {
    const orderMap = new Map(newTargetCol.map((p, i) => [p.id, i] as const));
    setItems((cur) =>
      cur.map((p) => {
        if (p.id === post.id) return { ...p, status: targetStatus, ordem: orderMap.get(p.id) ?? 0 };
        if (orderMap.has(p.id)) return { ...p, ordem: orderMap.get(p.id)! };
        return p;
      })
    );
    const ids = newTargetCol.map((p) => p.id);
    startTransition(async () => {
      await updatePostStatus(post.id, targetStatus);
      await reorderColumn(ids);
      router.refresh();
    });
  }

  // Muda status via <select> do card (vai para o fim da coluna destino).
  function changeStatus(post: Post, status: PostStatus) {
    if (status === post.status) return;
    moveToColumn(post, status, [...columnOf(status), { ...post, status }]);
  }

  // Botões ↑/↓ (alternativa ao arraste, acessível/mobile).
  function reorderByButton(post: Post, dir: "up" | "down") {
    const col = columnOf(post.status);
    const from = col.findIndex((p) => p.id === post.id);
    const to = dir === "up" ? from - 1 : from + 1;
    if (from === -1 || to < 0 || to >= col.length) return;
    persistOrder(post.status, arrayMove(col, from, to));
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activePost = items.find((p) => p.id === active.id);
    if (!activePost) return;

    const overPost = items.find((p) => p.id === over.id);
    const targetStatus = (overPost ? overPost.status : over.id) as PostStatus;

    if (targetStatus === activePost.status) {
      // Reordenar dentro da mesma coluna.
      const col = columnOf(activePost.status);
      const oldIndex = col.findIndex((p) => p.id === active.id);
      const newIndex = overPost ? col.findIndex((p) => p.id === over.id) : col.length - 1;
      if (oldIndex === newIndex || newIndex < 0) return;
      persistOrder(activePost.status, arrayMove(col, oldIndex, newIndex));
    } else {
      // Mover para outra coluna, posicionando perto do card de destino.
      const targetCol = columnOf(targetStatus);
      const insertAt = overPost ? targetCol.findIndex((p) => p.id === over.id) : targetCol.length;
      const newTargetCol = [...targetCol];
      newTargetCol.splice(insertAt < 0 ? targetCol.length : insertAt, 0, { ...activePost, status: targetStatus });
      moveToColumn(activePost, targetStatus, newTargetCol);
    }
  }

  // Recalcula a largura total do quadro sempre que os itens mudam (colunas
  // podem crescer/encolher), pra barra espelho ficar do tamanho certo.
  useEffect(() => {
    if (scrollRef.current) {
      setScrollWidth(scrollRef.current.scrollWidth);
    }
  }, [items]);

  const syncingRef = useRef(false);

  function onTopScroll() {
    if (syncingRef.current) return;
    if (scrollRef.current && topScrollRef.current) {
      syncingRef.current = true;
      scrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      requestAnimationFrame(() => { syncingRef.current = false; });
    }
  }

  function onBoardScroll() {
    if (syncingRef.current) return;
    if (scrollRef.current && topScrollRef.current) {
      syncingRef.current = true;
      topScrollRef.current.scrollLeft = scrollRef.current.scrollLeft;
      requestAnimationFrame(() => { syncingRef.current = false; });
    }
  }

  const activePost = activeId ? items.find((p) => p.id === activeId) ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div
        ref={topScrollRef}
        onScroll={onTopScroll}
        className="mb-1 overflow-x-auto"
        style={{ height: 14 }}
      >
        <div style={{ width: scrollWidth, height: 1 }} />
      </div>
      <div
        ref={scrollRef}
        onScroll={onBoardScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 [-webkit-overflow-scrolling:touch]"
      >
        {KANBAN_COLUMN_ORDER.map((status) => {
          const col = columnOf(status);
          return (
            <Column key={status} status={status} count={col.length}>
              <SortableContext items={col.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {col.map((p, i) => (
                  <Card
                    key={p.id}
                    post={p}
                    showClient={Boolean(clients)}
                    clientName={clientMap.get(p.client_id)?.nome}
                    respName={p.responsavel_id ? userMap.get(p.responsavel_id)?.nome || userMap.get(p.responsavel_id)?.email : undefined}
                    pending={pending}
                    onStatusChange={(s) => changeStatus(p, s)}
                    canMoveUp={i > 0}
                    canMoveDown={i < col.length - 1}
                    onMoveUp={() => reorderByButton(p, "up")}
                    onMoveDown={() => reorderByButton(p, "down")}
                  />
                ))}
              </SortableContext>
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
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: {
  post: Post;
  showClient: boolean;
  clientName?: string;
  respName?: string;
  pending: boolean;
  onStatusChange: (status: PostStatus) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, transition, isDragging } =
    useSortable({ id: post.id });
  const atrasado = isAtrasado(post);
  const proximo = isProximoDoVencimento(post);
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg bg-white p-3 shadow-sm ${atrasado ? "ring-1 ring-red-300" : proximo ? "ring-1 ring-amber-300" : ""} ${
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

        {/* Reordenar dentro da coluna (alternativa ao arraste) */}
        <div className="flex flex-shrink-0 flex-col">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp || pending}
            aria-label="Mover para cima"
            className="text-slate-300 hover:text-bussola-blue disabled:pointer-events-none disabled:opacity-25"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 6a.75.75 0 01.53.22l4 4a.75.75 0 11-1.06 1.06L10 7.81l-3.47 3.47a.75.75 0 11-1.06-1.06l4-4A.75.75 0 0110 6z" clipRule="evenodd" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown || pending}
            aria-label="Mover para baixo"
            className="text-slate-300 hover:text-bussola-blue disabled:pointer-events-none disabled:opacity-25"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M10 14a.75.75 0 01-.53-.22l-4-4a.75.75 0 111.06-1.06L10 12.19l3.47-3.47a.75.75 0 111.06 1.06l-4 4A.75.75 0 0110 14z" clipRule="evenodd" />
            </svg>
          </button>
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
  const proximo = isProximoDoVencimento(post);
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
            atrasado ? "bg-red-100 text-red-700" : proximo ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
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
