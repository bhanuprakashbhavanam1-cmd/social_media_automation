import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Plug,
  Wand2,
  CalendarClock,
  LogOut,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NAV: ReadonlyArray<{
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}> = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/integrations", label: "Integrations", icon: Plug },
  { to: "/creator", label: "Campaign Creator", icon: Wand2 },
  { to: "/queue", label: "Content Queue", icon: CalendarClock },
];

export function AppSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState("");

  useEffect(() => {
    async function loadUserData() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;
        setUserEmail(session.user.email || "");
      } catch (err) {
        console.error("Error loading user sidebar data:", err);
      }
    }
    loadUserData();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("Logged out successfully");
      window.location.href = "/auth";
    } catch (err: any) {
      toast.error("Logout failed", { description: err.message });
    }
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#FFF1E6] text-slate-800 border-r border-orange-200/80 font-sans">
      <div className="px-5 pt-5 pb-4 border-b border-orange-200/60">
        <BrandLogo />
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="rounded-md bg-orange-200/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-orange-900/70">
          Workspace
        </div>
      </div>

      <nav className="mt-1 flex-1 space-y-1 px-3">
        {NAV.map(({ to, label, icon: Icon, exact }) => {
          const active = exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to as "/"}
              onClick={() => onNavigate?.()}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                active
                  ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/20 font-bold"
                  : "text-slate-700 hover:bg-orange-200/50 hover:text-slate-900",
              )}
            >
              <Icon
                size={16}
                className={cn(active ? "text-white" : "text-slate-500 group-hover:text-orange-600")}
              />
              <span>{label}</span>
              {to === "/creator" && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    active
                      ? "bg-white/20 text-white"
                      : "bg-orange-500/15 border border-orange-500/30 text-orange-700",
                  )}
                >
                  AI
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User profile & logout */}
      <div className="m-3 rounded-xl border border-orange-200/80 bg-white/70 backdrop-blur-md p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-xs font-bold text-white shadow-sm">
              {userEmail ? userEmail.substring(0, 2).toUpperCase() : "US"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-slate-900">
                {userEmail ? userEmail.split("@")[0] : "User"}
              </div>
              <div className="truncate text-xs text-slate-500">{userEmail}</div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="h-8 w-8 shrink-0 text-slate-500 hover:text-orange-600 hover:bg-orange-500/10 rounded-lg"
            title="Log Out"
          >
            <LogOut size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-orange-200/80 bg-[#FFF1E6] text-slate-800 md:flex">
      <AppSidebarContent />
    </aside>
  );
}
