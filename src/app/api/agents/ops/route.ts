import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { AGENT_NAMES, type AgentName } from "@/lib/agents/types";
import { executeAgent, executeAllAgents } from "@/lib/agents/orchestrator";

async function authorized(request: Request) {
  const configured = process.env.AGENT_API_KEY;
  const bearer = request.headers.get("authorization");
  if (configured && bearer === `Bearer ${configured}`) return true;
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { agent?: string };
  if (!body.agent || body.agent === "all") return NextResponse.json({ results: await executeAllAgents() });
  if (!AGENT_NAMES.includes(body.agent as AgentName)) return NextResponse.json({ error: "Unknown agent", agents: AGENT_NAMES }, { status: 400 });
  return NextResponse.json({ result: await executeAgent(body.agent as AgentName) });
}

export async function GET(request: Request) {
  if (!(await authorized(request))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ agents: AGENT_NAMES, usage: "POST { agent: 'all' | agent name }" });
}
