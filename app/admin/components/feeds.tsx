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
import { Loader2, RefreshCw } from "lucide-react";

type FeedResult = {
  url: string;
  stream: string;
  status: "ok" | "error";
  httpCode: number | null;
  itemCount: number;
  responseTime: number;
};

type FeedsResponse = {
  feeds: FeedResult[];
  total: number;
  healthy: number;
};

const STREAM_COLORS: Record<string, string> = {
  policy: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  funding: "bg-green-500/15 text-green-700 dark:text-green-400",
  market: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  research: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  customer: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  competitive: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const FILTERS = [
  "all",
  "errors",
  "policy",
  "funding",
  "market",
  "research",
  "customer",
  "competitive",
] as const;

type Filter = (typeof FILTERS)[number];

function truncateUrl(url: string, max = 60): string {
  if (url.length <= max) return url;
  return url.slice(0, max - 1) + "\u2026";
}

export function FeedsPanel() {
  const [data, setData] = useState<FeedsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchFeeds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feeds");
      const json: FeedsResponse = await res.json();
      setData(json);
    } catch {
      // silently fail — user can retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const filtered = data
    ? data.feeds
        .filter((f) => {
          if (filter === "all") return true;
          if (filter === "errors") return f.status === "error";
          return f.stream === filter;
        })
        .sort((a, b) => {
          // errors first
          if (a.status === "error" && b.status !== "error") return -1;
          if (a.status !== "error" && b.status === "error") return 1;
          return 0;
        })
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">
          RSS Feed Health
          {data && (
            <span className="ml-3 text-sm font-normal text-muted-foreground">
              {data.healthy}/{data.total} healthy
            </span>
          )}
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchFeeds}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Check All
        </Button>
      </CardHeader>
      <CardContent>
        {/* Filter buttons */}
        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f}
            </Button>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && !data && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {/* Results table */}
        {data && (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[110px]">Stream</TableHead>
                  <TableHead>Feed URL</TableHead>
                  <TableHead className="w-[80px] text-right">HTTP</TableHead>
                  <TableHead className="w-[80px] text-right">Items</TableHead>
                  <TableHead className="w-[100px] text-right">
                    Time (ms)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground py-8"
                    >
                      No feeds match the current filter.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((feed) => (
                  <TableRow key={feed.url}>
                    <TableCell>
                      <Badge
                        variant={
                          feed.status === "ok" ? "default" : "destructive"
                        }
                        className="text-xs"
                      >
                        {feed.status === "ok" ? "OK" : "ERR"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${STREAM_COLORS[feed.stream] ?? ""}`}
                      >
                        {feed.stream}
                      </span>
                    </TableCell>
                    <TableCell
                      className="font-mono text-xs max-w-[400px] truncate"
                      title={feed.url}
                    >
                      {truncateUrl(feed.url)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {feed.httpCode ?? "---"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {feed.itemCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {feed.responseTime.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
