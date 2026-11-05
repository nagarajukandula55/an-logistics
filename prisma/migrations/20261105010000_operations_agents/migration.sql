CREATE TYPE "AgentRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "AgentRun" (
  "id" TEXT NOT NULL,
  "agent" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL DEFAULT 'RUNNING',
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AgentRun_agent_startedAt_idx" ON "AgentRun"("agent", "startedAt");
CREATE INDEX "AgentRun_status_startedAt_idx" ON "AgentRun"("status", "startedAt");
