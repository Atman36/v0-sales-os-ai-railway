DO $$
BEGIN
  CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "CallProcessingStatus" AS ENUM ('NEW', 'QUEUED', 'PROCESSING', 'DONE', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "MetricsScope" AS ENUM ('TEAM', 'MANAGER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InsightScope" AS ENUM ('TEAM', 'MANAGER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InsightType" AS ENUM ('RISK', 'OPPORTUNITY', 'COACH', 'ANOMALY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Manager" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "externalId" TEXT,
  "avatarUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Manager_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TenantConfig" (
  "id" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "webhookSecret" TEXT NOT NULL,
  "funnelStageMapping" JSONB NOT NULL,
  "managerMapping" JSONB NOT NULL,
  "planDefaults" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DailyPlanNote" (
  "id" TEXT NOT NULL,
  "managerId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "note" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyPlanNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EventLog" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),

  CONSTRAINT "EventLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Deal" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "title" TEXT,
  "amount" DECIMAL(12,2),
  "currency" TEXT,
  "stageKey" TEXT NOT NULL,
  "stageRaw" TEXT,
  "status" TEXT,
  "managerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "closedAt" TIMESTAMP(3),

  CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DealStageHistory" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "managerId" TEXT,
  "stageKey" TEXT NOT NULL,
  "stageRaw" TEXT,
  "amount" DECIMAL(12,2),
  "changedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DealStageHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DailyMetrics" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "scope" "MetricsScope" NOT NULL DEFAULT 'TEAM',
  "managerKey" TEXT NOT NULL,
  "managerId" TEXT,
  "callsTotal" INTEGER NOT NULL DEFAULT 0,
  "callsTarget" INTEGER NOT NULL DEFAULT 0,
  "dealsCount" INTEGER NOT NULL DEFAULT 0,
  "contractsCount" INTEGER NOT NULL DEFAULT 0,
  "invoicesCount" INTEGER NOT NULL DEFAULT 0,
  "invoicesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
  "paymentsCount" INTEGER NOT NULL DEFAULT 0,
  "margin" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
  "avgCheck" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyMetrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Call" (
  "id" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "managerId" TEXT,
  "dealId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "durationSec" INTEGER,
  "recordingUrl" TEXT,
  "recordingProvider" TEXT,
  "processingStatus" "CallProcessingStatus" NOT NULL DEFAULT 'NEW',
  "processingAttempts" INTEGER NOT NULL DEFAULT 0,
  "queueJobId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CallTranscript" (
  "id" TEXT NOT NULL,
  "callId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "raw" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CallTranscript_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AIInsight" (
  "id" TEXT NOT NULL,
  "scope" "InsightScope" NOT NULL,
  "type" "InsightType" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "why" TEXT NOT NULL,
  "recommendedActions" JSONB NOT NULL,
  "impactEstimate" DECIMAL(12,2),
  "confidence" DOUBLE PRECISION,
  "relatedManagerIds" JSONB,
  "relatedMetrics" JSONB,
  "managerId" TEXT,
  "callId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AIInsight_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "Manager_externalId_key" ON "Manager"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "DailyPlanNote_managerId_date_key" ON "DailyPlanNote"("managerId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "EventLog_externalId_eventType_key" ON "EventLog"("externalId", "eventType");
CREATE UNIQUE INDEX IF NOT EXISTS "Deal_externalId_key" ON "Deal"("externalId");
CREATE INDEX IF NOT EXISTS "DealStageHistory_changedAt_idx" ON "DealStageHistory"("changedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "DailyMetrics_date_managerKey_key" ON "DailyMetrics"("date", "managerKey");
CREATE INDEX IF NOT EXISTS "DailyMetrics_date_idx" ON "DailyMetrics"("date");
CREATE UNIQUE INDEX IF NOT EXISTS "Call_externalId_key" ON "Call"("externalId");
CREATE UNIQUE INDEX IF NOT EXISTS "CallTranscript_callId_key" ON "CallTranscript"("callId");
CREATE INDEX IF NOT EXISTS "AIInsight_scope_idx" ON "AIInsight"("scope");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyPlanNote_managerId_fkey') THEN
    ALTER TABLE "DailyPlanNote"
      ADD CONSTRAINT "DailyPlanNote_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Deal_managerId_fkey') THEN
    ALTER TABLE "Deal"
      ADD CONSTRAINT "Deal_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealStageHistory_dealId_fkey') THEN
    ALTER TABLE "DealStageHistory"
      ADD CONSTRAINT "DealStageHistory_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DealStageHistory_managerId_fkey') THEN
    ALTER TABLE "DealStageHistory"
      ADD CONSTRAINT "DealStageHistory_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyMetrics_managerId_fkey') THEN
    ALTER TABLE "DailyMetrics"
      ADD CONSTRAINT "DailyMetrics_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Call_managerId_fkey') THEN
    ALTER TABLE "Call"
      ADD CONSTRAINT "Call_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Call_dealId_fkey') THEN
    ALTER TABLE "Call"
      ADD CONSTRAINT "Call_dealId_fkey"
      FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CallTranscript_callId_fkey') THEN
    ALTER TABLE "CallTranscript"
      ADD CONSTRAINT "CallTranscript_callId_fkey"
      FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIInsight_managerId_fkey') THEN
    ALTER TABLE "AIInsight"
      ADD CONSTRAINT "AIInsight_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AIInsight_callId_fkey') THEN
    ALTER TABLE "AIInsight"
      ADD CONSTRAINT "AIInsight_callId_fkey"
      FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
