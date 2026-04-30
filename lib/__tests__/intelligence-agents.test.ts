import { describe, expect, it, vi } from "vitest";
import { runAllAgentsWithRunner } from "../intelligence-agents";
import type { AgentFinding, IntelligenceStream } from "../types";

function finding(stream: IntelligenceStream): AgentFinding {
  return {
    stream,
    title: `${stream} finding`,
    summary: "summary",
    entity: "entity",
    action: "action",
    sourceUrl: `https://example.com/${stream}`,
    sourceName: "example",
  };
}

describe("runAllAgentsWithRunner", () => {
  it("continues processing other streams when one stream fails", async () => {
    const streams: IntelligenceStream[] = ["policy", "funding", "market"];
    const runStream = vi.fn(async (stream: IntelligenceStream) => {
      if (stream === "funding") throw new Error("boom");
      return [finding(stream)];
    });

    const result = await runAllAgentsWithRunner(runStream, streams);

    expect(runStream).toHaveBeenCalledTimes(3);
    expect(result.policy).toHaveLength(1);
    expect(result.funding).toEqual([]);
    expect(result.market).toHaveLength(1);
  });
});
