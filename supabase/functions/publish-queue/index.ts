import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ====================================================================
// OMNIMARKET AI - SCHEDULER & PUBLISHER EDGE FUNCTION (PHASE 5 - HARDENED)
// Function: publish-queue
// Runtime: Deno (Supabase Edge Function)
// Description: Queries pending content, handles OAuth token refresh,
//              implements rate limiting, and dispatches to social APIs.
// ====================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface SocialAccount {
  id: string;
  user_id: string;
  platform_name: 'instagram' | 'facebook' | 'x' | 'youtube';
  platform_account_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
}

// Utility delay for rate limiting
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to convert Google Drive share links into direct download links
function convertGoogleDriveLink(url: string): string {
  if (!url) return url;
  
  // Match standard drive / docs file URL format: /file/d/FILE_ID
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || 
                      url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
  }
  
  // Match open?id=FILE_ID or uc?id=FILE_ID format
  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch && idParamMatch[1] && (url.includes("drive.google.com") || url.includes("docs.google.com"))) {
    return `https://drive.google.com/uc?export=download&id=${idParamMatch[1]}`;
  }
  
  return url;
}

// Check if a URL represents a video based on extension, format, or Google Drive headers
async function checkIfVideoUrl(url: string, format: string): Promise<boolean> {
  if (format === "video" || format === "short") {
    return true;
  }
  if (/\.(mp4|mov|avi|webm|mkv|3gp|m4v)/i.test(url)) {
    return true;
  }
  if (url.includes("drive.google.com")) {
    try {
      const resolvedUrl = convertGoogleDriveLink(url);
      const res = await fetch(resolvedUrl, { method: "HEAD" });
      const contentType = res.headers.get("content-type") || "";
      if (contentType.startsWith("video/")) {
        return true;
      }
    } catch (e) {
      console.warn("Failed to check Google Drive content-type via HEAD:", e);
    }
  }
  return false;
}

