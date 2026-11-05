import { NextResponse } from "next/server";
import { TelegramNotificationEvent } from "@prisma/client";
import { AGENT_NAMES } from "@/lib/agents/types";
import { executeAllAgents } from "@/lib/agents/orchestrator";
import { notifyOpsTelegram } from "@/lib/telegram";

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await executeAllAgents("cron");
  const findings = results.flatMap((result) => result.findings.filter((finding) => finding.severity !== "INFO").map((finding) => `${result.agent}: ${finding.severity} — ${finding.message}${finding.count === undefined ? "" : ` (${finding.count})`}`));
  if (findings.length) {
    await notifyOpsTelegram(TelegramNotificationEvent.AGENT_ALERT, `<b>AN Logistics system agent alert</b>\n\n${findings.join("\n")}`);
  }
  return NextResponse.json({ agents: AGENT_NAMES, results, alerts: findings.length });
}
