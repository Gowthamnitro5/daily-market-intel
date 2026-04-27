"use client";

import { useState } from "react";
import { Sidebar, type SectionId } from "./components/sidebar";
import { Overview } from "./components/overview";
import { FeedsPanel } from "./components/feeds";
import { SearchApis } from "./components/search-apis";
import { DatabasePanel } from "./components/database";
import { Findings } from "./components/findings";
import { SlackPreview } from "./components/slack-preview";
import { Config } from "./components/config";

const sections: Record<SectionId, React.ComponentType> = {
  overview: Overview,
  feeds: FeedsPanel,
  search: SearchApis,
  database: DatabasePanel,
  findings: Findings,
  slack: SlackPreview,
  config: Config,
};

export default function AdminPage() {
  const [active, setActive] = useState<SectionId>("overview");
  const Section = sections[active];

  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} onSelect={setActive} />
      <main className="ml-56 flex-1 p-8">
        <Section />
      </main>
    </div>
  );
}
