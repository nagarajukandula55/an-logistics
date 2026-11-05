export const AGENT_NAMES = [
  "onboarding",
  "pricing",
  "wallet",
  "shipment",
  "tracking",
  "billing",
  "notifications",
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

export type AgentResult = {
  agent: AgentName;
  summary: string;
  findings: { severity: "INFO" | "WARNING" | "ACTION"; message: string; count?: number }[];
  data?: Record<string, unknown>;
};
