"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, RefreshCw, ExternalLink, Check, X } from "lucide-react";
import type { IntelligenceStream } from "@/lib/types";

type FindingWithStages = {
  stream: IntelligenceStream;
  title: string;
  summary: string;
  entity: string;
  action: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt?: string;
  passedDedupe: boolean;
  passedRelevance: boolean;
  passedNovelty: boolean;
};

type Counts = {
  raw: number;
  deduped: number;
  relevant: number;
  fresh: number;
};

type Filter = "all" | "passed" | "failed";

const streamColors: Record<IntelligenceStream, string> = {
  policy: "bg-blue-500/15 text-blue-700 border-blue-500/25",
  funding: "bg-green-500/15 text-green-700 border-green-500/25",
  market: "bg-yellow-500/15 text-yellow-700 border-yellow-500/25",
  research: "bg-purple-500/15 text-purple-700 border-purple-500/25",
  customer: "bg-orange-500/15 text-orange-700 border-orange-500/25",
  competitive: "bg-red-500/15 text-red-700 border-red-500/25",
};

function StageIndicator({ passed, label }: { passed: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      {passed ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <X className="h-3 w-3 text-red-500" />
      )}
      <span className={passed ? "text-green-700" : "text-red-500"}>{label}</span>
    </span>
  );
}

export function Findings() {
  const [findings, setFindings] = useState<FindingWithStages[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [fetched, setFetched] = useState(false);

  const fetchFindings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/findings");
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setFindings(data.findings);
      setCounts(data.counts);
      setFetched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch findings");
    } finally {
      setLoading(false);
    }
  }, []);

  const filtered = findings.filter((f) => {
    if (filter === "passed") return f.passedNovelty;
    if (filter === "failed") return !f.passedNovelty;
    return true;
  });

  if (!fetched && !loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Findings</h2>
        <Card>
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">
              Click Fetch Findings to run pipeline in dry-run mode
            </p>
            <Button onClick={fetchFindings}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Fetch Findings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Findings</h2>
          <Button disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Running pipeline...
          </Button>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Findings</h2>
          <Button onClick={fetchFindings} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Findings</h2>
        <Button onClick={fetchFindings} variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {counts && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{counts.raw}</span> Raw
          <span className="text-muted-foreground/50">&rarr;</span>
          <span className="font-medium text-foreground">{counts.deduped}</span> Deduped
          <span className="text-muted-foreground/50">&rarr;</span>
          <span className="font-medium text-foreground">{counts.relevant}</span> Relevant
          <span className="text-muted-foreground/50">&rarr;</span>
          <span className="font-medium text-foreground">{counts.fresh}</span> Final
        </div>
      )}

      <div className="flex items-center gap-2">
        {(["all", "passed", "failed"] as Filter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "passed" ? "Passed" : "Failed"}
            {f === "all" && ` (${findings.length})`}
            {f === "passed" && ` (${findings.filter((x) => x.passedNovelty).length})`}
            {f === "failed" && ` (${findings.filter((x) => !x.passedNovelty).length})`}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((f, i) => (
          <Card
            key={`${f.sourceUrl}-${i}`}
            className={!f.passedNovelty ? "opacity-50" : ""}
          >
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${streamColors[f.stream]}`}
                  >
                    {f.stream}
                  </Badge>
                  <a
                    href={f.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm hover:underline truncate flex items-center gap-1"
                  >
                    {f.title}
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                  </a>
                </div>
              </div>

              <p className="text-sm text-muted-foreground line-clamp-2">
                {f.summary}
              </p>

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{f.sourceName}</span>
                <div className="flex items-center gap-3">
                  <StageIndicator passed={f.passedDedupe} label="dedupe" />
                  <StageIndicator passed={f.passedRelevance} label="relevance" />
                  <StageIndicator passed={f.passedNovelty} label="novelty" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No findings match the current filter.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
