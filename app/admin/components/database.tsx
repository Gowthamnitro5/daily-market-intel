"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RefreshCw, Loader2, Trash2 } from "lucide-react";

const STREAM_COLORS: Record<string, string> = {
  policy: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  funding: "bg-green-500/15 text-green-700 dark:text-green-400",
  market: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  research: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  customer: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  competitive: "bg-red-500/15 text-red-700 dark:text-red-400",
};

type SeenEvent = {
  event_key: string;
  last_seen_at: string;
};

type PublishedItem = {
  title: string;
  stream: string;
  source_url: string;
  first_slack_published_at: string;
};

type DatabaseData = {
  seenEvents: { count: number; recent: SeenEvent[] };
  publishedItems: { count: number; recent: PublishedItem[] };
};

function formatIST(dateStr: string | null): string {
  if (!dateStr) return "---";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
  } catch {
    return "Invalid date";
  }
}

export function DatabasePanel() {
  const [data, setData] = useState<DatabaseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/database");
      const json: DatabaseData = await res.json();
      setData(json);
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleClear = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/admin/database/clear", { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setDialogOpen(false);
        await fetchData();
      }
    } catch {
      // silently fail
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header row with counts + actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {data ? (
            <>
              <Badge variant="secondary" className="text-sm">
                seen_events: {data.seenEvents.count}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                published_items: {data.publishedItems.count}
              </Badge>
            </>
          ) : loading ? (
            <>
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-6 w-40" />
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear seen_events
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear seen_events table?</DialogTitle>
                <DialogDescription>
                  This will delete all entries from the seen_events table. The
                  next pipeline run will re-process all feed items as if they
                  were new. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDialogOpen(false)}
                  disabled={clearing}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClear}
                  disabled={clearing}
                >
                  {clearing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Delete All
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* Seen Events Table */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Recent seen_events
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (latest 20)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>event_key</TableHead>
                    <TableHead className="w-[200px] text-right">
                      last_seen_at
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.seenEvents.recent.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="text-center text-muted-foreground py-8"
                      >
                        No entries
                      </TableCell>
                    </TableRow>
                  )}
                  {data.seenEvents.recent.map((row) => (
                    <TableRow key={row.event_key}>
                      <TableCell className="font-mono text-xs max-w-[500px] truncate">
                        {row.event_key}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatIST(row.last_seen_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Published Items Table */}
      {data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Recent published_items
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                (latest 20)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[110px]">Stream</TableHead>
                    <TableHead className="w-[200px] text-right">
                      Published At
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.publishedItems.recent.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground py-8"
                      >
                        No entries
                      </TableCell>
                    </TableRow>
                  )}
                  {data.publishedItems.recent.map((row, i) => (
                    <TableRow key={`${row.source_url}-${i}`}>
                      <TableCell className="text-sm max-w-[400px] truncate">
                        {row.title}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STREAM_COLORS[row.stream] ?? ""}`}
                        >
                          {row.stream}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatIST(row.first_slack_published_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
