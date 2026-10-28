import { logInfo, logError } from "./logger";

export function startQueueScheduler() {
  // Check if we are running in a server environment
  if (typeof window !== "undefined") return;

  // Clear any existing interval to support hot reloading without duplicate schedules
  if ((globalThis as any).__queue_scheduler_interval__) {
    logInfo("Clearing existing queue scheduler interval...");
    clearInterval((globalThis as any).__queue_scheduler_interval__);
  }

  logInfo(
    `Starting automatic queue scheduler (30s interval)... (PID: ${process.pid}, Router: ${process.env.VINXI_ROUTER})`,
  );

  if (!(globalThis as any).__queue_scheduler_last_check__) {
    (globalThis as any).__queue_scheduler_last_check__ = new Date().toISOString();
  }

  const tick = async () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      logInfo("Queue scheduler waiting: Supabase credentials not yet available in environment.");
      return;
    }

    const lastCheck = (globalThis as any).__queue_scheduler_last_check__;
    const nowString = new Date().toISOString();
    (globalThis as any).__queue_scheduler_last_check__ = nowString;

    try {
      const publishUrl = `${supabaseUrl}/functions/v1/publish-queue`;
      logInfo(`Executing auto-publish pulse: triggering ${publishUrl}`);

      const response = await fetch(publishUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Edge function returned status ${response.status}: ${body}`);
      }

      const data = await response.json();
      if (data.success || data.message === "No pending posts to publish.") {
        const processed = data.processed ?? 0;
        const failed = data.failed ?? 0;
        if (processed > 0 || failed > 0) {
          logInfo(
            `Auto-publish run summary: success=true, processed=${processed}, failed=${failed}`,
          );
          if (data.failures && data.failures.length > 0) {
            data.failures.forEach((f: any) => {
              logError(`Auto-publish item failure (Post ID: ${f.postId || f.id}): ${f.error}`);
            });
          }
        } else {
          // Log heartbeat periodically but keep logs clean
          logInfo("Auto-publish heartbeat: no pending posts in queue.");
        }
      } else {
        logError("Edge function returned failure response:", data);
      }
    } catch (err: any) {
      logError("Auto-publish scheduling pulse failed:", err);
    }

    // Sync remote publish outcomes (e.g. from cloud triggers) to write details into platform.log
    try {
      const syncUrl = `${supabaseUrl}/rest/v1/content_queue?status=in.(failed,published)&updated_at=gt.${lastCheck}&select=id,status,error_message,platform_targets`;
      const syncRes = await fetch(syncUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      if (syncRes.ok) {
        const syncData = await syncRes.json();
        if (syncData && syncData.length > 0) {
          syncData.forEach((post: any) => {
            if (post.status === "published") {
              logInfo(
                `Auto-publish success for Post ID ${post.id} (Platforms: ${post.platform_targets?.join(", ")})`,
              );
            } else if (post.status === "failed") {
              logError(
                `Auto-publish failure for Post ID ${post.id} (Platforms: ${post.platform_targets?.join(", ") || "unknown"}): ${post.error_message}`,
              );
            }
          });
        }
      }
    } catch (syncErr: any) {
      logError("Failed to sync remote publish outcomes for logging:", syncErr.message);
    }
  };

  // Run initial tick immediately after start
  tick();

  // Schedule periodic tick
  const intervalId = setInterval(tick, 30000);
  (globalThis as any).__queue_scheduler_interval__ = intervalId;
}
