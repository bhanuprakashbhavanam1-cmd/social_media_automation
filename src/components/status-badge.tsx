import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ActivityStatus } from "@/lib/mock-data";

const STYLES: Record<ActivityStatus, string> = {
  Published: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/10 text-[11px]",
  Scheduled: "bg-orange-500/10 text-orange-700 border-orange-500/30 hover:bg-orange-500/10 text-[11px]",
  Retrying: "bg-amber-500/10 text-amber-700 border-amber-500/30 hover:bg-amber-500/10 text-[11px]",
  Failed: "bg-red-500/10 text-red-700 border-red-500/30 hover:bg-red-500/10 text-[11px]",
};

export function StatusBadge({ status }: { status: ActivityStatus }) {
  return (
    <Badge variant="outline" className={cn("font-bold uppercase tracking-wider rounded-md px-2 py-0.5", STYLES[status])}>
      <span
        className={cn(
          "mr-1.5 h-1.5 w-1.5 rounded-full inline-block",
          status === "Published" && "bg-emerald-600",
          status === "Scheduled" && "bg-orange-600",
          status === "Retrying" && "bg-amber-600 animate-pulse",
          status === "Failed" && "bg-red-600",
        )}
      />
      {status}
    </Badge>
  );
}
