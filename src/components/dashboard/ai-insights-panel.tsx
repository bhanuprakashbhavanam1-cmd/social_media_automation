import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AI_INSIGHTS } from "@/lib/mock-data";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  success: { Icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
  warning: { Icon: AlertTriangle, color: "text-warning-foreground", bg: "bg-warning/20" },
  info: { Icon: Lightbulb, color: "text-primary", bg: "bg-primary/10" },
} as const;

export function AiInsightsPanel() {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          AI insights & system health
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Live recommendations from the engagement engine
        </p>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        {AI_INSIGHTS.map((insight) => {
          const { Icon, color, bg } = TONE[insight.tone];
          return (
            <div
              key={insight.id}
              className="rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40"
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    bg,
                  )}
                >
                  <Icon size={14} className={color} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="text-sm font-medium leading-tight">{insight.title}</div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-7 gap-1 text-xs text-primary hover:text-primary"
                  >
                    {insight.cta} <ArrowRight size={12} />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
