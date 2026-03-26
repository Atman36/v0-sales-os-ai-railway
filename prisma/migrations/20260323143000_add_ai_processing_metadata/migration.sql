ALTER TABLE "CallTranscript"
RENAME COLUMN "raw" TO "rawResponse";

ALTER TABLE "CallTranscript"
ADD COLUMN "model" TEXT;

ALTER TABLE "AIInsight"
ADD COLUMN "promptVersion" TEXT,
ADD COLUMN "provider" TEXT,
ADD COLUMN "model" TEXT,
ADD COLUMN "rawResponse" JSONB;
