import { beforeEach, describe, expect, it, vi } from "vitest";

const postMessageMock = vi.fn();
const streamFeeds = {
  policy: ["https://www.climatechangenews.com/feed/", "https://example.com/good.xml"],
  funding: [],
  market: [],
  research: [],
  customer: [],
  competitive: [],
};

vi.mock("../source-config", () => ({
  STREAM_RSS_FEEDS: streamFeeds,
}));

vi.mock("../slack", () => ({
  postMessage: (...args: unknown[]) => postMessageMock(...args),
}));

describe("alertUnhealthyFeeds", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-30T08:43:00.000Z"));
    postMessageMock.mockReset();
  });

  it("suppresses known persistent 403 feed errors", async () => {
    global.fetch = vi.fn(async (url: string) => {
      if (url.includes("climatechangenews")) {
        return new Response("blocked", { status: 403 });
      }
      return new Response("<rss><item>ok</item></rss>", { status: 200 });
    }) as unknown as typeof fetch;

    const { alertUnhealthyFeeds } = await import("../feed-health");
    await alertUnhealthyFeeds();

    expect(postMessageMock).not.toHaveBeenCalled();
  });

  it("sends only one alert for duplicate failure state during cooldown", async () => {
    global.fetch = vi.fn(async () => new Response("bad gateway", { status: 502 })) as unknown as typeof fetch;

    const { alertUnhealthyFeeds } = await import("../feed-health");
    await alertUnhealthyFeeds();
    await alertUnhealthyFeeds();

    expect(postMessageMock).toHaveBeenCalledTimes(1);
  });
});
