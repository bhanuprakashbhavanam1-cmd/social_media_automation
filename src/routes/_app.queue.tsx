import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformIcon, platformLabel } from "@/components/platform-icon";
import { type QueueItem, type PlatformId } from "@/lib/mock-data";
import {
  CalendarClock,
  Send,
  X,
  Clock,
  User,
  Bot,
  Loader2,
  Terminal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { getPlatformLogs, clearPlatformLogs } from "@/lib/api/logs.functions";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * Converts a datetime-local input string (e.g. "2026-06-13T13:10") into a
 * correct UTC ISO string by treating the value as LOCAL browser time.
 * Without this fix, new Date("2026-06-13T13:10") is parsed as UTC, causing
 * posts to publish hours later than intended.
 */
function localDateTimeToUTC(dtLocalStr: string): string {
  if (!dtLocalStr) return "";
  const d = new Date(`${dtLocalStr}:00`);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

export const Route = createFileRoute("/_app/queue")({
  head: () => ({ meta: [{ title: "Content Queue — OmniMarket AI" }] }),
  component: QueuePage,
});

interface ExtendedQueueItem extends QueueItem {
  dbId: string;
  rawTime: string;
  status: string;
  errorMessage?: string | null;
}

function QueuePage() {
  const [items, setItems] = useState<ExtendedQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar" | "logs">("list");
  const [logs, setLogs] = useState<string>("Loading logs...");
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [reschedulingItem, setReschedulingItem] = useState<{
    id: string;
    dbId: string;
    time: string;
  } | null>(null);

  const fetchLogs = async () => {
    setIsLogsLoading(true);
    try {
      const res = await getPlatformLogs();
      setLogs(res.logs);
    } catch (err: any) {
      setLogs(`Error fetching platform logs: ${err.message}`);
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (view === "logs") {
      fetchLogs();
    }
  }, [view]);

  const fetchQueueItems = async () => {
    setIsLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setItems([]);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("content_queue")
        .select("*")
        .eq("user_id", session.user.id)
        .in("status", ["pending", "failed"])
        .order("scheduled_time", { ascending: true });

      if (error) throw error;

      const formatted: ExtendedQueueItem[] = [];
      if (data) {
        data.forEach((row: any) => {
          row.platform_targets.forEach((platform: PlatformId) => {
            let type: any = "Post";
            if (row.ai_generated_content?.post_format === "story") {
              type = "Story";
            } else if (row.ai_generated_content?.post_format === "video") {
              type = "Video";
            } else if (row.ai_generated_content?.post_format === "short") {
              type = "Short";
            } else if (platform === "instagram") {
              type = "Reel";
            } else if (platform === "youtube") {
              type = "Short";
            } else if (platform === "x") {
              type = "Tweet";
            }

            const caption =
              row.ai_generated_content?.captions?.[platform] ||
              row.ai_generated_content?.captions?.instagram ||
              "Campaign Post";
            const cleanTitle = caption.length > 55 ? `${caption.substring(0, 55)}...` : caption;

            const scheduledDate = new Date(row.scheduled_time);
            const options: Intl.DateTimeFormatOptions = {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            };
            const scheduledFor = scheduledDate.toLocaleString("en-US", options);

            formatted.push({
              id: `${row.id}-${platform}`,
              dbId: row.id,
              platform,
              title: cleanTitle,
              type,
              scheduledFor,
              source: "Automated",
              rawTime: row.scheduled_time,
              status: row.status,
              errorMessage: row.error_message,
            });
          });
        });
      }
      setItems(formatted);
    } catch (err: any) {
      console.error("Error fetching queue items:", err);
      toast.error("Failed to load content queue", {
        description: err.message || "Failed to query pending queue entries.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueueItems();
  }, []);

  async function publishNow(dbId: string, id: string) {
    toast.loading("Publishing campaign post now...", { id });
    try {
      const { error: updateError } = await supabase
        .from("content_queue")
        .update({
          scheduled_time: new Date().toISOString(),
          status: "pending",
          error_message: null,
        })
        .eq("id", dbId);

      if (updateError) throw updateError;

      const { data, error: invokeError } = await supabase.functions.invoke("publish-queue");
      if (invokeError) throw invokeError;

      toast.success("Campaign published successfully!", { id });
      fetchQueueItems();
    } catch (err: any) {
      console.error("Force publish error:", err);
      toast.error("Publishing Failed", {
        id,
        description: err.message || "Failed to force publish campaign post.",
      });
    }
  }

  async function cancel(dbId: string, id: string) {
    toast.loading("Cancelling scheduled post...", { id });
    try {
      const { data: postData } = await supabase
        .from("content_queue")
        .select("media_url")
        .eq("id", dbId)
        .single();

      const { error: deleteError } = await supabase.from("content_queue").delete().eq("id", dbId);

      if (deleteError) throw deleteError;

      if (postData?.media_url) {
        const storageMarker = "/storage/v1/object/public/media/";
        const index = postData.media_url.indexOf(storageMarker);
        if (index !== -1) {
          const filePath = decodeURIComponent(
            postData.media_url.substring(index + storageMarker.length),
          );
          await supabase.storage.from("media").remove([filePath]);
        }
      }

      toast.success("Post cancelled and removed from queue", { id });
      fetchQueueItems();
    } catch (err: any) {
      console.error("Cancel post error:", err);
      toast.error("Cancellation Failed", {
        id,
        description: err.message || "Failed to remove post from queue.",
      });
    }
  }

  const getNextRunText = () => {
    if (items.length === 0) return "no runs scheduled";
    const now = Date.now();
    const futureItems = items
      .map((it) => new Date(it.rawTime).getTime())
      .filter((t) => t > now)
      .sort((a, b) => a - b);

    if (futureItems.length === 0) return "no upcoming runs";
    const nextTime = futureItems[0];
    const diffMs = nextTime - now;
    const diffMin = Math.ceil(diffMs / (60 * 1000));
    if (diffMin < 60) {
      return `next run in ${diffMin}m`;
    }
    const diffHours = Math.floor(diffMin / 60);
    const remainingMin = diffMin % 60;
    return `next run in ${diffHours}h ${remainingMin}m`;
  };

  return (
    <div className="px-8 py-7 bg-[#FFF6ED] min-h-screen text-slate-900">
      <header className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-orange-200/80 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Content queue</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isLoading ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin text-orange-600" /> Fetching latest queue...
              </span>
            ) : (
              `${items.length} posts awaiting publication · ${getNextRunText()}`
            )}
          </p>
        </div>
        <Tabs value={view} onValueChange={(v) => setView(v as "list" | "calendar" | "logs")}>
          <TabsList className="bg-orange-100/60 border border-orange-200">
            <TabsTrigger value="list" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">List</TabsTrigger>
            <TabsTrigger value="calendar" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">Calendar</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">System Logs</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 border rounded-lg bg-card/50">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Synchronizing with publish queue...</p>
        </div>
      ) : view === "list" ? (
        <Card>
          <CardHeader className="border-b pb-4 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarClock size={16} className="text-primary" />
              Upcoming posts
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Bot size={12} /> Automated
              </span>
              <span className="flex items-center gap-1">
                <User size={12} /> Manual
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0 divide-y">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-muted to-muted/40">
                  <PlatformIcon platform={item.platform} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="truncate text-sm font-medium">{item.title}</h4>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {item.type}
                    </Badge>
                    {item.status === "failed" && (
                      <Badge
                        variant="destructive"
                        className="text-[10px] bg-red-600 hover:bg-red-700 text-white border-none"
                      >
                        Failed
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {item.scheduledFor}
                    </span>
                    <span>·</span>
                    <span>{platformLabel(item.platform)}</span>
                    <Badge
                      variant="outline"
                      className={
                        item.source === "Automated"
                          ? "border-primary/40 bg-primary/10 text-primary text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {item.source === "Automated" ? (
                        <Bot size={10} className="mr-1" />
                      ) : (
                        <User size={10} className="mr-1" />
                      )}
                      {item.source}
                    </Badge>
                  </div>
                  {item.status === "failed" && item.errorMessage && (
                    <div className="mt-2 text-xs text-red-500 font-mono bg-red-500/10 p-2 rounded border border-red-500/20 max-w-2xl whitespace-pre-wrap">
                      Error: {item.errorMessage}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => publishNow(item.dbId, item.id)}
                    className="gap-1.5"
                  >
                    <Send size={12} /> Force publish
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const localDate = new Date(item.rawTime);
                      const year = localDate.getFullYear();
                      const month = String(localDate.getMonth() + 1).padStart(2, "0");
                      const date = String(localDate.getDate()).padStart(2, "0");
                      const hours = String(localDate.getHours()).padStart(2, "0");
                      const minutes = String(localDate.getMinutes()).padStart(2, "0");
                      const formattedLocalTime = `${year}-${month}-${date}T${hours}:${minutes}`;
                      setReschedulingItem({
                        id: item.id,
                        dbId: item.dbId,
                        time: formattedLocalTime,
                      });
                    }}
                  >
                    Reschedule
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <X size={14} />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel this scheduled post?</AlertDialogTitle>
                        <AlertDialogDescription>
                          "{item.title}" will be removed from the queue. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep it</AlertDialogCancel>
                        <AlertDialogAction onClick={() => cancel(item.dbId, item.id)}>
                          Cancel post
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="p-10 text-center text-sm text-muted-foreground">Queue is empty.</div>
            )}
          </CardContent>
        </Card>
      ) : view === "calendar" ? (
        <Card>
          <CardContent className="p-5">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {Array.from({ length: 28 }, (_, i) => {
                const dayIdx = i % 7;
                const dayItems = items.filter((it) => {
                  const map: Record<string, number> = {
                    Mon: 0,
                    Tue: 1,
                    Wed: 2,
                    Thu: 3,
                    Fri: 4,
                    Sat: 5,
                    Sun: 6,
                    Mon2: 0,
                  };
                  const key = it.scheduledFor.split(" ")[0].replace(",", "");
                  return map[key] === dayIdx && i < 14;
                });
                return (
                  <div key={i} className="min-h-[88px] rounded-md border bg-card p-2 text-left">
                    <div className="text-xs font-medium text-muted-foreground tabular-nums">
                      {i + 1}
                    </div>
                    <div className="mt-1 space-y-1">
                      {dayItems.slice(0, 2).map((it) => (
                        <div
                          key={it.id}
                          className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary truncate"
                        >
                          <PlatformIcon platform={it.platform} size={10} />
                          <span className="truncate">{it.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-muted bg-background/50">
          <CardHeader className="border-b pb-4 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Terminal size={16} className="text-primary animate-pulse" />
              Platform Execution Logs
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={fetchLogs}
                disabled={isLogsLoading}
                className="gap-1.5 h-8"
              >
                <RefreshCw size={12} className={isLogsLoading ? "animate-spin" : ""} />
                Refresh
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5 h-8 bg-destructive/90 hover:bg-destructive"
                onClick={async () => {
                  if (confirm("Are you sure you want to clear all platform execution logs?")) {
                    try {
                      await clearPlatformLogs();
                      toast.success("Logs cleared successfully");
                      fetchLogs();
                    } catch (err: any) {
                      toast.error("Failed to clear logs: " + err.message);
                    }
                  }
                }}
              >
                <Trash2 size={12} />
                Clear Logs
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="bg-zinc-950 text-zinc-100 p-4 rounded-lg font-mono text-xs overflow-auto h-[550px] shadow-inner border border-zinc-800 leading-relaxed whitespace-pre">
              {logs || "No logs recorded yet."}
            </div>
          </CardContent>
        </Card>
      )}

      {reschedulingItem && (
        <AlertDialog
          open={!!reschedulingItem}
          onOpenChange={(open) => !open && setReschedulingItem(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reschedule Post</AlertDialogTitle>
              <AlertDialogDescription>
                Select a new publishing date and time trigger for this post.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Input
                type="datetime-local"
                value={reschedulingItem.time}
                onChange={(e) => setReschedulingItem({ ...reschedulingItem, time: e.target.value })}
                className="w-full"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setReschedulingItem(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const { dbId, time, id } = reschedulingItem;
                  if (!time) return;

                  toast.loading("Rescheduling post...", { id });
                  try {
                    // Use localDateTimeToUTC to correctly treat the datetime-local
                    // value as local browser time (not UTC) before storing.
                    const utcTime = localDateTimeToUTC(time);
                    if (!utcTime) {
                      toast.error("Invalid time selected.", { id });
                      return;
                    }
                    const { error } = await supabase
                      .from("content_queue")
                      .update({ scheduled_time: utcTime })
                      .eq("id", dbId);

                    if (error) throw error;
                    toast.success("Post rescheduled successfully!", { id });
                    fetchQueueItems();
                  } catch (err: any) {
                    toast.error("Reschedule Failed", {
                      id,
                      description: err.message || "Could not save the new scheduled time.",
                    });
                  } finally {
                    setReschedulingItem(null);
                  }
                }}
              >
                Save Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
