import { Flame } from "lucide-react";

export function BrandLogo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5 group">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20 group-hover:scale-105 transition-transform">
        <Flame size={18} className="animate-pulse" />
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-1">
            OmniMarket <span className="text-orange-600 font-extrabold">AI</span>
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Automation Suite
          </span>
        </div>
      )}
    </div>
  );
}
