import { ReactNode } from "react";
import { Inbox, SearchX, Clock, AlertTriangle } from "lucide-react";

export type EmptyStateKind = "empty" | "search" | "pending" | "error";

const ICONS: Record<EmptyStateKind, typeof Inbox> = {
  empty: Inbox,
  search: SearchX,
  pending: Clock,
  error: AlertTriangle,
};

export function EmptyState({
  kind = "empty",
  title,
  description,
  action,
}: {
  kind?: EmptyStateKind;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const Icon = ICONS[kind];
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-border bg-surface-2 py-16 px-6 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-surface text-ink-3 border border-border">
        <Icon className="size-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="text-sm text-ink-3 mt-1 max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
