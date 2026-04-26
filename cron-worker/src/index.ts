export interface Env {
  VERCEL_CRON_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
    const url = env.VERCEL_CRON_URL || "https://daily-market-intel.vercel.app/api/cron";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    const body = await response.text();
    console.log(`Cron triggered: ${response.status} — ${body.slice(0, 200)}`);
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Manual trigger for testing
    if (url.pathname === "/trigger") {
      const cronUrl = env.VERCEL_CRON_URL || "https://daily-market-intel.vercel.app/api/cron";
      const response = await fetch(cronUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.CRON_SECRET}`,
          "Content-Type": "application/json",
        },
      });
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Daily Market Intel Cron Worker. POST /trigger to test.", { status: 200 });
  },
};
