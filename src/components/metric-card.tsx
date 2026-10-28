import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  delta,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  delta?: { value: string; positive?: boolean };
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        "p-5 border border-orange-200/80 transition-all duration-200 hover:border-orange-400/80 bg-white shadow-sm text-slate-900",
        accent && "border-orange-300 bg-orange-50/60 shadow-orange-500/5",
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {label}
          </div>
          <div className="text-3xl font-extrabold tracking-tight text-slate-900 tabular-nums">
            {value}
          </div>
          {sub && <div className="text-xs text-slate-500 font-medium">{sub}</div>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl shadow-sm",
            accent
              ? "bg-gradient-to-br from-orange-500 to-amber-500 text-white"
              : "bg-orange-500/10 text-orange-600 border border-orange-200/60",
          )}
        >
          <Icon size={18} />
        </div>
      </div>
      {delta && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-bold",
              delta.positive
                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                : "bg-red-500/10 text-red-700 border border-red-500/20",
            )}
          >
            {delta.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {delta.value}
          </span>
          <span className="text-slate-500 font-medium">vs last 30d</span>
        </div>
      )}
    </Card>
  );
}
