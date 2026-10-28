export type PlatformId = "instagram" | "facebook" | "x" | "youtube";

export interface Platform {
  id: PlatformId;
  name: string;
  handle: string;
  permissions: string[];
}

export const PLATFORMS: Platform[] = [
  {
    id: "instagram",
    name: "Instagram Business",
    handle: "@brewhaus.coffee",
    permissions: ["video_upload", "read_analytics", "publish_content"],
  },
  {
    id: "facebook",
    name: "Facebook Pages",
    handle: "Brewhaus Coffee Co.",
    permissions: ["pages_manage_posts", "pages_read_engagement"],
  },
  {
    id: "x",
    name: "X (Twitter)",
    handle: "@brewhaus_co",
    permissions: ["tweet.write", "users.read", "tweet.read"],
  },
  {
    id: "youtube",
    name: "YouTube Shorts",
    handle: "Brewhaus Channel",
    permissions: ["youtube.upload", "youtube.readonly"],
  },
];

export type ActivityStatus = "Published" | "Scheduled" | "Retrying" | "Failed";
export type ContentType = "Short" | "Video" | "Post" | "Reel" | "Tweet";

export interface ActivityRow {
  id: string;
  platform: PlatformId;
  preview: string;
  type: ContentType;
  trigger: string;
  status: ActivityStatus;
  time: string;
}

export const ACTIVITY: ActivityRow[] = [
  {
    id: "a1",
    platform: "instagram",
    preview: "Morning pour-over ritual — slow brew, fast smiles ☕",
    type: "Reel",
    trigger: "Audience Peak",
    status: "Published",
    time: "2h ago",
  },
  {
    id: "a2",
    platform: "youtube",
    preview: "How we roast our single-origin Ethiopian beans",
    type: "Short",
    trigger: "Trending Hashtag #CoffeeTok",
    status: "Published",
    time: "4h ago",
  },
  {
    id: "a3",
    platform: "x",
    preview: "First 50 orders today get a free reusable mug. Code: GREENFIELD",
    type: "Tweet",
    trigger: "Manual Approval",
    status: "Scheduled",
    time: "in 1h 12m",
  },
  {
    id: "a4",
    platform: "facebook",
    preview: "Behind the bar with Mira — our head barista shares her go-to drink",
    type: "Post",
    trigger: "Weekly Recurring",
    status: "Scheduled",
    time: "Tomorrow 9:00 AM",
  },
  {
    id: "a5",
    platform: "instagram",
    preview: "Thermal mug close-up — 12h heat retention test",
    type: "Reel",
    trigger: "Product Launch Trigger",
    status: "Retrying",
    time: "5m ago",
  },
  {
    id: "a6",
    platform: "youtube",
    preview: "Eco-friendly packaging unboxing in 30 seconds",
    type: "Short",
    trigger: "Audience Peak",
    status: "Published",
    time: "Yesterday",
  },
  {
    id: "a7",
    platform: "x",
    preview: "Sustainability report: 84% recycled materials across our supply chain",
    type: "Tweet",
    trigger: "AI Strategy Suggestion",
    status: "Published",
    time: "Yesterday",
  },
  {
    id: "a8",
    platform: "facebook",
    preview: "Saturday market lineup — find us at 6 cities this weekend",
    type: "Post",
    trigger: "Geo-targeted Trigger",
    status: "Failed",
    time: "2d ago",
  },
];

export interface AiInsight {
  id: string;
  title: string;
  body: string;
  cta: string;
  tone: "success" | "warning" | "info";
}

export const AI_INSIGHTS: AiInsight[] = [
  {
    id: "i1",
    title: "Engagement spike detected",
    body: "Detected 25% spike in engagement for #CoffeeCulture on Instagram. Recommendation: Approve pending morning short.",
    cta: "Review queue",
    tone: "success",
  },
  {
    id: "i2",
    title: "Optimal slot opening",
    body: "Audience density on YouTube peaks in 47 minutes. Your eco mug Short is ready to deploy.",
    cta: "Force publish",
    tone: "info",
  },
  {
    id: "i3",
    title: "Hashtag fatigue warning",
    body: "#SustainableLiving usage on your account is up 320% MoM — variation recommended to avoid algorithmic dampening.",
    cta: "Generate variants",
    tone: "warning",
  },
  {
    id: "i4",
    title: "Cross-platform repurpose",
    body: "Your last YouTube Short outperformed peers by 4.2×. Re-cut a 15s vertical for Instagram Reels.",
    cta: "Open creator",
    tone: "info",
  },
];

