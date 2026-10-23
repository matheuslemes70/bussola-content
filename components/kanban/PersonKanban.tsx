"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCorners,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { updatePostStatus, updatePostPerson, reorderColumn } from "@/app/(app)/posts/actions";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_FLOW,
  FORMAT_LABELS,
  isAtrasado,
  isProximoDoVencimento,
  formatDate,
} from "@/lib/status";
import type { Post, PostStatus, User, Client } from "@/lib/types";

const FABRICIO_ID = "824e5915-bf16-43e5-8a2d-ac9a47c5d953";
const ANA_LUIZA_ID = "dfff4e0f-3a03-47d8-8658-5e6ad77d63de";
const DANIEL_ID = "233fb85d-5e72-42b4-a494-b8820ab1bcce";

const MATHEUS_ID = "e5b89d87-34d3-45ae-b720-fc7762031d9b";
const GABRIELLY_ID = "4cdf3a03-ef7c-4842-a9b3-7e4559092adc";
const VITORIA_ID = "dec92e5d-0ffb-4cdd-a3cc-2293e2417e2a";

const PESSOAS = [
  { id: FABRICIO_ID, label: "Fabricio" },
  { id: ANA_LUIZA_ID, label: "Ana Luiza" },
  { id: DANIEL_ID, label: "Daniel" },
  { id: VITORIA_ID, label: "Vitoria" },
  { id: MATHEUS_ID, label: "Matheus" },
];

const ETAPAS_PRODUCAO: PostStatus[] = ["a_produzir", "pronto_pra_editar", "em_producao", "alterar"];

type ColunaTipo = { kind: "pessoa"; id: string; label: string } | { kind: "status"; status: PostStatus; label: string };

const COLUNAS: ColunaTipo[] = [
  ...PESSOAS.map((p) => ({ kind: "pessoa" as const, id: p.id, label: p.label })),
  { kind: "status", status: "para_aprovacao", label: "Para aprovação" },
  { kind: "status", status: "aprovado", label: "Aprovado" },
  { kind: "status", status: "publicado", label: "Postado" },
];

function compareOrder(a: Post, b: Post): number {
  const oa = a.ordem ?? Number.POSITIVE_INFINITY;
  const ob = b.ordem ?? Number.POSITIVE_INFINITY;
  if (oa !== ob) return oa - ob;
  const da = a.data_publicacao_planejada ?? "9999-12-31";
  const db = b.data_publicacao_planejada ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  return (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1;
}

// Colunas de pessoa juntam posts de varias etapas diferentes, entao a "ordem"
// manual antiga (que so fazia sentido dentro de uma unica etapa) fica sem
// sentido. Nessas colunas, ordena sempre por data + horario de entrega.
function compareByDataHorario(a: Post, b: Post): number {
  const da = a.data_publicacao_planejada ?? "9999-12-31";
  const db = b.data_publicacao_planejada ?? "9999-12-31";
  if (da !== db) return da < db ? -1 : 1;
  const ha = a.horario_publicacao_planejada ?? "23:59";
  const hb = b.horario_publicacao_planejada ?? "23:59";
  if (ha !== hb) return ha < hb ? -1 : 1;
  return (a.created_at ?? "") < (b.created_at ?? "") ? -1 : 1;
}

const collisionStrategy: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCorners(args);
};

function colunaIdDoPost(post: Post): string {
  if (ETAPAS_PRODUCAO.includes(post.status)) return `pessoa:${post.responsavel_id}`;
  return `status:${post.status}`;
}

