"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Rss,
  Search,
  Database,
  FileText,
  MessageSquare,
  Settings,
} from "lucide-react";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "feeds", label: "Feeds", icon: Rss },
  { id: "search", label: "Search APIs", icon: Search },
  { id: "database", label: "Database", icon: Database },
  { id: "findings", label: "Findings", icon: FileText },
  { id: "slack", label: "Slack", icon: MessageSquare },
  { id: "config", label: "Config", icon: Settings },
] as const;

export type SectionId = (typeof sections)[number]["id"];

export function Sidebar({
  active,
  onSelect,
}: {
  active: SectionId;
  onSelect: (id: SectionId) => void;
}) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 border-r border-border bg-card flex flex-col py-6">
      <div className="px-5 mb-8">
        <h1 className="text-sm font-bold tracking-wide uppercase text-muted-foreground">
          Market Intel
        </h1>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active === s.id
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <s.icon className="h-4 w-4" />
            {s.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
