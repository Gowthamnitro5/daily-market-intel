import { describe, it, expect } from "vitest";
import { isTrustedDomain, applyAltCarbonRelevanceGate } from "../relevance";
import type { AgentFinding } from "../types";

function finding(overrides: Partial<AgentFinding> = {}): AgentFinding {
  return {
    stream: "market",
    title: "Carbon credit methodology update",
    summary: "New carbon removal protocol approved",
    entity: "Verra",
    action: "approved methodology",
    sourceUrl: "https://verra.org/article",
    sourceName: "Verra",
    ...overrides,
  };
}

describe("isTrustedDomain", () => {
  it("accepts tier1 domains", () => {
    expect(isTrustedDomain("verra.org")).toBe(true);
    expect(isTrustedDomain("carbonpulse.com")).toBe(true);
  });

  it("accepts tier2 domains", () => {
    expect(isTrustedDomain("nature.com")).toBe(true);
  });

  it("accepts tier3 domains", () => {
    expect(isTrustedDomain("reuters.com")).toBe(true);
  });

  it("accepts subdomains of trusted domains", () => {
    expect(isTrustedDomain("news.verra.org")).toBe(true);
  });

  it("rejects blocked domains", () => {
    expect(isTrustedDomain("medium.com")).toBe(false);
    expect(isTrustedDomain("substack.com")).toBe(false);
    expect(isTrustedDomain("myblog.blogspot.com")).toBe(false);
  });

  it("rejects unknown domains", () => {
    expect(isTrustedDomain("random-site.xyz")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isTrustedDomain("")).toBe(false);
  });
});

describe("applyAltCarbonRelevanceGate", () => {
  it("keeps findings from trusted domains with relevance terms", () => {
    const items = [finding()];
    const result = applyAltCarbonRelevanceGate(items);
    expect(result).toHaveLength(1);
  });

  it("filters out untrusted domains", () => {
    const items = [finding({ sourceUrl: "https://random-blog.xyz/post" })];
    const result = applyAltCarbonRelevanceGate(items);
    expect(result).toHaveLength(0);
  });

  it("filters out irrelevant content from trusted domains in primary pass", () => {
    const items = [
      finding({
        title: "Local weather forecast",
        summary: "Rain expected tomorrow",
        entity: "Weather Service",
        action: "issued forecast",
      }),
    ];
    // Should still pass via fail-open (trusted domain), but not primary gate
    const result = applyAltCarbonRelevanceGate(items);
    // Fail-open returns trusted-domain items when no relevant ones exist
    expect(result).toHaveLength(1);
  });

  it("excludes EV/solar content without core relevance terms from untrusted sources", () => {
    const items = [
      finding({
        title: "New ev charging station network",
        summary: "EV charging expands across Europe",
        entity: "ChargePoint",
        action: "expanded network",
        sourceUrl: "https://random-ev-blog.com/post",
      }),
    ];
    const result = applyAltCarbonRelevanceGate(items);
    expect(result).toHaveLength(0);
  });

  it("excludes EV content from trusted sources via exclude terms when no core match", () => {
    const relevant = finding(); // has carbon credit terms
    const irrelevant = finding({
      title: "New ev charging station network",
      summary: "EV charging expands across Europe",
      entity: "ChargePoint",
      action: "expanded network",
    });
    const result = applyAltCarbonRelevanceGate([relevant, irrelevant]);
    // Only the relevant one passes primary gate
    expect(result).toHaveLength(1);
    expect(result[0].entity).toBe("Verra");
  });

  it("returns empty for empty input", () => {
    expect(applyAltCarbonRelevanceGate([])).toEqual([]);
  });

  it("research stream needs only one relevance term", () => {
    const items = [
      finding({
        stream: "research",
        title: "Biochar stability study",
        summary: "New findings on biochar permanence",
        sourceUrl: "https://nature.com/articles/123",
      }),
    ];
    const result = applyAltCarbonRelevanceGate(items);
    expect(result).toHaveLength(1);
  });
});
