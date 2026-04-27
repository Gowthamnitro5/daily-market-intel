"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Send } from "lucide-react";

const CHANNELS = [
  { id: "C0AN4KC27SN", label: "Dev" },
  { id: "C0AHFFG40TX", label: "Prod" },
] as const;

export function SlackPreview() {
  const [channel, setChannel] = useState<string>(CHANNELS[0].id);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ ok: true, message: "Sent successfully" });
      } else {
        setResult({
          ok: false,
          message: data.error ?? "Failed to send",
        });
      }
    } catch (err) {
      setResult({
        ok: false,
        message: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setSending(false);
    }
  };

  const today = new Date().toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const selectedLabel =
    CHANNELS.find((c) => c.id === channel)?.label ?? "Dev";

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Slack Preview</h2>

      <div className="flex items-center gap-3">
        <Select value={channel} onValueChange={(v) => { if (v) setChannel(v); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select channel">{selectedLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CHANNELS.map((ch) => (
              <SelectItem key={ch.id} value={ch.id}>
                {ch.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={handleSend} disabled={sending}>
          {sending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {sending ? "Sending..." : "Send to Slack"}
        </Button>

        {result && (
          <Badge variant={result.ok ? "default" : "destructive"}>
            {result.message}
          </Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm font-medium">{today}</p>
          <p className="text-sm text-muted-foreground">
            Run the pipeline from the Findings tab first, then use &quot;Send to
            Slack&quot; to deliver the latest digest to the selected channel.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
