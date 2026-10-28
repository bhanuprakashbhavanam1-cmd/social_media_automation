import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon, platformLabel } from "@/components/platform-icon";
import { PLATFORMS, type PlatformId } from "@/lib/mock-data";
import {
  UploadCloud,
  FileVideo,
  X,
  Sparkles,
  Loader2,
  Clock,
  Check,
  Hash,
  Link as LinkIcon,
  Calendar,
  AlertCircle,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { generateCampaign } from "@/lib/api/campaign.functions";

export const Route = createFileRoute("/_app/creator")({
  head: () => ({ meta: [{ title: "Campaign Creator — OmniMarket AI" }] }),
  component: CreatorPage,
});

interface AICampaignResult {
  captions: Record<string, string>; // e.g., { instagram: "...", x: "..." }
  hashtags: string[];
  suggested_publish_time: string; // ISO string format
  analysis_reasoning: string;
}

const DEFAULT_SELECTION: PlatformId[] = ["instagram", "youtube", "x"];

function formatToDateTimeLocal(isoString: string): string {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "";
    const pad = (num: number) => String(num).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

/**
 * Converts a datetime-local input value (e.g. "2026-06-13T13:10")
 * into a proper UTC ISO string, correctly treating the value as LOCAL time.
 * Without this, new Date("2026-06-13T13:10") is parsed as UTC by the JS spec,
 * which would schedule the post 5h30m later than intended for IST users.
 */
function localDateTimeToUTC(dtLocalStr: string): string {
  if (!dtLocalStr) return "";
  // Append :00 for seconds so the browser parses it as a full local datetime
  // Date constructor parses "YYYY-MM-DDTHH:MM:SS" (no Z) as LOCAL time
  const d = new Date(`${dtLocalStr}:00`);
  if (isNaN(d.getTime())) return "";
  return d.toISOString();
}

function getReadableDateTime(dtStr: string): string {
  if (!dtStr) return "";
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

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

function CreatorPage() {
  const [marketingGoal, setMarketingGoal] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<PlatformId[]>([]);
  const [connectedPlatforms, setConnectedPlatforms] = useState<PlatformId[]>([]);
  const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(true);

  useEffect(() => {
    async function loadConnectedPlatforms() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setConnectedPlatforms([]);
          setIsLoadingPlatforms(false);
          return;
        }

        const { data, error } = await supabase
          .from("social_accounts")
          .select("platform_name")
          .eq("user_id", session.user.id);

        if (error) throw error;

        if (data) {
          const platforms = data.map((acc: any) => acc.platform_name as PlatformId);
          const uniquePlatforms = Array.from(new Set(platforms));
          setConnectedPlatforms(uniquePlatforms);
        }
      } catch (err) {
        console.error("Error fetching connected platforms:", err);
      } finally {
        setIsLoadingPlatforms(false);
      }
    }

    loadConnectedPlatforms();
  }, []);

  const [suggestedPublishTime, setSuggestedPublishTime] = useState("");
  const [generatedData, setGeneratedData] = useState<AICampaignResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newHashtag, setNewHashtag] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadedFileDetails, setUploadedFileDetails] = useState<{
    name: string;
    size: string;
    type: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [postFormat, setPostFormat] = useState<"post" | "video" | "short" | "story">("post");
  const [mediaType, setMediaType] = useState<"image" | "video" | "unknown">("unknown");
  const [mediaDuration, setMediaDuration] = useState<number | null>(null);
  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaUrl) {
      setMediaType("unknown");
      setMediaDuration(null);
      return;
    }

    const isVideo = mediaUrl.match(/\.(mp4|mov|webm|avi|mkv|3gp|m4v)/i) ||
      mediaUrl.includes("drive.google.com") ||
      (uploadedFileDetails && uploadedFileDetails.type.startsWith("video"));
    const isImage = mediaUrl.match(/\.(jpeg|jpg|png|gif|webp|svg)/i) ||
      (uploadedFileDetails && uploadedFileDetails.type.startsWith("image"));

    if (isImage) {
      setMediaType("image");
      setMediaDuration(null);
    } else if (isVideo) {
      setMediaType("video");
      const video = document.createElement("video");
      video.preload = "metadata";
      video.crossOrigin = "anonymous";
      video.src = mediaUrl;

      const handleLoadedMetadata = () => {
        setMediaDuration(video.duration);
        cleanup();
      };

      const handleError = () => {
        setMediaDuration(null);
        cleanup();
      };

      const cleanup = () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("error", handleError);
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("error", handleError);
    } else {
      setMediaType("unknown");
      setMediaDuration(null);
    }
  }, [mediaUrl, uploadedFileDetails]);

  useEffect(() => {
    if (!mediaUrl) {
      setValidationWarning(null);
      return;
    }

    if (postFormat === "short") {
      if (mediaType === "image") {
        setValidationWarning("You selected 'Short', but the provided media is an image. YouTube Shorts and Instagram Reels must be video files.");
      } else if (mediaType === "video") {
        if (mediaDuration !== null && mediaDuration > 60) {
          setValidationWarning(`You selected 'Short', but the video duration is ${Math.round(mediaDuration)}s. YouTube Shorts must be 60 seconds or less.`);
        } else {
          setValidationWarning(null);
        }
      } else {
        setValidationWarning(null);
      }
    } else if (postFormat === "video") {
      if (mediaType === "image") {
        setValidationWarning("You selected 'Video', but the provided media is an image. Long-form video posts must be video files.");
      } else if (mediaType === "video") {
        if (mediaDuration !== null && mediaDuration <= 60) {
          setValidationWarning(`You selected 'Video' (long-form), but the video duration is only ${Math.round(mediaDuration)}s. It is recommended to use the 'Short' format.`);
        } else {
          setValidationWarning(null);
        }
      } else {
        setValidationWarning(null);
      }
    } else if (postFormat === "post") {
      if (selectedPlatforms.includes("youtube") && mediaType === "image") {
        setValidationWarning("Warning: YouTube does not support image posts. YouTube target will fail unless you change the format to 'Short' or 'Video' and upload a video file, or deselect YouTube.");
      } else {
        setValidationWarning(null);
      }
    } else if (postFormat === "story") {
      if (mediaType === "video" && mediaDuration !== null && mediaDuration > 60) {
        setValidationWarning(`You selected 'Story', but the video duration is ${Math.round(mediaDuration)}s. Stories are typically capped at 15-60 seconds depending on the platform.`);
      } else {
        setValidationWarning(null);
      }
    } else {
      setValidationWarning(null);
    }
  }, [postFormat, mediaType, mediaDuration, mediaUrl, selectedPlatforms]);

  function formatBytes(bytes: number, decimals = 2) {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }

  const uploadFile = async (file: File) => {
    setIsUploadingMedia(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id || "anonymous";
      const fileExt = file.name.split(".").pop();
      const uniqueId = Math.random().toString(36).substring(2, 15);
      const filePath = `user-uploads/${userId}/${uniqueId}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage.from("media").upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

      if (error) {
        if (
          error.message?.includes("Bucket not found") ||
          error.message?.includes("does not exist")
        ) {
          console.log("Bucket 'media' not found. Attempting dynamic creation...");
          const { error: createBucketError } = await supabase.storage.createBucket("media", {
            public: true,
          });
          if (createBucketError) {
            throw new Error(
              `Failed to upload media, and could not create the storage bucket: ${createBucketError.message}`,
            );
          }
          const { data: retryData, error: retryError } = await supabase.storage
            .from("media")
            .upload(filePath, file, {
              cacheControl: "3600",
              upsert: true,
            });
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("media").getPublicUrl(filePath);

      setMediaUrl(publicUrl);
      setUploadedFileDetails({
        name: file.name,
        size: formatBytes(file.size),
        type: file.type,
      });

      toast.success("Media uploaded successfully!", {
        description: "Stored in Supabase 'media' bucket.",
      });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Upload Failed", {
        description: err.message || "Failed to upload selected file to Supabase storage.",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
  };

  function togglePlatform(p: PlatformId) {
    setSelectedPlatforms((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));
  }

  const handleCaptionChange = (platform: string, value: string) => {
    if (!generatedData) return;
    setGeneratedData({
      ...generatedData,
      captions: {
        ...generatedData.captions,
        [platform]: value,
      },
    });
  };

  const removeHashtag = (tagToRemove: string) => {
    if (!generatedData) return;
    setGeneratedData({
      ...generatedData,
      hashtags: generatedData.hashtags.filter((tag) => tag !== tagToRemove),
    });
  };

  const addHashtag = () => {
    if (!generatedData || !newHashtag.trim()) return;
    const formatted = newHashtag.trim().startsWith("#")
      ? newHashtag.trim()
      : `#${newHashtag.trim()}`;
    if (!generatedData.hashtags.includes(formatted)) {
      setGeneratedData({
        ...generatedData,
        hashtags: [...generatedData.hashtags, formatted],
      });
    }
    setNewHashtag("");
  };

  async function handleGenerate() {
    if (!mediaUrl.trim()) {
      toast.error("Please provide a media asset URL");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    if (!marketingGoal.trim()) {
      toast.error("Please enter your marketing goal");
      return;
    }

    setIsGenerating(true);

    try {
      let data = null;
      let invokeError = null;

      try {
        console.log("Attempting direct Supabase Edge Function campaign generation...");
        const response = await supabase.functions.invoke("generate-campaign", {
          body: { marketingGoal, platforms: selectedPlatforms, mediaUrl },
        });
        if (response.data && response.data.success) {
          data = response.data.data;
        } else {
          invokeError = response.error || new Error(response.data?.error || "Edge Function returned success=false");
        }
      } catch (err: any) {
        console.warn(
          "Direct edge function invoke failed. Falling back to local server generator...",
          err,
        );
      }

      if (invokeError || !data) {
        console.log("Invoking campaign generator server-side function fallback...");
        const serverResult = await generateCampaign({
          data: {
            mediaUrl,
            platforms: selectedPlatforms,
            marketingGoal,
          },
        });

        if (serverResult.success && serverResult.data) {
          data = serverResult.data;
        } else {
          throw new Error(
            serverResult.error || "AI Generation failed on both edge and server channels.",
          );
        }
      }

      if (data) {
        const result: AICampaignResult = {
          captions: {},
          hashtags: [],
          suggested_publish_time: data.suggested_publish_time || new Date().toISOString(),
          analysis_reasoning:
            data.analysis_reasoning || "DeepSeek-AI optimized this campaign for peak engagement.",
        };

        // Map platform copies
        if (data.instagram && data.instagram.caption) {
          result.captions.instagram = data.instagram.caption;
        }
        if (data.youtube) {
          const yt = data.youtube;
          result.captions.youtube = `Title: ${yt.title || ""}\n\nDescription:\n${yt.description || ""}`;
        }
        if (data.x && data.x.caption) {
          result.captions.x = data.x.caption;
        }
        if (data.facebook && data.facebook.caption) {
          result.captions.facebook = data.facebook.caption;
        }

        // Support direct captions key if returned
        if (data.captions) {
          result.captions = { ...result.captions, ...data.captions };
        }

        // Extract hashtags from instagram array or root array
        if (data.hashtags && Array.isArray(data.hashtags)) {
          result.hashtags = [...data.hashtags];
        } else if (data.instagram && Array.isArray(data.instagram.hashtags)) {
          result.hashtags = [...data.instagram.hashtags];
        }

        // Merge YouTube tags if present
        if (data.youtube && Array.isArray(data.youtube.tags)) {
          data.youtube.tags.forEach((tag: string) => {
            const formattedTag = tag.startsWith("#") ? tag : `#${tag}`;
            if (!result.hashtags.includes(formattedTag)) {
              result.hashtags.push(formattedTag);
            }
          });
        }

        // Fallback: If no hashtags extracted, parse them from all captions
        if (result.hashtags.length === 0) {
          const extractedTags = new Set<string>();
          Object.values(result.captions).forEach((captionText) => {
            const matches = captionText.match(/#[a-zA-Z0-9_\u00C0-\u00FF]+/g);
            if (matches) {
              matches.forEach((tag) => extractedTags.add(tag));
            }
          });
          result.hashtags = Array.from(extractedTags);
        }

        setGeneratedData(result);
        setSuggestedPublishTime(formatToDateTimeLocal(result.suggested_publish_time));
        toast.success("Campaign Generated!", {
          description: `Created optimized variants for ${selectedPlatforms.length} platforms.`,
        });
      } else {
        throw new Error("AI Engine did not return any campaign data.");
      }
    } catch (err: any) {
      console.error("AI Generation Error:", err);
      toast.error("AI Generation Failed", {
        description: err.message || "Could not reach the campaign generator edge function.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveToQueue() {
    if (!generatedData) {
      toast.error("No generated campaign to save.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    if (!suggestedPublishTime) {
      toast.error("Specify an execution timestamp");
      return;
    }

    setIsSaving(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        toast.error("Authentication Required", {
          description: "You must be signed in to add campaigns to the publishing queue.",
        });
        setIsSaving(false);
        return;
      }

      // Convert the datetime-local value (which has no timezone info) to UTC correctly.
      // new Date(dtLocalStr) without a timezone suffix is treated as UTC by the JS spec,
      // which would make the post publish 5h30m too late for IST users.
      // localDateTimeToUTC() appends :00 so the browser parses it as local time first.
      const scheduledTime = localDateTimeToUTC(suggestedPublishTime);
      if (!scheduledTime) {
        toast.error("Invalid scheduled time", { description: "Please select a valid date and time." });
        setIsSaving(false);
        return;
      }

      // Write row securely into supabase public.content_queue database table
      const { error } = await supabase.from("content_queue").insert({
        user_id: session.user.id,
        media_url: mediaUrl,
        platform_targets: selectedPlatforms,
        ai_generated_content: {
          captions: generatedData.captions,
          hashtags: generatedData.hashtags,
          post_format: postFormat,
        },
        scheduled_time: scheduledTime,
        status: "pending",
      });

      if (error) {
        throw error;
      }

      toast.success("Campaign Scheduled!", {
        description: "Stored in publish queue for automated background dispatch.",
      });
    } catch (err: any) {
      console.error("Queue storage error:", err);
      toast.error("Queue Storage Failed", {
        description: err.message || "Failed to write campaign to the database queue.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="px-8 py-7 max-w-7xl mx-auto space-y-6 bg-[#FFF6ED] min-h-screen text-slate-900">
      <header className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between border-b border-orange-200/80 pb-5">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
            AI Brain Workspace
            <Badge
              variant="outline"
              className="gap-1 font-bold text-xs border border-orange-500/30 bg-orange-500/10 text-orange-700"
            >
              <Sparkles size={11} className="text-orange-600 animate-pulse" /> Core Engine
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Connect content parameters, spark generative model intelligence, and dispatch optimized
            posts directly to automated publishing queues.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[450px_1fr]">
        {/* Left Side: Configuration & Inputs */}
        <Card className="h-fit border-muted bg-card/60 backdrop-blur-md shadow-xl flex flex-col">
          <CardHeader className="border-b pb-4">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                1
              </span>
              Campaign Parameters
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Define the strategy, target platform vectors, and content inputs
            </p>
          </CardHeader>

          <CardContent className="space-y-6 p-6">
            {/* Context/Goal Textarea */}
            <div className="space-y-2">
              <Label
                htmlFor="goal"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Marketing Goal & Context
              </Label>
              <Textarea
                id="goal"
                value={marketingGoal}
                onChange={(e) => setMarketingGoal(e.target.value)}
                rows={5}
                className="resize-none text-sm border-muted focus-visible:ring-primary bg-background/50"
                placeholder="What are you launching? Describe key hooks, promo codes, deadlines, or audience targets."
              />
            </div>

            {/* Media Asset URL Input */}
            <div className="space-y-2">
              <Label
                htmlFor="mediaUrl"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5"
              >
                <LinkIcon size={12} className="text-muted-foreground" /> Media Asset URL
              </Label>
              <Input
                id="mediaUrl"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(convertGoogleDriveLink(e.target.value))}
                className="text-sm border-muted focus-visible:ring-primary bg-background/50"
                placeholder="Enter direct video/image URL..."
              />

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*"
              />

              {/* Real Media Dropzone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={async (e) => {
                  e.preventDefault();
                  setDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    await uploadFile(file);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative cursor-pointer rounded-lg border border-dashed border-muted p-4 text-center transition-all hover:bg-muted/10 min-h-[90px] flex items-center justify-center",
                  dragging && "border-primary bg-primary/5",
                  mediaUrl && "border-success/40 bg-success/5",
                )}
              >
                {isUploadingMedia ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">
                      Uploading file to Supabase storage...
                    </span>
                  </div>
                ) : mediaUrl ? (
                  <div className="flex items-center justify-between w-full text-left">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded bg-success/10 text-success">
                        {uploadedFileDetails?.type.includes("video") ||
                          mediaUrl.match(/\.(mp4|mov|webm|avi)/i) ? (
                          <FileVideo size={18} />
                        ) : (
                          <ImageIcon size={18} />
                        )}
                      </div>
                      <div className="max-w-[240px]">
                        <div className="text-xs font-semibold truncate">
                          {uploadedFileDetails?.name ||
                            mediaUrl.substring(mediaUrl.lastIndexOf("/") + 1)}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {uploadedFileDetails?.size || "External file"} · Ready to schedule
                        </div>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMediaUrl("");
                        setUploadedFileDetails(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <UploadCloud size={20} className="mx-auto text-muted-foreground" />
                    <div className="text-xs font-semibold">
                      Drag & Drop or Click to choose video/image
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Files are stored securely in Supabase bucket
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Platform Matrix */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Target Platform Vector Matrix
              </Label>
              {isLoadingPlatforms ? (
                <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground border rounded-lg bg-background/50">
                  <Loader2 size={13} className="animate-spin text-primary" />
                  <span>Loading linked channels...</span>
                </div>
              ) : connectedPlatforms.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted p-4 text-center space-y-2 bg-background/50">
                  <p className="text-xs text-muted-foreground">
                    No social media accounts connected yet.
                  </p>
                  <Button variant="outline" size="sm" className="text-xs h-7 w-full" asChild>
                    <Link to="/integrations">Connect Platforms</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  {PLATFORMS.filter((p) => connectedPlatforms.includes(p.id)).map((p) => {
                    const checked = selectedPlatforms.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-xs transition-all",
                          checked
                            ? "border-primary/50 bg-primary/[0.04] shadow-sm font-semibold"
                            : "border-muted hover:bg-muted/20 text-muted-foreground",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => togglePlatform(p.id)}
                          className="border-muted-foreground/40"
                        />
                        <PlatformIcon platform={p.id} size={13} />
                        <span>{platformLabel(p.id)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Generate Trigger */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full gap-2 bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/90 hover:to-indigo-600/90 text-white font-medium shadow-md transition-all active:scale-[0.98]"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Sparking AI Strategy...
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Generate Campaign Workspace
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Right Side: The AI Intelligence Workspace */}
        <div className="flex flex-col gap-6">
          {isGenerating ? (
            /* Analysis & Processing Loader */
            <Card className="flex-1 min-h-[500px] border-muted bg-card/40 flex flex-col items-center justify-center text-center p-8">
              <div className="relative mb-6">
                <div className="h-16 w-16 rounded-full border-4 border-muted border-t-primary animate-spin"></div>
                <Sparkles
                  size={18}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary animate-pulse"
                />
              </div>
              <h3 className="text-lg font-bold">Assembling Campaign Architecture...</h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                DeepSeek AI analyzing platform matrix, optimizing trending hashtags, and calculating
                peak-hour triggers...
              </p>

              <div className="mt-6 w-full max-w-xs space-y-2 text-left font-mono text-[10px] text-muted-foreground/80 bg-muted/15 p-4 rounded border">
                <div className="flex items-center justify-between">
                  <span>→ Analyzing platforms</span>
                  <Badge
                    variant="outline"
                    className="text-[8px] h-4 text-success border-success/30 bg-success/5 animate-pulse"
                  >
                    Done
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>→ Extracting trending hashtags</span>
                  <Badge
                    variant="outline"
                    className="text-[8px] h-4 text-success border-success/30 bg-success/5 animate-pulse"
                  >
                    Done
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>→ Running caption personalization</span>
                  <div className="h-2 w-2 rounded-full bg-primary animate-ping"></div>
                </div>
              </div>
            </Card>
          ) : !generatedData ? (
            /* Awaiting Input Glassmorphism Placeholder */
            <Card className="flex-1 min-h-[500px] border-dashed border-muted bg-card/20 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-6 animate-pulse">
                <Sparkles size={28} />
                <span className="absolute inset-0 rounded-full border border-primary/20 animate-ping"></span>
              </div>
              <h3 className="text-xl font-bold tracking-tight">
                AI Creator Workspace Awaiting Input
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Configure your launching goals and platform matrix on the left, then trigger the AI
                engine to compose premium platform copy, extract optimized hashtags, and calculate
                optimal timing parameters.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs font-mono text-muted-foreground/60 bg-muted/5 p-4 rounded-lg border">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span> DeepSeek Chat
                  Engine
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary"></span> High Reach Targeting
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span> Auto Queue
                  Integration
                </div>
              </div>
            </Card>
          ) : (
            /* High-Octane Workspace Container */
            <Card className="flex-1 border-muted bg-card/60 backdrop-blur-md shadow-2xl flex flex-col animate-in fade-in duration-300">
              <CardHeader className="border-b pb-4 flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                      2
                    </span>
                    Interactive AI Workspace
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Customize and audit generated variations before committing to automated
                    scheduling queue
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="text-xs text-emerald-500 border-emerald-500/20 bg-emerald-500/5 flex items-center gap-1"
                >
                  <Check size={11} /> AI Synchronized
                </Badge>
              </CardHeader>

              <CardContent className="space-y-6 p-6">
                {/* Platform caption textareas */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Platform Optimized Copies & Content
                  </h4>

                  <div className="space-y-4">
                    {selectedPlatforms.map((platform) => (
                      <div
                        key={platform}
                        className="space-y-2 border border-muted rounded-lg p-4 bg-background/40 hover:bg-background/60 transition-all duration-200"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <PlatformIcon platform={platform} size={15} />
                            <span className="text-sm font-semibold capitalize">
                              {platformLabel(platform)} Caption
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                            {generatedData.captions[platform]?.length || 0} characters
                          </span>
                        </div>

                        <Textarea
                          value={generatedData.captions[platform] || ""}
                          onChange={(e) => handleCaptionChange(platform, e.target.value)}
                          rows={platform === "x" ? 3 : 5}
                          className="text-sm border-muted focus-visible:ring-primary bg-background/50 w-full"
                          placeholder={`Customize caption for ${platformLabel(platform)}...`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interactive Hashtag badges */}
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Hash size={12} className="text-primary" /> Trending & Strategy Hashtags
                      (Click to remove)
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      Total: {generatedData.hashtags.length}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-muted bg-background/30 min-h-[50px] transition-all">
                    {generatedData.hashtags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        onClick={() => removeHashtag(tag)}
                        className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground hover:border-destructive/30 hover:scale-95 transition-all duration-150 gap-1 flex items-center bg-muted/60 text-xs py-1"
                      >
                        {tag}
                        <X size={10} className="text-muted-foreground group-hover:text-white" />
                      </Badge>
                    ))}
                    {generatedData.hashtags.length === 0 && (
                      <span className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                        <AlertCircle size={12} /> No hashtags active. Type below to inject custom
                        tags.
                      </span>
                    )}
                  </div>

                  {/* Small widget to add hashtags */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={newHashtag}
                      onChange={(e) => setNewHashtag(e.target.value)}
                      placeholder="Add custom hashtag (e.g. eco)"
                      className="h-8 text-xs max-w-[240px] border-muted"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addHashtag();
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold"
                      onClick={addHashtag}
                    >
                      Inject Hashtag
                    </Button>
                  </div>
                </div>

                {/* Publishing Format Selector */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Publishing Format
                  </Label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPostFormat("post")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3.5 rounded-lg border text-center cursor-pointer transition-all",
                        postFormat === "post"
                          ? "border-primary/50 bg-primary/[0.04] text-foreground font-semibold shadow-sm"
                          : "border-muted text-muted-foreground hover:bg-muted/10",
                      )}
                    >
                      <span className="text-xs font-semibold">Feed Post</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        Image or Text update
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostFormat("video")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3.5 rounded-lg border text-center cursor-pointer transition-all",
                        postFormat === "video"
                          ? "border-primary/50 bg-primary/[0.04] text-foreground font-semibold shadow-sm"
                          : "border-muted text-muted-foreground hover:bg-muted/10",
                      )}
                    >
                      <span className="text-xs font-semibold">Long Video</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        Feed videos or YouTube
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostFormat("short")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3.5 rounded-lg border text-center cursor-pointer transition-all",
                        postFormat === "short"
                          ? "border-primary/50 bg-primary/[0.04] text-foreground font-semibold shadow-sm"
                          : "border-muted text-muted-foreground hover:bg-muted/10",
                      )}
                    >
                      <span className="text-xs font-semibold">Short / Reel</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        Vertical videos under 60s
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostFormat("story")}
                      className={cn(
                        "flex flex-col items-center justify-center p-3.5 rounded-lg border text-center cursor-pointer transition-all",
                        postFormat === "story"
                          ? "border-primary/50 bg-primary/[0.04] text-foreground font-semibold shadow-sm"
                          : "border-muted text-muted-foreground hover:bg-muted/10",
                      )}
                    >
                      <span className="text-xs font-semibold">Story / Ephemeral</span>
                      <span className="text-[9px] text-muted-foreground mt-0.5">
                        Publish to Stories (24h)
                      </span>
                    </button>
                  </div>

                  {validationWarning && (
                    <div className="mt-2.5 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 flex items-start gap-2 animate-in fade-in duration-200">
                      <AlertCircle size={14} className="mt-0.5 shrink-0" />
                      <span className="text-[11px] leading-normal font-medium">{validationWarning}</span>
                    </div>
                  )}
                </div>

                {/* Scheduling and Timing Widget */}
                <div className="border border-primary/20 bg-primary/[0.02] rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
                      <Clock size={16} />
                    </div>
                    <div className="flex-1 space-y-1">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        Audience & Time Analysis Scheduling Heuristics
                        <Badge
                          variant="outline"
                          className="border-primary/30 bg-primary/10 text-primary text-[9px] py-0.5"
                        >
                          Format Optimal
                        </Badge>
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        DeepSeek AI calculated posting window optimized for maximum digital
                        marketing reach and peak algorithmic engagement. Adjust direct schedule
                        execution timestamp in the native control below:
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-muted">
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <div>
                        <Label
                          htmlFor="publish-time"
                          className="text-xs font-semibold text-foreground/80 flex items-center gap-1"
                        >
                          <Calendar size={12} className="text-primary" /> Target Execution Slot
                        </Label>
                        <Input
                          id="publish-time"
                          type="datetime-local"
                          value={suggestedPublishTime}
                          onChange={(e) => setSuggestedPublishTime(e.target.value)}
                          className="h-9 text-xs border-muted bg-background focus:ring-primary font-mono mt-1"
                        />
                      </div>
                      {suggestedPublishTime && (
                        <div className="text-[11px] text-primary font-semibold mt-2 bg-primary/5 border border-primary/15 rounded px-2.5 py-1.5 flex items-center gap-1.5">
                          <Check size={11} className="text-primary animate-pulse" />
                          <span>Target: {getReadableDateTime(suggestedPublishTime)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col justify-center rounded border border-muted bg-background/40 p-3 text-xs">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        Reach Projections
                      </div>
                      <div className="font-semibold text-foreground mt-0.5 flex items-center justify-between">
                        <span>Reach Potential:</span>
                        <span className="text-primary font-mono">195k - 230k</span>
                      </div>
                      <div className="font-semibold text-foreground mt-0.5 flex items-center justify-between">
                        <span>Engagement Est:</span>
                        <span className="text-primary font-mono">5.2% - 6.5%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Strategy & Analysis Report */}
                {generatedData.analysis_reasoning && (
                  <div className="border border-emerald-500/25 bg-emerald-500/[0.02] rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500">
                      <Sparkles size={14} className="animate-pulse" />
                      <h5 className="font-bold text-xs uppercase tracking-wider">
                        DeepSeek AI Strategy & Reach Analysis
                      </h5>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {generatedData.analysis_reasoning}
                    </p>
                  </div>
                )}

                {/* Queue Storage Handshake button */}
                <Button
                  onClick={handleSaveToQueue}
                  disabled={isSaving}
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 shadow-lg active:scale-[0.98] transition-all"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Transmitting parameters to
                      database...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Save to Content Queue & Activate
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
