"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Loader2, ExternalLink } from "lucide-react";

interface SampleResult {
  title: string;
  url: string;
}

interface SearchApiResult {
  status: "healthy" | "error";
  responseTime: number;
  resultCount: number;
  sampleResults: SampleResult[];
  error?: string;
}

interface SearchData {
  tavily: SearchApiResult;
  exa: SearchApiResult;
}

export function SearchApis() {
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/search");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Search APIs</h2>
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
      </div>

      {error && (
        <p className="text-sm text-destructive">Error: {error}</p>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {loading && !data ? (
          <>
            <SearchCardSkeleton />
            <SearchCardSkeleton />
          </>
        ) : data ? (
          <>
            <SearchCard name="Tavily" result={data.tavily} />
            <SearchCard name="Exa" result={data.exa} />
          </>
        ) : null}
      </div>
    </div>
  );
}

function SearchCard({
  name,
  result,
}: {
  name: string;
  result: SearchApiResult;
}) {
  const isHealthy = result.status === "healthy";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-medium">{name}</CardTitle>
        <Badge variant={isHealthy ? "default" : "destructive"}>
          {isHealthy ? "Healthy" : "Error"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>
            Response:{" "}
            <span className="font-medium text-foreground">
              {result.responseTime}ms
            </span>
          </span>
          <span>
            Results:{" "}
            <span className="font-medium text-foreground">
              {result.resultCount}
            </span>
          </span>
        </div>

        {result.error && (
          <p className="text-sm text-destructive">{result.error}</p>
        )}

        {result.sampleResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sample Results
            </p>
            <ul className="space-y-1.5">
              {result.sampleResults.map((r, i) => (
                <li key={i} className="text-sm">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-1">
                      {r.title || r.url}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SearchCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      </CardContent>
    </Card>
  );
}
