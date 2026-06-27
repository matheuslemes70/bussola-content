import "server-only";

// Envio de email transacional via Resend (API HTTP, sem SDK).
// Best-effort: nunca lança erro para não quebrar a ação que o chamou.
// Fica desativado (apenas loga) enquanto RESEND_API_KEY não estiver definida.
export async function sendEmail(opts: {
  to: string | (string | null | undefined)[] | null | undefined;
  subject: string;
  html: string;
}) {
  const { subject, html } = opts;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Bússola <onboarding@resend.dev>";

  // Normaliza para uma lista de destinatários únicos e não-vazios.
  const to = Array.from(
    new Set(
      (Array.isArray(opts.to) ? opts.to : [opts.to]).filter(
        (e): e is string => !!e && e.trim().length > 0
      )
    )
  );
  if (to.length === 0) return;

  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY ausente — não enviado: "${subject}" (${to.length} destinatário(s))`);
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      console.error("[email] falha ao enviar:", res.status, await res.text());
    }
  } catch (err) {
    console.error("[email] erro de rede:", err);
  }
}