export function PersonKanban({
  posts,
  users,
  clients,
}: {
  posts: Post[];
  users: User[];
  clients: Client[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [items, setItems] = useState<Post[]>(posts);
  // Barra de rolagem espelho no topo, sincronizada com a rolagem real do quadro.
  const scrollRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const syncingRef = useRef(false);
  const [prev, setPrev] = useState<Post[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (posts !== prev) {
    setPrev(posts);
    setItems(posts);
  }

  const userMap = new Map(users.map((u) => [u.id, u]));
  const clientMap = new Map(clients.map((c) => [c.id, c]));

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const columnOf = (col: ColunaTipo) => {
    if (col.kind === "pessoa") {
      const filtered = items.filter((p) => p.responsavel_id === col.id && ETAPAS_PRODUCAO.includes(p.status));
      return filtered.sort(compareByDataHorario);
    }
    const filtered = items.filter((p) => p.status === col.status).sort(compareByDataHorario);
    return col.status === "publicado" ? filtered.reverse() : filtered;
  };

  function persistOrder(colunaId: string, novaLista: Post[]) {
    const orderMap = new Map(novaLista.map((p, i) => [p.id, i]));
    setItems((cur) => cur.map((p) => (orderMap.has(p.id) ? { ...p, ordem: orderMap.get(p.id)! } : p)));
    startTransition(async () => {
      await reorderColumn(novaLista.map((p) => p.id));
      router.refresh();
    });
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
    const overColunaId = overPost ? colunaIdDoPost(overPost) : String(over.id);
    const currentColunaId = colunaIdDoPost(activePost);

    if (overColunaId === currentColunaId) {
      // Reordenar dentro da mesma coluna.
      const col = COLUNAS.find((c) =>
        c.kind === "pessoa" ? `pessoa:${c.id}` === currentColunaId : `status:${c.status}` === currentColunaId
      );
      if (!col) return;
      const lista = columnOf(col);
      const oldIndex = lista.findIndex((p) => p.id === active.id);
      const newIndex = overPost ? lista.findIndex((p) => p.id === over.id) : lista.length - 1;
      if (oldIndex === newIndex || newIndex < 0) return;
      persistOrder(currentColunaId, arrayMove(lista, oldIndex, newIndex));
      return;
    }

    // Mudou de coluna.
    const [tipo, valor] = overColunaId.split(":");
    if (tipo === "pessoa") {
      setItems((cur) =>
        cur.map((p) =>
          p.id === activePost.id
            ? { ...p, responsavel_id: valor, status: ETAPAS_PRODUCAO.includes(p.status) ? p.status : "a_produzir" }
            : p
        )
      );
      startTransition(async () => {
        await updatePostPerson(activePost.id, valor);
        router.refresh();
      });
    } else {
      setItems((cur) => cur.map((p) => (p.id === activePost.id ? { ...p, status: valor as PostStatus } : p)));
      startTransition(async () => {
        await updatePostStatus(activePost.id, valor as PostStatus);
        router.refresh();
      });
    }
  }

  function changeEtapa(post: Post, novaEtapa: PostStatus) {
    setItems((cur) => cur.map((p) => (p.id === post.id ? { ...p, status: novaEtapa } : p)));
    startTransition(async () => {
      await updatePostStatus(post.id, novaEtapa);
      router.refresh();
    });
  }

  useEffect(() => {
    if (scrollRef.current) {
      setScrollWidth(scrollRef.current.scrollWidth);
    }
  }, [items]);

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
      collisionDetection={collisionStrategy}
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
        className="flex items-start snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-3 [-webkit-overflow-scrolling:touch]"
      >
        {COLUNAS.map((col) => {
          const colId = col.kind === "pessoa" ? `pessoa:${col.id}` : `status:${col.status}`;
          const lista = columnOf(col);
          return (
            <Column key={colId} colId={colId} label={col.label} count={lista.length}>
              <SortableContext items={lista.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                {lista.map((p) => (
                  <Card
                    key={p.id}
                    post={p}
                    clientName={clientMap.get(p.client_id)?.nome}
                    mostraEtapa={true}
                    pending={pending}
                    onChangeEtapa={(s) => changeEtapa(p, s)}
                  />
                ))}
              </SortableContext>
              {lista.length === 0 && <p className="px-1 py-4 text-center text-xs text-slate-400">—</p>}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activePost ? (
          <div className="w-60 rotate-2 rounded-lg bg-white p-3 shadow-xl ring-2 ring-bussola-yellow">
            <p className="text-sm font-semibold text-slate-800">{activePost.titulo}</p>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  colId,
  label,
  count,
  children,
}: {
  colId: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: colId });
  return (
    <div
      ref={setNodeRef}
      className={`flex w-[80vw] max-w-[18rem] flex-shrink-0 snap-start flex-col rounded-xl p-2 transition sm:w-64 ${
        isOver ? "bg-bussola-yellow/20 ring-2 ring-bussola-yellow" : "bg-slate-100"
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <span className="rounded-full bg-white px-2 text-xs text-slate-500">{count}</span>
      </div>
      <div className="min-h-[48px] space-y-2">{children}</div>
    </div>
  );
}

function Card({
  post,
  clientName,
  mostraEtapa,
  pending,
  onChangeEtapa,
}: {
  post: Post;
  clientName?: string;
  mostraEtapa: boolean;
  pending: boolean;
  onChangeEtapa: (s: PostStatus) => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useSortable({ id: post.id });
  const atrasado = isAtrasado(post);
  const proximo = isProximoDoVencimento(post);
  const hojeStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const eHoje = post.data_publicacao_planejada === hojeStr;

  const style = {
    transform: undefined,
  };

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg p-3 shadow-sm ${
        atrasado
          ? "bg-red-50 ring-1 ring-red-300"
          : eHoje
          ? "bg-emerald-50 ring-1 ring-emerald-300"
          : "bg-slate-50"
      } ${isDragging ? "opacity-40" : ""}`}
    >
      <div className="flex items-start gap-2">
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          aria-label="Arrastar card"
          className="mt-0.5 flex-shrink-0 cursor-grab touch-none text-slate-300 hover:text-slate-500 active:cursor-grabbing"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
            <circle cx="7" cy="5" r="1.5" /><circle cx="13" cy="5" r="1.5" />
            <circle cx="7" cy="10" r="1.5" /><circle cx="13" cy="10" r="1.5" />
            <circle cx="7" cy="15" r="1.5" /><circle cx="13" cy="15" r="1.5" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <Link href={`/posts/${post.id}`} className="block">
            <p className="truncate text-sm font-medium text-slate-800 hover:text-bussola-blue">{post.titulo}</p>
          </Link>
          {clientName && <p className="mt-0.5 truncate text-xs font-medium text-bussola-blue">{clientName}</p>}
          <p className="mt-0.5 text-xs text-slate-400">{FORMAT_LABELS[post.formato]}</p>
          {post.data_publicacao_planejada && (
            <p className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
              atrasado
                ? "bg-red-100 text-red-700"
                : eHoje
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600"
            }`}>
              {formatDate(post.data_publicacao_planejada)}{post.horario_publicacao_planejada ? ` \u00b7 ${post.horario_publicacao_planejada.slice(0, 5)}` : ""}
            </p>
          )}
          {mostraEtapa && (
            <select
              value={post.status}
              onChange={(e) => onChangeEtapa(e.target.value as PostStatus)}
              disabled={pending}
              className={`mt-2 w-full rounded px-1.5 py-1 text-xs font-medium outline-none ${STATUS_COLORS[post.status]}`}
            >
              {STATUS_FLOW.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}
