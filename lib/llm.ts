import { generateText } from "ai";
import type { AgentFinding } from "./types";
import { freeModel } from "./model";

function groupedInput(items: AgentFinding[]) {
  return items
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.stream}] ${i.title}\nEntity: ${i.entity}\nAction: ${i.action}\nSummary: ${i.summary}\nSource: <${i.sourceUrl}|${i.sourceName}>`,
    )
    .join("\n");
}

/**
 * Generate 5 smart TL;DR bullets using LLM.
 * Returns an array of bullet strings (without the "• " prefix).
 * Falls back to simple title-based bullets if LLM fails.
 */
export async function generateTldrBullets(items: AgentFinding[]): Promise<string[]> {
  const fallback = items
    .slice(0, 5)
    .map((i) => {
      const headline = i.title.replace(/\*/g, "").trim();
      const implication = (i.summary.split(".")[0] || "Key development for Alt Carbon").replace(/\*/g, "").trim();
      return `*${headline}* — ${implication}`;
    });

  if (items.length === 0) {
    return ["*No significant CDR intelligence in the past 48 hours.*"];
  }

  try {
    const { text } = await generateText({
      model: freeModel(),
      temperature: 0.2,
      system: `You are Alt Carbon's market intelligence editor.
You will receive a list of findings from the last 48 hours.
Your job: pick the 5 most important and write a one-line TL;DR for each.

Output format — exactly 5 lines, one per bullet, no numbering:
<headline> — <one-sentence business implication for Alt Carbon>
<headline> — <one-sentence business implication for Alt Carbon>
<headline> — <one-sentence business implication for Alt Carbon>
<headline> — <one-sentence business implication for Alt Carbon>
<headline> — <one-sentence business implication for Alt Carbon>

Rules:
- Pick the 5 highest-impact items across ALL streams (policy, funding, market, research, customer, competitive).
- Prioritize diversity: cover different streams, don't cluster on one topic.
- Each bullet must state the business implication for a carbon removal / CDR company.
- Deduplicate: if the same event appears from multiple sources, merge into one bullet.
- No emojis. No hype. No markdown formatting. Plain text only.
- Do not add any prefix like "•" or "-" or numbers.`,
      prompt: `Input findings:\n${groupedInput(items)}`,
    });

    const lines = text
      .split("\n")
      .map((l) => l.replace(/^[\s•\-\d.]+/, "").trim())
      .filter((l) => l.length > 10 && l.includes("—"));

    if (lines.length >= 3) {
      return lines.slice(0, 5).map((l) => {
        const [headline, ...rest] = l.split("—");
        return `*${(headline ?? "").replace(/\*/g, "").trim()}* — ${rest.join("—").replace(/\*/g, "").trim()}`;
      });
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export async function answerThreadQuestion(briefing: string, question: string) {
  const { text } = await generateText({
    model: freeModel(),
    temperature: 0.2,
    system:
      "You answer follow-up questions in a Slack thread using the prior daily market briefing context. Be concise, factual, and explicit about uncertainty.",
    prompt: `Daily briefing:\n${briefing}\n\nUser question: ${question}`,
  }).catch(() => ({ text: "I could not query the model right now. Please retry in a few minutes." }));

  return text;
}
