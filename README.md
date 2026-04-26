# Daily Market Intelligence (Next.js)

Realtime market-intelligence bot inspired by the Alt Curioso operating style:
- automated daily briefing generation
- Slack posting
- Slack thread follow-up Q&A
- secure trigger endpoints
- six specialized intelligence agents (policy, funding, market, research, customer, competitive)
- Exa-backed per-agent search orchestration
- cross-agent radar-grade dedupe (URL and entity+action)
- SQLite publish-history database to prevent duplicate Slack publishing
- freshness and novelty guard: only items published within 48h and suppress stale re-reporting unless materially new

## Setup

1. Install deps:
   - `npm install`
2. Create env file:
   - `cp .env.example .env.local`
3. Fill in all values in `.env.local`.

## Run locally

- `npm run dev`

## API routes

- `POST /api/cron`
  - Header: `Authorization: Bearer <CRON_SECRET>`
  - Triggers one full run:
    - run six specialized agents with Exa search
    - global dedupe
    - filter out already-published items from database
    - synthesize briefing and post to Slack.
    - save published URLs + source date + Slack publish timestamp to SQLite

- `POST /api/send-message`
  - Header: `Authorization: Bearer <CUSTOM_MESSAGE_TOKEN>`
  - JSON body: `{ "message": "text", "channel": "optional-channel-id" }`

- `POST /api/slack/events`
  - Slack Events API endpoint for challenge + signed event callbacks.
  - Handles thread replies using stored daily briefing context.

## Deploy

Deploy to Vercel and configure:
- env vars from `.env.example`
- scheduled cron job (Vercel Cron or external scheduler) calling `/api/cron`
- Slack Events callback URL to `/api/slack/events`

## Publish database

A local SQLite DB is automatically created at:
- `.data/market-intel.sqlite`

Table:
- `published_items`
  - `source_url` (unique)
  - `source_published_date`
  - `first_slack_published_at`
  - `first_slack_thread_ts`

This is used to ensure already published intelligence is not posted to Slack again.
