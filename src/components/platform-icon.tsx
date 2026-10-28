import { Instagram, Facebook, Youtube, Twitter } from "lucide-react";
import type { PlatformId } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const MAP = {
  instagram: { Icon: Instagram, color: "text-pink-500", bg: "bg-pink-500/10" },
  facebook: { Icon: Facebook, color: "text-blue-600", bg: "bg-blue-600/10" },
  x: {
    Icon: Twitter,
    color: "text-slate-900 dark:text-slate-100",
    bg: "bg-slate-900/10 dark:bg-slate-100/10",
  },
  youtube: { Icon: Youtube, color: "text-red-600", bg: "bg-red-600/10" },
} as const;

export function PlatformIcon({
  platform,
  size = 16,
  withBg = false,
  className,
}: {
  platform: PlatformId;
  size?: number;
  withBg?: boolean;
  className?: string;
}) {
  const { Icon, color, bg } = MAP[platform];
  if (!withBg) return <Icon size={size} className={cn(color, className)} />;
  return (
    <span className={cn("inline-flex items-center justify-center rounded-md p-1.5", bg, className)}>
      <Icon size={size} className={color} />
    </span>
  );
}

export function platformLabel(p: PlatformId) {
  return { instagram: "Instagram", facebook: "Facebook", x: "X", youtube: "YouTube" }[p];
}
