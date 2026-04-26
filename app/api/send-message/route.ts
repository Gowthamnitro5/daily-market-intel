import { NextResponse } from "next/server";
import { postMessage } from "@/lib/slack";
import { getEnv } from "@/lib/env";

type Payload = {
  message?: string;
  channel?: string;
};

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const expected = `Bearer ${getEnv("CUSTOM_MESSAGE_TOKEN")}`;
    if (authHeader !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as Payload;
    if (!body.message) {
      return NextResponse.json({ error: "Missing message" }, { status: 400 });
    }

    const ts = await postMessage(body.message, body.channel);
    return NextResponse.json({ ok: true, ts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
