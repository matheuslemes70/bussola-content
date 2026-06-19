import "server-only";

import { createClient } from "@supabase/supabase-js";

// Client com a SECRET key (service role). IGNORA RLS.
// Usar APENAS no servidor e somente onde for estritamente necessário —
// hoje, na página pública de aprovação (sem login do cliente).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
