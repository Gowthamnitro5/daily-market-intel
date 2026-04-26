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

export async function generateDailyBriefing(items: AgentFinding[]) {
  const now = new Date();
  const dateLong = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  try {
    const { text } = await generateText({
      model: freeModel(),
      temperature: 0.2,
      system: `You are Alt Carbon's market intelligence editor.
Return plain markdown text only, not Slack formatting.
Output must follow this exact style:

Alt Carbon — Market Intelligence
<Day, Month DD, YYYY>

TL;DR:
• <headline> — <one-sentence business implication>
• <headline> — <one-sentence business implication>
• <headline> — <one-sentence business implication>
• <headline> — <one-sentence business implication>
• <headline> — <one-sentence business implication>

To know more, check the thread replies below.

Rules:
- Exactly 5 bullets in TL;DR.
- Each bullet must be specific to carbon credits/CDR/MRV/agri-infra relevance for Alt Carbon.
- Deduplicate same story across different sources.
- If same event was already reported and no materially new detail appears, do not repeat.
- No emojis. No hype language.`,
      prompt: `Date: ${dateLong}\n\nInput items:\n${groupedInput(items)}`,
    });

    return text;
  } catch {
    const top = items.slice(0, 5);
    const bullets = top
      .map((i) => `• ${i.title} — ${i.summary.split(".")[0] || "Relevant development for Alt Carbon."}`)
      .join("\n");
    const fallbackBullets =
      bullets ||
      [
        "• No high-confidence fresh carbon-credit signal in last 48 hours — monitoring continues.",
        "• No major MRV methodology shift detected — keep watch on protocol updates.",
        "• No significant buyer offtake announcement verified — track corporate procurement windows.",
        "• No major policy surprise relevant to CDR eligibility identified — monitor Article 6 and registry notices.",
        "• No notable agri-infra deployment update surfaced from trusted sources — continue field intelligence sweep.",
      ].join("\n");

    return `Alt Carbon — Market Intelligence\n${dateLong}\n\nTL;DR:\n${fallbackBullets}\n\nTo know more, check the thread replies below.`;
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
