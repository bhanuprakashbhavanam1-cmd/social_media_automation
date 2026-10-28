import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MetricCard } from "@/components/metric-card";
import { Plug, Send, Clock, Loader2, Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/platform-icon";
import { StatusBadge } from "@/components/status-badge";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — OmniMarket AI" },
      {
        name: "description",
        content: "Real-time view of your social automation activity, AI insights, and reach.",
      },
    ],
  }),
  component: DashboardPage,
});

function formatRelativeTime(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);

  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs < 24) return `${hrs}h ago`;
  return `${days}d ago`;
}

const TONE = {
  success: { Icon: TrendingUp, color: "text-emerald-700", bg: "bg-emerald-500/10 border-emerald-500/20" },
  warning: { Icon: AlertTriangle, color: "text-orange-700", bg: "bg-orange-500/10 border-orange-500/20" },
  info: { Icon: Lightbulb, color: "text-amber-700", bg: "bg-amber-500/10 border-amber-500/20" },
} as const;

function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [platformCount, setPlatformCount] = useState(0);
  const [connectedListStr, setConnectedListStr] = useState("No accounts connected");
  const [publishedCount, setPublishedCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [nextPost, setNextPost] = useState<any>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>("00:00:00");
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch connected accounts
      const { data: accounts } = await supabase
        .from("social_accounts")
        .select("platform_name, platform_account_name")
        .eq("user_id", session.user.id);

      const platforms = accounts || [];
      setPlatformCount(platforms.length);
      if (platforms.length > 0) {
        const names = platforms.map((p) => {
          let name = p.platform_name.toUpperCase();
          if (p.platform_account_name) {
            try {
              const parsed = JSON.parse(p.platform_account_name);
              name = parsed.name || name;
            } catch (_) {}
          }
          return name;
        });
        setConnectedListStr(names.join(", "));
      } else {
        setConnectedListStr("No accounts connected");
      }

      // 2. Fetch post counts
      const { data: posts } = await supabase
        .from("content_queue")
        .select("id, status, platform_targets, scheduled_time, ai_generated_content, updated_at")
        .eq("user_id", session.user.id);

      const allPosts = posts || [];
      const pub = allPosts.filter((p) => p.status === "published").length;
      const sched = allPosts.filter(
        (p) => p.status === "pending" || p.status === "scheduled",
      ).length;
      setPublishedCount(pub);
      setScheduledCount(sched);

      // 3. Find next automated run
      const upcoming = allPosts
        .filter(
          (p) =>
            (p.status === "pending" || p.status === "scheduled") &&
            new Date(p.scheduled_time) > new Date(),
        )
        .sort(
          (a, b) => new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime(),
        )[0];
      setNextPost(upcoming || null);

      // 4. Build recent activities
      const recent = [...allPosts]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5)
        .map((p) => {
          const platform = p.platform_targets?.[0] || "instagram";
          const caption =
            p.ai_generated_content?.captions?.[platform] ||
            p.ai_generated_content?.captions?.instagram ||
            p.ai_generated_content?.instagram?.caption ||
            "Campaign Post";
          const cleanTitle = caption.length > 55 ? `${caption.substring(0, 55)}...` : caption;

          let type = "Post";
          if (platform === "instagram") type = "Reel";
          else if (platform === "youtube") type = "Short";
          else if (platform === "x") type = "Tweet";

          return {
            id: p.id,
            platform,
            preview: cleanTitle,
            type,
            trigger:
              p.status === "published"
                ? "Auto-posted"
                : `Schedule: ${new Date(p.scheduled_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
            status: p.status === "pending" ? "Scheduled" : p.status === "published" ? "Published" : p.status,
            time: formatRelativeTime(p.updated_at),
          };
        });
      setRecentActivities(recent);

      // 5. Generate dynamic system health and recommendations
      const systemInsights = [];
      if (platforms.length === 0) {
        systemInsights.push({
          id: "no-platforms",
          tone: "warning" as const,
          title: "Setup connection integrations",
          body: "No social media platforms are linked to your profile. Link a platform to initiate auto-publishing.",
          cta: "Connect Account",
          link: "/integrations",
        });
      } else {
        systemInsights.push({
          id: "platforms-active",
          tone: "success" as const,
          title: "System integrations healthy",
          body: `Engagement channels actively connected: ${platforms.map((p) => p.platform_name).join(", ")}.`,
          cta: "Manage integrations",
          link: "/integrations",
        });
      }

      if (sched > 0) {
        systemInsights.push({
          id: "queue-scheduler",
          tone: "info" as const,
          title: "Automated schedule active",
          body: `You have ${sched} campaigns standing by in the content queue.`,
          cta: "Go to queue",
          link: "/queue",
        });
      } else if (platforms.length > 0) {
        systemInsights.push({
          id: "queue-empty",
          tone: "warning" as const,
          title: "Content queue is empty",
          body: "No posts are scheduled to publish next. Use Campaign Creator to launch your next automation cycle.",
          cta: "Create Campaign",
          link: "/creator",
        });
      }

      setInsights(systemInsights);
    } catch (err) {
      console.error("Error fetching dashboard statistics:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Live countdown timer for the next scheduled post run
  useEffect(() => {
    if (!nextPost?.scheduled_time) {
      setTimeRemaining("--:--:--");
      return;
    }
    const updateTimer = () => {
      const scheduled = new Date(nextPost.scheduled_time);
      const diff = scheduled.getTime() - Date.now();
      if (diff <= 0) {
        setTimeRemaining("00:00:00");
        return;
      }
      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      const format = (num: number) => String(num).padStart(2, "0");
      setTimeRemaining(`${format(hrs)}:${format(mins)}:${format(secs)}`);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [nextPost]);

  const formattedDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });

  const nextPostPlatform = nextPost?.platform_targets?.[0];
  const nextPostTitle = nextPostPlatform
    ? nextPost.ai_generated_content?.captions?.[nextPostPlatform] ||
      nextPost.ai_generated_content?.instagram?.caption ||
      "Upcoming post"
    : "";
  const nextPostClean =
    nextPostTitle.length > 25 ? `${nextPostTitle.substring(0, 25)}...` : nextPostTitle;

  if (isLoading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-[#FFF6ED]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          <p className="text-sm font-semibold text-slate-600">Synchronizing metrics dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-8 py-7 bg-[#FFF6ED] min-h-screen text-slate-900 animate-in fade-in duration-200">
      <header className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-orange-200/80 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            {formattedDate} · Engagement engine is{" "}
            <span className="font-bold text-emerald-600">active</span>
          </p>
        </div>

        <Link to="/creator">
          <Button className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-md shadow-orange-500/20 gap-2 cursor-pointer border border-orange-400/30">
            <Sparkles size={14} />
            <span>Create Campaign Post</span>
          </Button>
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          label="Active Platforms"
          value={`${platformCount} / 4`}
          sub={connectedListStr}
          icon={Plug}
        />
        <MetricCard
          label="Posts Published & Scheduled"
          value={(publishedCount + scheduledCount).toString()}
          sub={`${publishedCount} published · ${scheduledCount} scheduled`}
          icon={Send}
        />
        <MetricCard
          label="Next Automated Run"
          value={timeRemaining}
          sub={
            nextPost
              ? `${nextPostPlatform.toUpperCase()} · ${nextPostClean}`
              : "No upcoming schedule"
          }
          icon={Clock}
          accent
        />
      </section>

      <section className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Recent Automation Activity */}
        <Card className="overflow-hidden border border-orange-200/80 bg-white text-slate-900 shadow-md shadow-orange-950/5">
          <CardHeader className="flex flex-row items-center justify-between border-b border-orange-100 pb-4 bg-orange-50/40">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2 text-slate-900">
                <Send size={16} className="text-orange-600" />
                Recent automation activity
              </CardTitle>
              <p className="text-xs text-slate-500">
                Last updates across all connected platforms
              </p>
            </div>
            <Badge variant="outline" className="font-bold text-xs bg-orange-500/10 text-orange-700 border border-orange-500/20">
              {recentActivities.length} events
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center">
                <Clock className="h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm font-bold text-slate-800">No recent activity</p>
                <p className="text-xs text-slate-500 mt-1">
                  Activities will appear here once you post or schedule.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-orange-100 hover:bg-transparent bg-orange-50/20">
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead className="text-xs font-bold text-slate-600">Content</TableHead>
                    <TableHead className="w-[90px] text-xs font-bold text-slate-600">Type</TableHead>
                    <TableHead className="w-[180px] text-xs font-bold text-slate-600">Trigger</TableHead>
                    <TableHead className="w-[130px] text-xs font-bold text-slate-600">Status</TableHead>
                    <TableHead className="w-[110px] text-right text-xs font-bold text-slate-600">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentActivities.map((row) => (
                    <TableRow key={row.id} className="border-b border-orange-100/70 hover:bg-orange-50/40">
                      <TableCell>
                        <PlatformIcon platform={row.platform} withBg size={14} />
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate font-semibold text-slate-800 text-xs">
                        {row.preview}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] bg-slate-100 text-slate-700">
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 font-medium">{row.trigger}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium text-slate-500 tabular-nums">
                        {row.time}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* AI Insights & System Health */}
        <Card className="border border-orange-200/80 bg-white text-slate-900 shadow-md shadow-orange-950/5">
          <CardHeader className="border-b border-orange-100 pb-4 bg-orange-50/40">
            <CardTitle className="text-base font-bold tracking-tight flex items-center gap-2 text-slate-900">
              <Sparkles size={16} className="text-orange-600" />
              AI insights & system health
            </CardTitle>
            <p className="text-xs text-slate-500">
              Live recommendations from the engagement engine
            </p>
          </CardHeader>
          <CardContent className="space-y-3.5 p-4">
            {insights.map((insight) => {
              const toneKey = (insight.tone as keyof typeof TONE) || "info";
              const { Icon, color, bg } = TONE[toneKey];
              return (
                <div
                  key={insight.id}
                  className="rounded-xl border border-orange-200/60 bg-white p-3.5 shadow-sm transition-all hover:border-orange-300"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                        bg,
                      )}
                    >
                      <Icon size={14} className={color} />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        {insight.title}
                      </div>
                      <p className="text-xs leading-relaxed text-slate-600">
                        {insight.body}
                      </p>
                      <Link to={insight.link}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-2 h-7 gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        >
                          {insight.cta} <ArrowRight size={12} />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
