CREATE TABLE IF NOT EXISTS "ManagerMonthlyPlan" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerMonthlyPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ManagerMonthlyPlan_managerId_month_key" ON "ManagerMonthlyPlan"("managerId", "month");
CREATE INDEX IF NOT EXISTS "ManagerMonthlyPlan_month_idx" ON "ManagerMonthlyPlan"("month");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ManagerMonthlyPlan_managerId_fkey') THEN
    ALTER TABLE "ManagerMonthlyPlan"
      ADD CONSTRAINT "ManagerMonthlyPlan_managerId_fkey"
      FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
