"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { PostFormModal } from "@/components/posts/PostFormModal";
import { sendPautaForApproval, regenerarLinkPauta } from "@/app/(app)/clientes/[clientId]/actions";
import { updatePostDate } from "@/app/(app)/posts/actions";
import { FORMAT_COLORS, FORMAT_LABELS, PAUTA_STATUS_LABELS } from "@/lib/status";
import type { Post, User, PostFormat, PautaApproval } from "@/lib/types";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const collisionStrategy: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCenter(args);
};

export function Calendar({
  clientId,
  posts,
  users,
  canCreate,
  pautas,
  canSendPauta,
}: {
  clientId: string;
  posts: Post[];
  users: User[];
  canCreate: boolean;
  pautas: PautaApproval[];
  canSendPauta: boolean;
}) {
  const router = useRouter();
  const hoje = new Date();
  const [year, setYear] = useState(hoje.getFullYear());
  const [month, setMonth] = useState(hoje.getMonth()); // 0-11
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [sending, startSending] = useTransition();
  const [incluirBriefing, setIncluirBriefing] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState("");
  const [periodoFim, setPeriodoFim] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [items, setItems] = useState<Post[]>(posts);
  const [prevPosts, setPrevPosts] = useState<Post[]>(posts);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [movePending, startMove] = useTransition();

  if (posts !== prevPosts) {
    setPrevPosts(posts);
    setItems(posts);
  }

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } })
  );

  const temPeriodo = Boolean(periodoInicio && periodoFim);
  const pauta = temPeriodo
    ? pautas.find(
        (p) => p.ano === year && p.mes === month + 1 && p.data_inicio === periodoInicio && p.data_fim === periodoFim
      ) ?? null
    : pautas.find((p) => p.ano === year && p.mes === month + 1 && p.data_inicio === null) ?? null;
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const pautaLink = pauta ? `${appUrl}/pauta/${pauta.token}` : null;

  function enviarPauta() {
    startSending(async () => {
      await sendPautaForApproval(
        clientId,
        year,
        month + 1,
        incluirBriefing,
        periodoInicio || null,
        periodoFim || null
      );
      router.refresh();
    });
  }
  function gerarNovoLink() {
    if (!confirm("O link atual vai parar de funcionar e um novo sera gerado. Continuar?")) return;
    startSending(async () => {
      await regenerarLinkPauta(
        clientId,
        year,
        month + 1,
        incluirBriefing,
        periodoInicio || null,
        periodoFim || null
      );
      router.refresh();
    });
  }

  async function copiarLink() {
    if (!pautaLink) return;
    await navigator.clipboard.writeText(pautaLink);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  }

  function abrirCriacao(dateStr: string) {
    if (!canCreate) return;
    setSelectedDate(dateStr);
    setFormOpen(true);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;
    const postId = String(active.id);
    const novaData = String(over.id);
    const post = items.find((p) => p.id === postId);
    if (!post || post.data_publicacao_planejada === novaData) return;

    // Atualização otimista: move na tela na hora, sem esperar o servidor.
    setItems((cur) =>
      cur.map((p) => (p.id === postId ? { ...p, data_publicacao_planejada: novaData } : p))
    );
    startMove(async () => {
      const res = await updatePostDate(postId, novaData);
      if (res?.error) {
        // reverte em caso de erro
        setItems((cur) =>
          cur.map((p) => (p.id === postId ? { ...p, data_publicacao_planejada: post.data_publicacao_planejada } : p))
        );
      }
      router.refresh();
    });
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // posts indexados por dia (YYYY-MM-DD)
  const porDia = new Map<string, Post[]>();
  for (const p of items) {
    if (!p.data_publicacao_planejada) continue;
    const arr = porDia.get(p.data_publicacao_planejada) ?? [];
    arr.push(p);
    porDia.set(p.data_publicacao_planejada, arr);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const activePost = activeId ? items.find((p) => p.id === activeId) ?? null : null;

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      {/* Cabeçalho + navegação */}
      <div className="mb-4 flex items-center justify-between">
        <button onClick={prevMonth}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">
          ← Mês anterior
        </button>
        <h3 className="text-lg font-semibold text-slate-800">{MESES[month]} {year}</h3>
        <button onClick={nextMonth}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-600 hover:bg-slate-100">
          Próximo mês →
        </button>
      </div>

      {/* Painel de aprovação de pauta do mês */}
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-slate-700">Pauta de {MESES[month]}:</span>
            {pauta ? (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                pauta.status === "aprovada"
                  ? "bg-emerald-100 text-emerald-700"
                  : pauta.status === "ajustes_solicitados"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-amber-100 text-amber-700"
              }`}>
                {PAUTA_STATUS_LABELS[pauta.status]}
              </span>
            ) : (
              <span className="text-slate-400">não enviada</span>
            )}
          </div>

          {canSendPauta && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 text-xs text-slate-600">
                <span>Período (opcional):</span>
                <input type="date" value={periodoInicio}
                  onChange={(e) => setPeriodoInicio(e.target.value)}
                  className="rounded border border-slate-300 px-1.5 py-1 text-xs" />
                <span>até</span>
                <input type="date" value={periodoFim}
                  onChange={(e) => setPeriodoFim(e.target.value)}
                  className="rounded border border-slate-300 px-1.5 py-1 text-xs" />
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={incluirBriefing}
                  onChange={(e) => setIncluirBriefing(e.target.checked)} />
                Incluir briefing
              </label>
              <button onClick={enviarPauta} disabled={sending}
                className="rounded-lg bg-bussola-yellow px-3 py-1.5 text-sm font-bold text-black hover:brightness-95 disabled:opacity-60">
                {sending
                  ? "..."
                  : periodoInicio && periodoFim
                  ? "Enviar período para aprovação"
                  : pauta
                  ? "Reenviar pauta"
                  : "Enviar pauta para aprovação"}
              </button>
              {pauta && (
                <button onClick={gerarNovoLink} disabled={sending}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60">
                  Gerar novo link
                </button>
              )}
            </div>
          )}
        </div>

        {pautaLink && (
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={pautaLink}
              className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600" />
            <button onClick={copiarLink}
              className="rounded bg-bussola-blue px-3 py-1 text-xs font-medium text-white hover:brightness-110">
              {copiado ? "Copiado!" : "Copiar"}
            </button>
          </div>
        )}

        {pauta?.responded_at && (
          <div className="mt-2 rounded-lg bg-white p-2 text-sm">
            <p className="text-xs text-slate-400">
              Resposta do cliente{pauta.autor_resposta ? ` — ${pauta.autor_resposta}` : ""}
            </p>
            {pauta.comentario ? (
              <p className="mt-0.5 whitespace-pre-wrap text-slate-700">{pauta.comentario}</p>
            ) : (
              <p className="mt-0.5 text-slate-400">Sem comentário geral.</p>
            )}
          </div>
        )}
      </div>

      {/* Legenda de formatos */}
      <div className="mb-3 flex flex-wrap gap-3">
        {(Object.keys(FORMAT_LABELS) as PostFormat[]).map((f) => (
          <span key={f} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-3 w-3 rounded-full ${FORMAT_COLORS[f]}`} />
            {FORMAT_LABELS[f]}
          </span>
        ))}
        {canCreate && (
          <span className="ml-auto text-xs text-slate-400">Arraste um post para mudar a data.</span>
        )}
      </div>

      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 gap-1 border-b border-slate-200 pb-1 text-center text-xs font-medium uppercase text-slate-400">
        {SEMANA.map((s) => <div key={s}>{s}</div>)}
      </div>

      {/* Grade */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionStrategy}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div className="grid grid-cols-7 gap-1 pt-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={`b-${idx}`} className="min-h-[110px]" />;
            const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
            const dayPosts = porDia.get(dateStr) ?? [];
            const isHoje = dateStr === hojeStr;
            return (
              <DayCell
                key={dateStr}
                dateStr={dateStr}
                day={day}
                isHoje={isHoje}
                canCreate={canCreate}
                onClickEmpty={() => abrirCriacao(dateStr)}
              >
                {dayPosts.map((p) => (
                  <DraggablePostBadge key={p.id} post={p} canDrag={canCreate} />
                ))}
              </DayCell>
            );
          })}
        </div>
        <DragOverlay dropAnimation={null}>
          {activePost ? (
            <span
              className={`block truncate rounded px-2 py-1 text-sm font-semibold text-white shadow-xl ring-2 ring-bussola-yellow ${FORMAT_COLORS[activePost.formato]}`}
            >
              {activePost.titulo}
            </span>
          ) : null}
        </DragOverlay>
      </DndContext>

      {canCreate && (
        <PostFormModal
          users={users}
          fixedClientId={clientId}
          defaultDate={selectedDate}
          open={formOpen}
          onOpenChange={setFormOpen}
        />
      )}
    </div>
  );
}

