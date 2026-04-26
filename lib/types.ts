export type ThreadContext = {
  briefing: string;
  createdAt: string;
};

export type IntelligenceStream =
  | "policy"
  | "funding"
  | "market"
  | "research"
  | "customer"
  | "competitive";

export type AgentFinding = {
  stream: IntelligenceStream;
  title: string;
  summary: string;
  entity: string;
  action: string;
  sourceUrl: string;
  sourceName: string;
  publishedAt?: string;
};
