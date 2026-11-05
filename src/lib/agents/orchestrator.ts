import { prisma } from "@/lib/prisma";
import { AGENT_NAMES, type AgentName, type AgentResult } from "./types";
import { runAgent } from "./registry";

export async function executeAgent(agent: AgentName, trigger: "api" | "cron" = "api"): Promise<AgentResult> {
  const run = await prisma.agentRun.create({ data: { agent, input: { trigger } } });
  try {
    const result = await runAgent(agent);
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "SUCCEEDED", output: JSON.parse(JSON.stringify(result)), completedAt: new Date() } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent failed";
    await prisma.agentRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, completedAt: new Date() } });
    throw error;
  }
}

export async function executeAllAgents(trigger: "api" | "cron" = "api"): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  for (const agent of AGENT_NAMES) results.push(await executeAgent(agent, trigger));
  return results;
}
