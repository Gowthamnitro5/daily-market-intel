import { describe, it, expect } from "vitest";
import { dedupeFindings } from "../dedupe";
import type { AgentFinding } from "../types";

function finding(overrides: Partial<AgentFinding> = {}): AgentFinding {
  return {
    stream: "market",
    title: "Test Finding",
    summary: "A summary",
    entity: "Acme Corp",
    action: "raised Series A",
    sourceUrl: "https://example.com/article",
    sourceName: "Example",
    ...overrides,
  };
}

describe("dedupeFindings", () => {
  it("returns empty array for empty input", () => {
    expect(dedupeFindings([])).toEqual([]);
  });

  it("removes exact URL duplicates", () => {
    const items = [
      finding({ sourceUrl: "https://example.com/a", title: "First" }),
      finding({ sourceUrl: "https://example.com/a", title: "Second" }),
    ];
    const result = dedupeFindings(items);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("First");
  });

  it("treats URLs with trailing slashes as duplicates", () => {
    const items = [
      finding({ sourceUrl: "https://example.com/a/", title: "With slash" }),
      finding({ sourceUrl: "https://example.com/a", title: "Without slash" }),
    ];
    const result = dedupeFindings(items);
    expect(result).toHaveLength(1);
  });

  it("removes duplicate entity::action pairs", () => {
    const items = [
      finding({
        sourceUrl: "https://source1.com/article",
        entity: "Verra",
        action: "launched new methodology",
      }),
      finding({
        sourceUrl: "https://source2.com/article",
        entity: "Verra",
        action: "launched new methodology",
      }),
    ];
    const result = dedupeFindings(items);
    expect(result).toHaveLength(1);
  });

  it("keeps findings with different entities", () => {
    const items = [
      finding({
        sourceUrl: "https://source1.com/a",
        entity: "Verra",
        action: "launched methodology",
      }),
      finding({
        sourceUrl: "https://source2.com/b",
        entity: "Gold Standard",
        action: "launched methodology",
      }),
    ];
    const result = dedupeFindings(items);
    expect(result).toHaveLength(2);
  });

  it("caps output at 40 items", () => {
    const items = Array.from({ length: 60 }, (_, i) =>
      finding({
        sourceUrl: `https://example.com/article-${i}`,
        entity: `Entity ${i}`,
        action: `Action ${i}`,
      }),
    );
    const result = dedupeFindings(items);
    expect(result.length).toBeLessThanOrEqual(40);
  });
});
