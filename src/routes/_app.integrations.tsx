import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon, platformLabel } from "@/components/platform-icon";
import { PLATFORMS, type PlatformId } from "@/lib/mock-data";
import { Loader2, Shield, Check, Plug } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({ meta: [{ title: "Integrations — OmniMarket AI" }] }),
  component: IntegrationsPage,
});

type ConnState = "connected" | "disconnected" | "connecting" | "error";

const INITIAL: Record<PlatformId, ConnState> = {
  instagram: "disconnected",
  facebook: "disconnected",
  x: "disconnected",
  youtube: "disconnected",
};

function IntegrationsPage() {
  const [states, setStates] = useState<Record<PlatformId, ConnState>>(INITIAL);
  const [accountNames, setAccountNames] = useState<Record<PlatformId, string | null>>({
    instagram: null,
    facebook: null,
    x: null,
    youtube: null,
  });
  const [loadingPlatform, setLoadingPlatform] = useState<PlatformId | null>(null);

  // Manual Instagram Connection States
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [reminderUsername, setReminderUsername] = useState("");
  const [reminderMethod, setReminderMethod] = useState<"email" | "push">("email");
  const [reminderStep, setReminderStep] = useState<"choose" | "details">("choose");
  const [isSavingReminder, setIsSavingReminder] = useState(false);

  const fetchConnectedAccounts = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setStates(INITIAL);
        setAccountNames({ instagram: null, facebook: null, x: null, youtube: null });
        return;
      }

      const { data, error } = await supabase
        .from("social_accounts")
        .select("platform_name, platform_account_name")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Error fetching social accounts:", error.message);
        return;
      }

      const newStates = { ...INITIAL };
      const newNames = { instagram: null, facebook: null, x: null, youtube: null };

      if (data) {
        data.forEach((acc) => {
          const p = acc.platform_name as PlatformId;
          if (newStates[p] !== undefined) {
            newStates[p] = "connected";
            newNames[p] = acc.platform_account_name || "Connected Account";
          }
        });
      }

      setStates(newStates);
      setAccountNames(newNames);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Error checking account connections:", errorMsg);
    }
  };

  useEffect(() => {
    let active = true;

    const handleOAuthCallbackAndLoad = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session fetch error:", sessionError);
          if (active) fetchConnectedAccounts();
          return;
        }

        // Check if we returned with a provider token AND have an active initiator flag in storage.
        // This ensures the upsert only triggers on a new callback redirect, not on a normal page refresh.
        const initiator = localStorage.getItem("oauth_initiator");

        // Extract provider token and refresh token from session first
        let providerToken = session?.provider_token || null;
        let providerRefreshToken = session?.provider_refresh_token || null;

        if (typeof window !== "undefined") {
          if (window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
            const hashToken = hashParams.get("provider_token");
            const hashRefToken = hashParams.get("provider_refresh_token");
            if (hashToken) providerToken = hashToken;
            if (hashRefToken) providerRefreshToken = hashRefToken;
          }
          if (window.location.search) {
            const searchParams = new URLSearchParams(window.location.search);
            const searchToken = searchParams.get("provider_token");
            const searchRefToken = searchParams.get("provider_refresh_token");
            if (searchToken) providerToken = searchToken;
            if (searchRefToken) providerRefreshToken = searchRefToken;
          }
        }

        if (session && providerToken && initiator) {
          const primaryProvider = session.user?.app_metadata?.provider || "";
          const identities = session.user?.identities || [];
          const platformName = initiator as PlatformId;

          // Check if either the primary provider or any of the linked identities match the initiator
          let isValid = false;
          let matchedProvider = "";

          const matchesGoogle =
            primaryProvider === "google" || identities.some((i) => i.provider === "google");
          const matchesTwitter =
            primaryProvider === "twitter" || identities.some((i) => i.provider === "twitter");
          const matchesFacebook =
            primaryProvider === "facebook" || identities.some((i) => i.provider === "facebook");

          if (platformName === "youtube" && matchesGoogle) {
            isValid = true;
            matchedProvider = "google";
          } else if (platformName === "x" && matchesTwitter) {
            isValid = true;
            matchedProvider = "twitter";
          } else if (
            (platformName === "facebook" || platformName === "instagram") &&
            matchesFacebook
          ) {
            isValid = true;
            matchedProvider = "facebook";
          }

          console.log("OAuth Callback validation:", {
            platformName,
            primaryProvider,
            identities: identities.map((i) => i.provider),
            isValid,
            matchedProvider,
          });

          if (!isValid) {
            // Ignore this callback because it belongs to a different provider
            localStorage.removeItem("oauth_initiator");
            return;
          }

          // Use the matched provider to find identity ID, default to first match or user ID
          const providerIdentity = identities.find((i) => i.provider === matchedProvider);
          const platformAccountId = providerIdentity?.id || session.user.id;

          // Upsert the oauth details into social_accounts table
          const { error: upsertError } = await supabase.from("social_accounts").upsert(
            {
              user_id: session.user.id,
              platform_name: platformName,
              platform_account_id: platformAccountId,
              platform_account_name:
                session.user.user_metadata?.full_name || session.user.email || "Connected Account",
              access_token: providerToken,
              refresh_token: providerRefreshToken,
              token_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
            },
            {
              onConflict: "user_id,platform_name,platform_account_id",
            },
          );

          if (upsertError) {
            console.error("Error saving connected social account:", upsertError.message);
            toast.error(`Failed to save ${platformLabel(platformName)} connection.`, {
              description: upsertError.message,
            });
          } else {
            toast.success(`${platformLabel(platformName)} connected successfully!`, {
              description: "Tokens securely saved to Supabase backend.",
            });
          }

          // Clear query parameters & storage flag
          localStorage.removeItem("oauth_initiator");
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.search = "";
            url.hash = "";
            window.history.replaceState({}, "", url.pathname);
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("Error during session parsing:", errorMsg);
      }

      if (active) {
        fetchConnectedAccounts();
      }
    };

    handleOAuthCallbackAndLoad();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      if (active) fetchConnectedAccounts();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleConnect = async (platformId: PlatformId) => {
    setLoadingPlatform(platformId);

    let provider: "facebook" | "google" | "twitter" = "google";
    let scopes = "";

    if (platformId === "youtube") {
      provider = "google";
      scopes =
        "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly";
    } else if (platformId === "facebook" || platformId === "instagram") {
      provider = "facebook";
      scopes =
        "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,pages_manage_posts";
    } else if (platformId === "x") {
      provider = "twitter";
      scopes = "tweet.read tweet.write users.read offline.access";
    }

    localStorage.setItem("oauth_initiator", platformId);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/integrations`,
        scopes: scopes,
        queryParams: {
          access_type: "offline", // Demanded by pg_cron for background publishing workflows
          prompt: "consent",
        },
      },
    });

    if (error) {
      console.error("OAuth Transmission Error:", error.message);
      toast.error("OAuth Transmission Error", {
        description: error.message,
      });
      setLoadingPlatform(null);
    }
  };

  const handleDisconnect = async (p: PlatformId) => {
    setLoadingPlatform(p);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("You must be logged in to disconnect accounts.");
        setLoadingPlatform(null);
        return;
      }

      const { error } = await supabase
        .from("social_accounts")
        .delete()
        .eq("user_id", session.user.id)
        .eq("platform_name", p);

      if (error) {
        console.error("Disconnect Error:", error.message);
        toast.error(`Could not disconnect ${platformLabel(p)}`);
      } else {
        setStates((s) => ({ ...s, [p]: "disconnected" }));
        setAccountNames((n) => ({ ...n, [p]: null }));
        toast.success(`${platformLabel(p)} disconnected`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Disconnect processing error:", errorMsg);
    } finally {
      setLoadingPlatform(null);
    }
  };

  const handleSaveReminderMode = async () => {
    if (!reminderUsername) {
      toast.error("Please enter a valid Instagram handle.");
      return;
    }

    setIsSavingReminder(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("You must be logged in to connect accounts.");
        setIsSavingReminder(false);
        return;
      }

      const formattedHandle = reminderUsername.startsWith("@")
        ? reminderUsername
        : `@${reminderUsername}`;
      const uniqueId = `reminder_ig_${Math.random().toString(36).substring(2, 10)}`;

      const { error: upsertError } = await supabase.from("social_accounts").upsert(
        {
          user_id: session.user.id,
          platform_name: "instagram",
          platform_account_id: uniqueId,
          platform_account_name: `${formattedHandle} (Reminder Mode: ${reminderMethod === "email" ? "Email" : "Push"})`,
          access_token: `reminder_mode_${reminderMethod}`,
          refresh_token: null,
          token_expires_at: null,
        },
        {
          onConflict: "user_id,platform_name,platform_account_id",
        },
      );

      if (upsertError) {
        console.error("Error saving reminder connection:", upsertError.message);
        toast.error("Failed to connect in Reminder Mode", {
          description: upsertError.message,
        });
      } else {
        toast.success("Instagram Connected in Reminder Mode!", {
          description: `Reminders will be sent to your account via ${reminderMethod === "email" ? "Email" : "Mobile Push"}.`,
        });
        setIsSelectorOpen(false);
        setReminderUsername("");
        setReminderStep("choose");
        fetchConnectedAccounts();
      }
    } catch (err: any) {
      console.error("Reminder connection error:", err.message);
      toast.error("An error occurred during manual connection.");
    } finally {
      setIsSavingReminder(false);
    }
  };

  return (
    <div className="px-8 py-7 bg-[#FFF6ED] min-h-screen text-slate-900">
      <header className="mb-7 border-b border-orange-200/80 pb-5">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">Platform integrations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Connect your business accounts to publish, schedule, and monitor automatically.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-2">
        {PLATFORMS.map((p) => {
          const state = states[p.id];
          const connected = state === "connected";
          const loading = loadingPlatform === p.id;

          return (
            <Card key={p.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <PlatformIcon platform={p.id} withBg size={20} />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold tracking-tight">{p.name}</h3>
                      {connected && (
                        <Badge
                          variant="outline"
                          className="border-success/40 bg-success/10 text-success"
                        >
                          <Check size={10} className="mr-1" /> Connected
                        </Badge>
                      )}
                      {!connected && !loading && (
                        <Badge variant="outline" className="text-muted-foreground">
                          Disconnected
                        </Badge>
                      )}
                      {loading && (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 text-primary animate-pulse"
                        >
                          Connecting…
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {connected ? accountNames[p.id] : p.handle}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-md border bg-muted/40 p-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <Shield size={11} /> Required permissions
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {p.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="rounded bg-background px-2 py-0.5 font-mono text-[10px] text-foreground/80 border"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  onClick={() =>
                    connected
                      ? handleDisconnect(p.id)
                      : p.id === "instagram"
                        ? setIsSelectorOpen(true)
                        : handleConnect(p.id)
                  }
                  disabled={loading}
                  variant={connected ? "outline" : "default"}
                  className={cn(
                    "flex-1",
                    connected &&
                    "hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40",
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="mr-2 animate-spin" /> Working…
                    </>
                  ) : connected ? (
                    "Disconnect"
                  ) : (
                    <>
                      <Plug size={14} className="mr-2" /> Connect account
                    </>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {isSelectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border bg-card p-6 shadow-lg animate-in zoom-in-95 duration-200">
            <button
              onClick={() => {
                setIsSelectorOpen(false);
                setReminderStep("choose");
                setReminderUsername("");
              }}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span className="sr-only">Close</span>
            </button>

            {reminderStep === "choose" ? (
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Connect Instagram</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Select your preferred method to post and schedule content to Instagram.
                </p>

                <div className="mt-5 space-y-3">
                  <div
                    onClick={() => {
                      setIsSelectorOpen(false);
                      handleConnect("instagram");
                    }}
                    className="group relative flex flex-col rounded-lg border p-4 hover:border-primary/50 hover:bg-accent/40 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <span className="text-primary font-bold text-xs uppercase tracking-wider bg-primary/10 px-2 py-0.5 rounded">
                        ⚡ Direct Auto-Publish
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Posts publish automatically at the scheduled time. Requires linking your
                      Instagram Business account to an active Facebook Page.
                    </p>
                  </div>

                  <div
                    onClick={() => setReminderStep("details")}
                    className="group relative flex flex-col rounded-lg border p-4 hover:border-primary/50 hover:bg-accent/40 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <span className="text-amber-500 font-bold text-xs uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded">
                        📱 Manual Reminder Mode
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      No Facebook required! Type your handle and schedule posts. We will send you a
                      prompt to post manually when the time arrives.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Manual Reminder Mode</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Connect your Instagram handle without any Facebook integration.
                </p>

                <div className="mt-4 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground/80">
                      Instagram Handle
                    </label>
                    <input
                      type="text"
                      placeholder="@username"
                      value={reminderUsername}
                      onChange={(e) => setReminderUsername(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground/80">
                      Notification Channel
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setReminderMethod("email")}
                        className={cn(
                          "rounded-md border p-2.5 text-xs font-medium transition-all text-center",
                          reminderMethod === "email"
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "hover:bg-accent/40 text-muted-foreground",
                        )}
                      >
                        Email Reminders
                      </button>
                      <button
                        type="button"
                        onClick={() => setReminderMethod("push")}
                        className={cn(
                          "rounded-md border p-2.5 text-xs font-medium transition-all text-center",
                          reminderMethod === "push"
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "hover:bg-accent/40 text-muted-foreground",
                        )}
                      >
                        Mobile App Push
                      </button>
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setReminderStep("choose")}
                      disabled={isSavingReminder}
                      className="w-1/3"
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSaveReminderMode}
                      disabled={isSavingReminder}
                      className="flex-1"
                    >
                      {isSavingReminder ? (
                        <>
                          <Loader2 size={14} className="mr-2 animate-spin" /> Saving…
                        </>
                      ) : (
                        "Save Connection"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