function DayCell({
  dateStr,
  day,
  isHoje,
  canCreate,
  onClickEmpty,
  children,
}: {
  dateStr: string;
  day: number;
  isHoje: boolean;
  canCreate: boolean;
  onClickEmpty: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dateStr });
  return (
    <div
      ref={setNodeRef}
      onClick={onClickEmpty}
      className={`min-h-[110px] rounded-lg border p-1.5 transition ${
        isOver ? "border-bussola-yellow bg-bussola-yellow/10 ring-2 ring-bussola-yellow" :
        isHoje ? "border-bussola-blue bg-blue-50/40" : "border-slate-200"
      } ${canCreate ? "cursor-pointer hover:border-bussola-yellow hover:bg-bussola-yellow/5" : ""}`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className={`text-xs font-semibold ${isHoje ? "text-bussola-blue" : "text-slate-500"}`}>
          {day}
        </span>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function DraggablePostBadge({ post, canDrag }: { post: Post; canDrag: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: post.id,
    disabled: !canDrag,
  });

  if (isDragging) {
    return (
      <div ref={setNodeRef} className="h-6 rounded border border-dashed border-slate-300" />
    );
  }

  return (
    <div ref={setNodeRef} className="touch-none">
      <div
        {...(canDrag ? { ...listeners, ...attributes } : {})}
        className={`flex items-center justify-between gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-white ${FORMAT_COLORS[post.formato]} ${canDrag ? "cursor-grab active:cursor-grabbing" : ""}`}
        title={`${post.titulo} (${FORMAT_LABELS[post.formato]})`}
      >
        <Link
          href={`/posts/${post.id}`}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 truncate hover:underline"
        >
          {post.titulo}
        </Link>
      </div>
    </div>
  );
}