export type QueueSource = "Manual" | "Automated";
export interface QueueItem {
  id: string;
  platform: PlatformId;
  title: string;
  type: ContentType;
  scheduledFor: string;
  source: QueueSource;
}

export const QUEUE: QueueItem[] = [
  {
    id: "q1",
    platform: "instagram",
    title: "Eco-friendly thermal mug launch — Reel",
    type: "Reel",
    scheduledFor: "Thu 6:30 PM",
    source: "Automated",
  },
  {
    id: "q2",
    platform: "youtube",
    title: "How thermal mugs keep coffee hot for 12 hours",
    type: "Short",
    scheduledFor: "Thu 7:15 PM",
    source: "Automated",
  },
  {
    id: "q3",
    platform: "x",
    title: "Free shipping today with code GREENFIELD",
    type: "Tweet",
    scheduledFor: "Fri 9:00 AM",
    source: "Manual",
  },
  {
    id: "q4",
    platform: "facebook",
    title: "Weekend market schedule announcement",
    type: "Post",
    scheduledFor: "Fri 12:00 PM",
    source: "Manual",
  },
  {
    id: "q5",
    platform: "instagram",
    title: "Barista skill series — Episode 04",
    type: "Reel",
    scheduledFor: "Sat 8:45 AM",
    source: "Automated",
  },
  {
    id: "q6",
    platform: "youtube",
    title: "Behind the roast — Ethiopian Yirgacheffe",
    type: "Short",
    scheduledFor: "Sat 11:30 AM",
    source: "Automated",
  },
  {
    id: "q7",
    platform: "x",
    title: "Customer spotlight: @maya.brews thermal mug review",
    type: "Tweet",
    scheduledFor: "Sun 10:00 AM",
    source: "Manual",
  },
];

export interface AnalyticsRow {
  id: string;
  platform: PlatformId;
  title: string;
  type: ContentType;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
}

export const ANALYTICS_ROWS: AnalyticsRow[] = [
  {
    id: "p1",
    platform: "instagram",
    title: "Pour-over morning ritual",
    type: "Reel",
    impressions: 184_320,
    likes: 12_840,
    comments: 612,
    shares: 1_944,
  },
  {
    id: "p2",
    platform: "youtube",
    title: "Roast process — Ethiopia",
    type: "Short",
    impressions: 412_009,
    likes: 28_104,
    comments: 1_429,
    shares: 4_211,
  },
  {
    id: "p3",
    platform: "x",
    title: "Free shipping w/ GREENFIELD",
    type: "Tweet",
    impressions: 58_412,
    likes: 2_109,
    comments: 244,
    shares: 980,
  },
  {
    id: "p4",
    platform: "facebook",
    title: "Mira barista feature",
    type: "Post",
    impressions: 41_007,
    likes: 1_822,
    comments: 304,
    shares: 219,
  },
  {
    id: "p5",
    platform: "instagram",
    title: "Thermal mug 12h test",
    type: "Reel",
    impressions: 224_770,
    likes: 19_404,
    comments: 882,
    shares: 3_310,
  },
  {
    id: "p6",
    platform: "youtube",
    title: "Eco-packaging unboxing",
    type: "Short",
    impressions: 318_119,
    likes: 21_004,
    comments: 1_011,
    shares: 3_002,
  },
  {
    id: "p7",
    platform: "x",
    title: "Sustainability report drop",
    type: "Tweet",
    impressions: 47_220,
    likes: 1_404,
    comments: 198,
    shares: 612,
  },
  {
    id: "p8",
    platform: "facebook",
    title: "Saturday market lineup",
    type: "Post",
    impressions: 36_550,
    likes: 1_201,
    comments: 144,
    shares: 188,
  },
];

export function engagementRate(row: AnalyticsRow): number {
  const interactions = row.likes + row.comments + row.shares;
  return (interactions / row.impressions) * 100;
}

// 30-day growth + posting velocity series
export const GROWTH_SERIES = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const followers = 48_000 + Math.round(i * 480 + Math.sin(i / 3) * 320);
  const posts = 2 + Math.round(Math.abs(Math.sin(i / 2)) * 4);
  return {
    day: `D${day.toString().padStart(2, "0")}`,
    followers,
    posts,
  };
});
