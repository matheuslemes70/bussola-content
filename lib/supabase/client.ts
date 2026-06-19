"use client";

import { createBrowserClient } from "@supabase/ssr";

// Client para uso no browser (componentes client). Usa a publishable/anon key.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
