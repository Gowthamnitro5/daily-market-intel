"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

const ENV_VARS = [
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "TAVILY_API_KEY",
  "EXA_API_KEY",
  "AI_GATEWAY_API_KEY",
  "CF_API_TOKEN",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "SLACK_CHANNEL_ID",
  "CRON_SECRET",
  "CUSTOM_MESSAGE_TOKEN",
] as const;

const PIPELINE_CONFIG = [
  { label: "LLM Model", value: "nvidia/nemotron-3-super-120b-a12b:free" },
  { label: "Search Window", value: "72 hours" },
  { label: "Novelty Threshold", value: "0.80 similarity" },
  { label: "Exa Results per Stream", value: "20" },
  { label: "Tavily Results per Stream", value: "20" },
  { label: "Cron Schedule", value: "8:00 AM IST daily" },
] as const;

export function Config() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Config</h2>

      <p className="text-sm text-muted-foreground">
        Values are masked. Manage via <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">vercel env</code> or{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">.env.local</code>.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              {ENV_VARS.map((name) => (
                <TableRow key={name}>
                  <TableCell className="font-mono text-sm">{name}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary">Configured via env</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pipeline Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {PIPELINE_CONFIG.map((item, i) => (
            <div key={item.label}>
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm text-muted-foreground">
                  {item.value}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
