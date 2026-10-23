"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getMyNotifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { notifications: [], naoLidas: 0 };

  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const notifications = data ?? [];
  const naoLidas = notifications.filter((n) => !n.lida).length;
  return { notifications, naoLidas };
}

export async function markNotificationRead(id: string) {
  const supabase = await createClient();
  await supabase.from("notifications").update({ lida: true }).eq("id", id);
  revalidatePath("/");
  return { ok: true };
}

export async function markAllNotificationsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: true };
  await supabase.from("notifications").update({ lida: true }).eq("user_id", user.id).eq("lida", false);
  revalidatePath("/");
  return { ok: true };
}
