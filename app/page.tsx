const envChecklist = [
  "OPENROUTER_API_KEY",
  "EXA_API_KEY",
  "SLACK_BOT_TOKEN",
  "SLACK_SIGNING_SECRET",
  "SLACK_CHANNEL_ID",
  "CRON_SECRET",
  "CUSTOM_MESSAGE_TOKEN",
];

export default function Home() {
  return (
    <main style={{ maxWidth: 860, margin: "40px auto", padding: "0 20px" }}>
      <h1 style={{ marginBottom: 8 }}>Daily Market Intelligence</h1>
      <p style={{ opacity: 0.85, marginTop: 0 }}>
        Next.js realtime implementation inspired by the Alt Curioso workflow style.
      </p>

      <section
        style={{
          marginTop: 20,
          padding: 16,
          border: "1px solid #1f2937",
          borderRadius: 10,
          background: "#111827",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Endpoints</h2>
        <ul>
          <li>
            <code>POST /api/cron</code> - run and post daily briefing
          </li>
          <li>
            <code>POST /api/slack/events</code> - verify + handle Slack events
          </li>
          <li>
            <code>POST /api/send-message</code> - authenticated custom message
          </li>
        </ul>
      </section>

      <section
        style={{
          marginTop: 20,
          padding: 16,
          border: "1px solid #1f2937",
          borderRadius: 10,
          background: "#111827",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Required env vars</h2>
        <ul>
          {envChecklist.map((name) => (
            <li key={name}>
              <code>{name}</code>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
