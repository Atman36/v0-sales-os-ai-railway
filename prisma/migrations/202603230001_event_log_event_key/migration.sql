ALTER TABLE "EventLog"
ADD COLUMN "eventKey" TEXT;

UPDATE "EventLog"
SET "eventKey" = "eventType" || ':' || "externalId" || ':' || md5(("payload")::text)
WHERE "eventKey" IS NULL;

ALTER TABLE "EventLog"
ALTER COLUMN "eventKey" SET NOT NULL;

DROP INDEX IF EXISTS "EventLog_externalId_eventType_key";

CREATE UNIQUE INDEX "EventLog_eventKey_key" ON "EventLog"("eventKey");