// Fetch a media file stream, resolving Google Drive virus scan warning pages if needed
async function fetchMediaStream(url: string): Promise<Response> {
  const resolvedUrl = convertGoogleDriveLink(url);
  let res = await fetch(resolvedUrl);
  if (!res.ok) return res;
  
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("text/html") && resolvedUrl.includes("drive.google.com")) {
    const text = await res.text();
    const confirmMatch = text.match(/confirm=([a-zA-Z0-9_-]+)/);
    if (confirmMatch && confirmMatch[1]) {
      const confirmToken = confirmMatch[1];
      const idMatch = resolvedUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch && idMatch[1]) {
        const confirmedUrl = `https://drive.google.com/uc?export=download&confirm=${confirmToken}&id=${idMatch[1]}`;
        console.log(`[Google Drive] Large file confirmation required. Retrying with token URL: ${confirmedUrl}`);
        res = await fetch(confirmedUrl);
      }
    } else {
      return new Response(text, {
        status: res.status,
        headers: res.headers,
      });
    }
  }
  
  return res;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 1. Initialize Supabase Client with Service Role Key (bypasses RLS for system operations)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  console.log("Publish Queue Pulse Triggered:", new Date().toISOString());

  try {
    // 2. Fetch and lock pending posts atomically to prevent concurrent processing (double publishing)
    const now = new Date().toISOString();
    const lockTime = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // Lock for 5 minutes

    const { data: posts, error: fetchError } = await supabase
      .from("content_queue")
      .update({ 
        scheduled_time: lockTime,
        error_message: "Publishing in progress..."
      })
      .eq("status", "pending")
      .lte("scheduled_time", now)
      .select("*");

    if (fetchError) throw fetchError;
    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ success: true, processed: 0, failed: 0, message: "No pending posts to publish." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`Found ${posts.length} pending posts. Initiating publishing loop...`);

    let processedCount = 0;
    let failedCount = 0;
    const failures: any[] = [];

    for (const post of posts) {
      let externalIds: Record<string, string> = {};
      let tempStorageFile: string | null = null;
      try {
        console.log(`Processing Post ID: ${post.id} for User: ${post.user_id}`);

        // 3. Fetch all active social accounts for this user
        const { data: accounts, error: accountError } = await supabase
          .from("social_accounts")
          .select("*")
          .eq("user_id", post.user_id);

        if (accountError) throw accountError;
        if (!accounts || accounts.length === 0) {
          throw new Error("No connected social accounts found for this user.");
        }

        externalIds = { ...post.ai_generated_content?.external_ids };
        const format = post.ai_generated_content?.post_format || "post"; // 'post' or 'story'
        let resolvedMediaUrl = convertGoogleDriveLink(post.media_url);
        console.log(`Original media URL: ${post.media_url}, Resolved: ${resolvedMediaUrl}`);

        // If target platform contains Facebook or Instagram, and the URL is external (e.g. Google Drive),
        // download it and upload it to Supabase Storage temporarily so that Meta's servers can access it without blockages.
        const hasMetaTarget = post.platform_targets.includes("facebook") || post.platform_targets.includes("instagram");
        const isExternalMedia = resolvedMediaUrl && !resolvedMediaUrl.includes("/storage/v1/object/public/");

        if (hasMetaTarget && isExternalMedia) {
          console.log(`[Meta Upload Optimizer] Detected external media URL for Facebook/Instagram: ${resolvedMediaUrl}`);
          try {
            const mediaRes = await fetchMediaStream(resolvedMediaUrl);
            if (!mediaRes.ok) {
              throw new Error(`Failed to retrieve external media stream: ${mediaRes.statusText}`);
            }

            const contentType = mediaRes.headers.get("content-type") || "";
            let ext = "mp4"; // default
            if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) ext = "jpg";
            else if (contentType.includes("image/png")) ext = "png";
            else if (contentType.includes("image/gif")) ext = "gif";
            else if (contentType.includes("image/webp")) ext = "webp";
            else if (contentType.includes("video/quicktime")) ext = "mov";
            else if (contentType.includes("video/webm")) ext = "webm";

            // If we can parse extension from the url path, use it
            try {
              const urlObj = new URL(resolvedMediaUrl);
              const pathParts = urlObj.pathname.split(".");
              if (pathParts.length > 1) {
                const urlExt = pathParts.pop()?.toLowerCase();
                if (urlExt && /^[a-z0-9]{3,4}$/.test(urlExt)) {
                  ext = urlExt;
                }
              }
            } catch (_) {}

            const fileName = `temp_meta_${post.id}_${Date.now()}.${ext}`;
            console.log(`[Meta Upload Optimizer] Uploading external media stream to temp Supabase storage path: ${fileName}`);
            
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from("media")
              .upload(fileName, mediaRes.body!, {
                contentType: contentType || undefined,
                duplex: "half",
                upsert: true
              });

            if (uploadError) throw uploadError;

            // Get public URL of the uploaded file
            const { data: { publicUrl } } = supabase.storage
              .from("media")
              .getPublicUrl(fileName);

            tempStorageFile = fileName;
            resolvedMediaUrl = publicUrl;
            console.log(`[Meta Upload Optimizer] External media uploaded successfully. New public URL: ${resolvedMediaUrl}`);
          } catch (uploadErr: any) {
            console.error(`[Meta Upload Optimizer] Failed to mirror external media to storage:`, uploadErr);
          }
        }

        // Loop through each target platform specified in the post targets
        for (const target of post.platform_targets) {
          const account = accounts.find((a: SocialAccount) => a.platform_name === target);
          if (!account) {
            console.error(`Post target ${target} has no matching account connected.`);
            continue;
          }

          // Skip if already published to this target (idempotency safety)
          if (externalIds && externalIds[target]) {
            console.log(`Post ID ${post.id} already published to ${target} (ID: ${externalIds[target]}). Skipping.`);
            continue;
          }

          // 4. Token Refresh Reality check (Harden logic)
          let accessToken = account.access_token;
          const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
          
          // Refresh token if it expired, or is about to expire within 5 minutes
          const isExpired = expiresAt && (expiresAt.getTime() - Date.now() < 5 * 60 * 1000);
          const isReminderMode = accessToken.startsWith("reminder_");
          
          if (isExpired && !isReminderMode) {
            if (account.refresh_token) {
              console.log(`Token for ${target} is expired or expiring soon. Initiating refresh...`);
              try {
                if (account.refresh_token.startsWith("sb_")) {
                  console.log(`[SANDBOX MODE] Simulating token refresh for ${target}...`);
                  accessToken = `sb_access_token_${Math.random().toString(36).substring(2, 14)}`;
                  const { error: updateError } = await supabase
                    .from("social_accounts")
                    .update({
                      access_token: accessToken,
                      token_expires_at: new Date(Date.now() + 3600 * 24 * 30 * 1000).toISOString()
                    })
                    .eq("id", account.id);
                  if (updateError) throw updateError;
                } else {
                  const refreshedTokens = await refreshOAuthToken(target, account.refresh_token);
                  accessToken = refreshedTokens.access_token;
                  
                  // Update database atomically with new tokens
                  const updateData: Partial<SocialAccount> = {
                    access_token: refreshedTokens.access_token,
                    updated_at: new Date().toISOString() as any
                  };
                  
                  if (refreshedTokens.refresh_token) {
                    updateData.refresh_token = refreshedTokens.refresh_token;
                  }
                  if (refreshedTokens.expires_in) {
                    updateData.token_expires_at = new Date(Date.now() + refreshedTokens.expires_in * 1000).toISOString();
                  }

                  const { error: updateError } = await supabase
                    .from("social_accounts")
                    .update(updateData)
                    .eq("id", account.id);

                  if (updateError) throw updateError;
                  console.log(`Successfully refreshed and stored tokens for ${target}`);
                }
              } catch (refreshErr: any) {
                throw new Error(`Failed to refresh OAuth token for ${target}: ${refreshErr.message}`);
              }
            } else {
              // No refresh token available, and token is expired.
              throw new Error(`The connection session for ${target} has expired. Please reconnect your account in Integrations.`);
            }
          }

          // 5. Extract and parse caption and hashtags dynamically
          let caption = "";
          if (post.ai_generated_content?.captions?.[target]) {
            caption = post.ai_generated_content.captions[target];
          } else if (post.ai_generated_content?.[target]?.caption) {
            caption = post.ai_generated_content[target].caption;
          } else if (post.ai_generated_content?.captions?.instagram) {
            caption = post.ai_generated_content.captions.instagram;
          } else if (post.ai_generated_content?.instagram?.caption) {
            caption = post.ai_generated_content.instagram.caption;
          }

          let hashtags: string[] = [];
          if (Array.isArray(post.ai_generated_content?.hashtags)) {
            hashtags = post.ai_generated_content.hashtags;
          } else if (Array.isArray(post.ai_generated_content?.[target]?.hashtags)) {
            hashtags = post.ai_generated_content[target].hashtags;
          } else if (Array.isArray(post.ai_generated_content?.instagram?.hashtags)) {
            hashtags = post.ai_generated_content.instagram.hashtags;
          }

          if (hashtags.length > 0 && caption) {
            const tagString = hashtags.join(" ");
            if (!caption.includes(hashtags[0])) {
              caption = `${caption}\n\n${tagString}`;
            }
          }

          // 6. Outbound Platform Dispatches (URL-based uploads to handle large media limits)
          console.log(`Publishing post to ${target} (Format: ${format})...`);
          let externalId = "";
          if (accessToken.startsWith("sb_")) {
            console.log(`[SANDBOX MODE] Simulating successful publish to ${target} for account: ${account.platform_account_name}`);
            externalId = `sb_post_${Math.random().toString(36).substring(2, 10)}`;
            await delay(1000); // Simulate network latency
          } else if (accessToken.startsWith("reminder_")) {
            console.log(`[REMINDER MODE] Simulating successful manual push notification dispatch for ${target} to account: ${account.platform_account_name}`);
            externalId = `reminder_post_${Math.random().toString(36).substring(2, 10)}`;
            await delay(1000); // Simulate notification dispatch latency
          } else {
            if (target === "instagram") {
              externalId = await publishToInstagram(resolvedMediaUrl, caption, accessToken, format, account.platform_account_id);
            } else if (target === "youtube") {
              let ytData = post.ai_generated_content?.youtube || {};
              // Fallback: Parse Title and Description from flat caption if youtube metadata is missing
              if (!ytData.title && post.ai_generated_content?.captions?.youtube) {
                const ytCaption = post.ai_generated_content.captions.youtube;
                const titleMatch = ytCaption.match(/Title:\s*(.*?)(?:\n|$)/i);
                const descMatch = ytCaption.match(/Description:\s*([\s\S]*)/i);
                ytData = {
                  title: titleMatch ? titleMatch[1].trim() : "OmniMarket AI Video",
                  description: descMatch ? descMatch[1].trim() : ytCaption,
                  tags: hashtags
                };
              }
              externalId = await publishToYouTube(resolvedMediaUrl, ytData, accessToken, format);
            } else if (target === "x") {
              externalId = await publishToX(caption, accessToken);
            } else if (target === "facebook") {
              externalId = await publishToFacebook(resolvedMediaUrl, caption, accessToken, format, account.platform_account_id);
            }
          }

          if (externalId) {
            externalIds[target] = externalId;
          }

          // 7. Rate Limiting & Queue Backpressure drip-feed delay (1.5 seconds)
          // Prevents simultaneous burst API flags from provider channels
          await delay(1500);
        }

        // Update post status to published with external IDs in JSONB
        const updatedAiContent = {
          ...post.ai_generated_content,
          external_ids: externalIds
        };

        await supabase
          .from("content_queue")
          .update({
            status: "published",
            error_message: null,
            ai_generated_content: updatedAiContent
          })
          .eq("id", post.id);

        // Delete media from storage since it has been successfully posted
        await deleteMediaFromStorage(supabase, post.media_url);

        processedCount++;

      } catch (postError: any) {
        console.error(`Error publishing Post ID ${post.id}:`, postError.message);
        failedCount++;
        failures.push({ postId: post.id, error: postError.message });
        
        // Log failures back to the queue database entry, preserving successful dispatches
        const updatedAiContent = {
          ...post.ai_generated_content,
          external_ids: externalIds
        };

        await supabase
          .from("content_queue")
          .update({ 
            status: "failed", 
            error_message: postError.message,
            ai_generated_content: updatedAiContent,
            scheduled_time: now // restore to the execution timestamp
          })
          .eq("id", post.id);
      } finally {
        if (tempStorageFile) {
          console.log(`[CLEANUP] Removing temporary upload optimizer file: ${tempStorageFile}`);
          try {
            await supabase.storage.from("media").remove([tempStorageFile]);
          } catch (cleanupErr: any) {
            console.error(`[CLEANUP] Failed to remove temporary file:`, cleanupErr.message);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: processedCount, failed: failedCount, failures }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (globalError: any) {
    console.error("Critical error in publisher edge function:", globalError);
    return new Response(
      JSON.stringify({ success: false, error: globalError.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ====================================================================
// PLATFORM OAUTH REFRESH HANDLERS
// ====================================================================
async function refreshOAuthToken(platform: string, refreshToken: string) {
  let tokenEndpoint = "";
  const bodyParams = new URLSearchParams();

  if (platform === "youtube") {
    tokenEndpoint = "https://oauth2.googleapis.com/token";
    bodyParams.append("client_id", Deno.env.get("GOOGLE_CLIENT_ID") || "");
    bodyParams.append("client_secret", Deno.env.get("GOOGLE_CLIENT_SECRET") || "");
    bodyParams.append("refresh_token", refreshToken);
    bodyParams.append("grant_type", "refresh_token");
  } else if (platform === "x") {
    tokenEndpoint = "https://api.twitter.com/2/oauth2/token";
    bodyParams.append("client_id", Deno.env.get("X_CLIENT_ID") || "");
    bodyParams.append("client_secret", Deno.env.get("X_CLIENT_SECRET") || "");
    bodyParams.append("refresh_token", refreshToken);
    bodyParams.append("grant_type", "refresh_token");
  } else {
    // For Instagram / Facebook, Meta uses longer-lived tokens (60 days) 
    // which require a periodic fetch rather than traditional grant flow.
    throw new Error(`Automatic refresh not supported natively via Deno endpoint for ${platform}. Re-auth required.`);
  }

  const res = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyParams
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Token refresh server responded with ${res.status}: ${errorText}`);
  }

  return await res.json();
}

// ====================================================================
// OUTBOUND SOCIAL MEDIA API INTEGRATIONS
// ====================================================================

async function publishToX(text: string, token: string): Promise<string> {
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`X API failed with status ${res.status}: ${JSON.stringify(data)}`);
  }
  return data?.data?.id || "";
}

async function publishToInstagram(mediaUrl: string, caption: string, token: string, format: string, igAccountId: string): Promise<string> {
  let targetIgAccountId = igAccountId;
  
  // Try to resolve the actual Instagram Business Account ID from the user token if possible
  try {
    console.log(`[Instagram] Resolving Instagram Business Account via Facebook Page connections...`);
    const pagesRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
    if (pagesRes.ok) {
      const pagesData = await pagesRes.json();
      if (pagesData.data && pagesData.data.length > 0) {
        let foundIgId = "";
        let foundPageName = "";
        
        // Loop through pages and check for linked Instagram accounts
        for (const page of pagesData.data) {
          const igRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account,name&access_token=${page.access_token || token}`);
          if (igRes.ok) {
            const igData = await igRes.json();
            if (igData.instagram_business_account?.id) {
              foundIgId = igData.instagram_business_account.id;
              foundPageName = page.name;
              break;
            }
          }
        }
        
        if (foundIgId) {
          console.log(`[Instagram] Found linked Instagram Business Account ID: ${foundIgId} via Facebook Page: ${foundPageName}`);
          targetIgAccountId = foundIgId;
          
          // Update the social_accounts record in DB so it stores the correct Instagram Account ID
          try {
            const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
            const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
            const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
            
            const { error: dbError } = await supabaseClient
              .from("social_accounts")
              .update({
                platform_account_id: targetIgAccountId,
                platform_account_name: `${foundPageName} (Instagram)`,
                token_expires_at: null
              })
              .eq("platform_name", "instagram")
              .eq("access_token", token);
              
            if (dbError) {
              console.error(`[Instagram] Failed to save resolved Instagram ID to DB:`, dbError.message);
            } else {
              console.log(`[Instagram] Saved resolved Instagram ID to DB successfully.`);
            }
          } catch (dbErr) {
            console.error(`[Instagram] DB error during Instagram ID update:`, dbErr);
          }
        } else {
          throw new Error("No linked Instagram Business Account found in any managed Facebook Pages. To publish to Instagram, please convert your Instagram account to a Professional (Business or Creator) account, link it to your Facebook Page, and reconnect in Integrations.");
        }
      } else {
        throw new Error("No Facebook Pages found for this account. To publish to Instagram, your Instagram Professional account must be linked to a managed Facebook Page. Please create a Facebook Page, link your Instagram account to it, and reconnect in Integrations.");
      }
    }
  } catch (err) {
    console.warn(`[Instagram] Error resolving Instagram Business Account ID:`, err);
    throw err;
  }

  // Meta Graph API utilizes URL references directly to fetch media
  const isVideo = await checkIfVideoUrl(mediaUrl, format);
  let containerEndpoint = "";

  if (format === "story") {
    if (isVideo) {
      containerEndpoint = `https://graph.facebook.com/v19.0/${targetIgAccountId}/media?media_type=STORIES&video_url=${encodeURIComponent(mediaUrl)}&access_token=${token}`;
    } else {
      containerEndpoint = `https://graph.facebook.com/v19.0/${targetIgAccountId}/media?media_type=STORIES&image_url=${encodeURIComponent(mediaUrl)}&access_token=${token}`;
    }
  } else {
    // Standard post / Reel
    if (isVideo) {
      containerEndpoint = `https://graph.facebook.com/v19.0/${targetIgAccountId}/media?media_type=REELS&video_url=${encodeURIComponent(mediaUrl)}&caption=${encodeURIComponent(caption)}&access_token=${token}`;
    } else {
      containerEndpoint = `https://graph.facebook.com/v19.0/${targetIgAccountId}/media?image_url=${encodeURIComponent(mediaUrl)}&caption=${encodeURIComponent(caption)}&access_token=${token}`;
    }
  }

  const containerRes = await fetch(containerEndpoint, { method: "POST" });
  const containerData = await containerRes.json();
  if (!containerRes.ok) {
    throw new Error(`Instagram media container creation failed: ${JSON.stringify(containerData)}`);
  }

  const creationId = containerData.id;

  // Poll status ONLY for video containers
  if (isVideo) {
    let isProcessed = false;
    let attempts = 0;
    while (!isProcessed && attempts < 10) {
      await delay(3000);
      const statusRes = await fetch(`https://graph.facebook.com/v19.0/${creationId}?fields=status_code&access_token=${token}`);
      const statusData = await statusRes.json();
      if (statusData.status_code === "FINISHED") {
        isProcessed = true;
      } else if (statusData.status_code === "ERROR") {
        throw new Error(`Meta media processing error: ${statusData.error_message || "unknown state"}`);
      }
      attempts++;
    }

    if (!isProcessed) {
      throw new Error("Instagram Reel/Video processing timed out on Meta servers.");
    }
  }

  // Publish container live
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${targetIgAccountId}/media_publish?creation_id=${creationId}&access_token=${token}`, { method: "POST" });
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`Instagram publish execution failed: ${JSON.stringify(publishData)}`);
  }
  return publishData?.id || creationId;
}

async function publishToFacebook(mediaUrl: string, caption: string, token: string, format: string, pageId: string): Promise<string> {
  const isVideo = await checkIfVideoUrl(mediaUrl, format);
  let endpoint = "";
  let targetPageId = pageId;

  // Get Page Access Token from User Access Token dynamically if possible
  let pageToken = token;
  try {
    console.log(`[Facebook] Fetching Page Access Token via /me/accounts for Page ID: ${pageId}...`);
    const accountsRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${token}`);
    if (accountsRes.ok) {
      const accountsData = await accountsRes.json();
      if (!accountsData.data || accountsData.data.length === 0) {
        throw new Error("No Facebook Pages found for this account. Meta API only supports publishing to Facebook Pages, not personal profiles. Please create a Facebook Page, link it to your account, and reconnect in Integrations.");
      }
      
      let pageInfo = accountsData.data?.find((acc: any) => acc.id === pageId);
      
      if (!pageInfo && accountsData.data && accountsData.data.length > 0) {
        // Fallback: pick the first available page since user_id was likely stored as platform_account_id
        pageInfo = accountsData.data[0];
        console.log(`[Facebook] Provided ID ${pageId} not found in pages. Automatically selected first managed page: ${pageInfo.name} (${pageInfo.id})`);
      }

      if (pageInfo?.access_token) {
        pageToken = pageInfo.access_token;
        targetPageId = pageInfo.id;
        console.log(`[Facebook] Successfully obtained Page Access Token for Page: ${pageInfo.name} (${targetPageId})`);

        // Save the permanent Page Access Token back to the database so we don't need to fetch it next time,
        // and so it never expires!
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
          const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
          
          const { error: dbError } = await supabaseClient
            .from("social_accounts")
            .update({
              access_token: pageToken,
              platform_account_id: targetPageId,
              platform_account_name: pageInfo.name,
              token_expires_at: null // Page access tokens are permanent
            })
            .eq("platform_name", "facebook")
            .eq("access_token", token);
          
          if (dbError) {
            console.error(`[Facebook] Failed to save permanent Page Token:`, dbError.message);
          } else {
            console.log(`[Facebook] Permanent Page Token successfully saved to DB.`);
          }
        } catch (dbErr) {
          console.error(`[Facebook] Database error during Page Token update:`, dbErr);
        }
      } else {
        console.warn(`[Facebook] Page ID ${pageId} not found in user's managed accounts, and no other accounts found. Falling back to provided token.`);
      }
    } else {
      const accountsErr = await accountsRes.text();
      console.warn(`[Facebook] Failed to get managed accounts, falling back to provided token: ${accountsErr}`);
    }
  } catch (err) {
    console.warn(`[Facebook] Error resolving page token, using base token:`, err);
    throw err;
  }

  if (format === "story") {
    if (isVideo) {
      endpoint = `https://graph.facebook.com/v19.0/${targetPageId}/adv_videos?file_url=${encodeURIComponent(mediaUrl)}&description=${encodeURIComponent(caption)}&target_story=true&access_token=${pageToken}`;
    } else {
      endpoint = `https://graph.facebook.com/v19.0/${targetPageId}/photos?url=${encodeURIComponent(mediaUrl)}&caption=${encodeURIComponent(caption)}&target_story=true&access_token=${pageToken}`;
    }
  } else {
    // Standard post
    if (isVideo) {
      endpoint = `https://graph.facebook.com/v19.0/${targetPageId}/videos?file_url=${encodeURIComponent(mediaUrl)}&description=${encodeURIComponent(caption)}&access_token=${pageToken}`;
    } else {
      endpoint = `https://graph.facebook.com/v19.0/${targetPageId}/photos?url=${encodeURIComponent(mediaUrl)}&message=${encodeURIComponent(caption)}&access_token=${pageToken}`;
    }
  }

  console.log(`[Facebook] Executing request to: ${endpoint.substring(0, 120)}...`);
  const res = await fetch(endpoint, { method: "POST" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Facebook publish failed: ${JSON.stringify(data)}`);
  }

  return data.id || data.post_id || "";
}

async function publishToYouTube(mediaUrl: string, data: any, token: string, format: string): Promise<string> {
  const isVideo = await checkIfVideoUrl(mediaUrl, format);
  if (!isVideo) {
    throw new Error("YouTube only supports video uploads. Please select a video file or remove YouTube from this campaign's target platforms.");
  }

  const mediaRes = await fetchMediaStream(mediaUrl);
  if (!mediaRes.ok) throw new Error(`Could not retrieve media file stream from: ${mediaUrl}`);
  
  let videoSize = 0;
  let videoBuffer: ArrayBuffer | null = null;
  const contentLengthStr = mediaRes.headers.get("content-length");
  if (contentLengthStr) {
    videoSize = parseInt(contentLengthStr, 10);
    console.log(`[YouTube] Determined content length from headers: ${videoSize} bytes`);
  } else {
    console.warn("[YouTube] Content-Length header missing. Reading file into memory as fallback.");
    videoBuffer = await mediaRes.arrayBuffer();
    videoSize = videoBuffer.byteLength;
  }

  let title = data.title || "OmniMarket AI Video";
  let description = data.description || "";

  // Ensure #Shorts is present in metadata to register as a YouTube Short only if short format is selected
  if (format === "short") {
    if (!title.toLowerCase().includes("#shorts") && !description.toLowerCase().includes("#shorts")) {
      description = description ? `${description}\n\n#Shorts` : "#Shorts";
      if (title.length < 85) {
        title = `${title} #Shorts`;
      }
    }
  }

  const metadata = {
    snippet: {
      title: title,
      description: description,
      tags: data.tags || [],
      categoryId: "22"
    },
    status: {
      privacyStatus: "public"
    }
  };

  const uploadUrl = "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/*",
      "X-Upload-Content-Length": videoSize.toString(),
    },
    body: JSON.stringify(metadata)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`YouTube resumable connection initialization failed with code ${res.status}: ${errText}`);
  }

  const sessionUrl = res.headers.get("Location");
  if (!sessionUrl) {
    throw new Error("YouTube API failed to provide a valid resumable upload destination Location header.");
  }

  const uploadRes = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/*",
      "Content-Length": videoSize.toString(),
    },
    body: videoBuffer || mediaRes.body,
    // @ts-ignore: duplex is required for streaming body in fetch on Deno/Node
    duplex: "half"
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`YouTube stream pipeline upload failed: ${JSON.stringify(uploadData)}`);
  }
  return uploadData?.id || "";
}

async function deleteMediaFromStorage(supabase: any, mediaUrl: string) {
  try {
    const storageMarker = "/storage/v1/object/public/media/";
    const index = mediaUrl.indexOf(storageMarker);
    if (index !== -1) {
      const filePath = decodeURIComponent(mediaUrl.substring(index + storageMarker.length));
      console.log(`[CLEANUP] Deleting post-published media: bucket=media, path=${filePath}`);
      const { error } = await supabase.storage.from("media").remove([filePath]);
      if (error) {
        console.error("Failed to delete media from storage:", error);
      } else {
        console.log("Successfully deleted media from storage after posting");
      }
    } else {
      console.log("Media URL is not a Supabase Storage object; skipping storage cleanup.");
    }
  } catch (err: any) {
    console.error("Error in deleteMediaFromStorage:", err.message);
  }
}
