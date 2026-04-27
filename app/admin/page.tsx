"use client";

import { useState } from "react";
import { Sidebar, type SectionId } from "./components/sidebar";

export default function AdminPage() {
  const [active, setActive] = useState<SectionId>("overview");

  return (
    <div className="flex min-h-screen">
      <Sidebar active={active} onSelect={setActive} />
      <main className="ml-56 flex-1 p-8">
        <h2 className="text-2xl font-semibold mb-6 capitalize">{active}</h2>
        <p className="text-muted-foreground">Section content goes here.</p>
      </main>
    </div>
  );
}
