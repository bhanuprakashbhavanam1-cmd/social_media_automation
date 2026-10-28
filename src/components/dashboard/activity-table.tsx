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
import { ACTIVITY } from "@/lib/mock-data";
import { Activity } from "lucide-react";

export function ActivityTable() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            Recent automation activity
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Last 24 hours across all connected platforms
          </p>
        </div>
        <Badge variant="secondary" className="font-medium">
          {ACTIVITY.length} events
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[40px]"></TableHead>
              <TableHead>Content</TableHead>
              <TableHead className="w-[90px]">Type</TableHead>
              <TableHead className="w-[200px]">Trigger</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[110px] text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ACTIVITY.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <PlatformIcon platform={row.platform} withBg size={14} />
                </TableCell>
                <TableCell className="max-w-[320px] truncate font-medium text-foreground">
                  {row.preview}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {row.type}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{row.trigger}</TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {row.time}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
