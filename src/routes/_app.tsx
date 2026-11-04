import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { AppSidebar, AppSidebarContent } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

/**
 * Ensures a matching row exists in `public.users` for the authenticated user.
 * This guarantees foreign key relationships in `social_accounts` and `content_queue`
 * succeed even if the database trigger was delayed, disabled, or bypassed.
 */
async function syncUserProfile(userId: string, email: string) {
  try {
    const { error } = await supabase.from("users").upsert(
      {
        id: userId,
        email: email || "",
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) {
      console.warn("Self-healing profile sync note:", error.message);
    }
  } catch (e) {
    console.warn("Could not sync user profile to database:", e);
  }
}

function AppLayout() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (!session) {
          navigate({ to: "/auth" });
        } else {
          if (session.user) {
            syncUserProfile(session.user.id, session.user.email || "");
          }
          setChecking(false);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
        if (isMounted) {
          navigate({ to: "/auth" });
        }
      }
    }

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;

      if (!session) {
        navigate({ to: "/auth" });
      } else {
        if (session.user) {
          syncUserProfile(session.user.id, session.user.email || "");
        }
        setChecking(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0a0a0f] text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-sm text-muted-foreground animate-pulse">
            Establishing secure workspace tunnel...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground md:flex-row">
      {/* Mobile Top Navigation Header */}
      <header className="flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 md:hidden">
        <div className="flex items-center gap-2">
          <BrandLogo />
        </div>
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent/50"
            >
              <Menu size={18} />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-72 bg-sidebar p-0 border-r border-sidebar-border text-sidebar-foreground"
          >
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <AppSidebarContent onNavigate={() => setIsMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </header>

      {/* Desktop Sidebar */}
      <AppSidebar />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
      <Toaster position="top-right" />
    </div>
  );
}
