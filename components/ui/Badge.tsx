import { STATUS_COLORS, STATUS_LABELS } from "@/lib/status";
import type { PostStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function AtrasadoBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
      Atrasado
    </span>
  );
}
