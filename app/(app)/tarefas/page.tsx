import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TodoList, type Todo } from "@/components/todo/TodoList";

export const dynamic = "force-dynamic";

// Recurso pessoal: só o Matheus acessa.
const MATHEUS_ID = "e5b89d87-34d3-45ae-b720-fc7762031d9b";

export default async function TarefasPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.id !== MATHEUS_ID) notFound();

  const agora = new Date();
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
  const dataExtenso = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(agora);

  // Pendentes de qualquer dia + tudo que é de hoje (inclusive o que já foi riscado).
  const { data } = await supabase
    .from("todos")
    .select("id, texto, feita, data")
    .eq("user_id", auth.user.id)
    .or(`feita.eq.false,data.eq.${hoje}`)
    .order("created_at");

  const todos = (data as Todo[]) ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Tarefas</h1>
        <p className="text-sm capitalize text-slate-400">{dataExtenso}</p>
      </div>
      <TodoList todos={todos} hoje={hoje} />
    </div>
  );
}
