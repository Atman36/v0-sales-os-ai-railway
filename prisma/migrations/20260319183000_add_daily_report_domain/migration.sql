CREATE TABLE IF NOT EXISTS "DailyReport" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "callsTotal" INTEGER NOT NULL DEFAULT 0,
    "callsTarget" INTEGER NOT NULL DEFAULT 0,
    "dealsCount" INTEGER NOT NULL DEFAULT 0,
    "contractsCount" INTEGER NOT NULL DEFAULT 0,
    "invoicesCount" INTEGER NOT NULL DEFAULT 0,
    "invoicesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "paymentsCount" INTEGER NOT NULL DEFAULT 0,
    "margin" DECIMAL(12,2) NOT NULL DEFAULT 0.0,
    "comment" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyReport_managerId_date_key" ON "DailyReport"("managerId", "date");
CREATE INDEX IF NOT EXISTS "DailyReport_date_idx" ON "DailyReport"("date");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_managerId_fkey') THEN
    ALTER TABLE "DailyReport"
      ADD CONSTRAINT "DailyReport_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_callsTotal_nonnegative') THEN
    ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_callsTotal_nonnegative" CHECK ("callsTotal" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_callsTarget_nonnegative') THEN
    ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_callsTarget_nonnegative" CHECK ("callsTarget" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_dealsCount_nonnegative') THEN
    ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_dealsCount_nonnegative" CHECK ("dealsCount" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_contractsCount_nonnegative') THEN
    ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_contractsCount_nonnegative" CHECK ("contractsCount" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_invoicesCount_nonnegative') THEN
    ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_invoicesCount_nonnegative" CHECK ("invoicesCount" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_invoicesAmount_nonnegative') THEN
    ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_invoicesAmount_nonnegative" CHECK ("invoicesAmount" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_paymentsCount_nonnegative') THEN
    ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_paymentsCount_nonnegative" CHECK ("paymentsCount" >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DailyReport_margin_nonnegative') THEN
    ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_margin_nonnegative" CHECK ("margin" >= 0);
  END IF;
END $$;
