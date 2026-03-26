DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'EventLog'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'EventLog' AND column_name = 'eventKey'
  ) THEN
    ALTER TABLE "EventLog" ADD COLUMN "eventKey" TEXT;
  END IF;
END $$;

UPDATE "EventLog"
SET "eventKey" = "eventType" || ':' || "externalId" || ':' || md5(("payload")::text)
WHERE "eventKey" IS NULL;

ALTER TABLE "EventLog"
ALTER COLUMN "eventKey" SET NOT NULL;

DROP INDEX IF EXISTS "EventLog_externalId_eventType_key";

CREATE UNIQUE INDEX IF NOT EXISTS "EventLog_eventKey_key" ON "EventLog"("eventKey");
