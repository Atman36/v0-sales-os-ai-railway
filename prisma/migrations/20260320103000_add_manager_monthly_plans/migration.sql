-- CreateTable
CREATE TABLE "ManagerMonthlyPlan" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "plan" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerMonthlyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerMonthlyPlan_managerId_month_key" ON "ManagerMonthlyPlan"("managerId", "month");

-- CreateIndex
CREATE INDEX "ManagerMonthlyPlan_month_idx" ON "ManagerMonthlyPlan"("month");

-- AddForeignKey
ALTER TABLE "ManagerMonthlyPlan" ADD CONSTRAINT "ManagerMonthlyPlan_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
